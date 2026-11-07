BEGIN;

-- Require the reviewed Stage 2 ownership and authorization contracts.
DO $$ BEGIN
  IF to_regprocedure('public.stage2_my_team_id()') IS NULL THEN
    RAISE EXCEPTION 'Apply reviewed Stage 2 security before live operations';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.event_clock (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  starts_at timestamptz,
  ended_at timestamptz,
  CHECK (ended_at IS NULL OR (starts_at IS NOT NULL AND ended_at >= starts_at AND ended_at <= starts_at + interval '24 hours'))
);
ALTER TABLE public.event_clock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.event_clock FROM PUBLIC, anon, authenticated;
INSERT INTO public.event_clock(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.event_clock_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.event_clock%ROWTYPE;
BEGIN
  IF public.stage2_my_team_id() IS NULL AND public.get_current_mentor_id() IS NULL THEN
    RAISE EXCEPTION 'Workspace access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO STRICT c FROM public.event_clock WHERE singleton;
  RETURN jsonb_build_object('starts_at', c.starts_at, 'ends_at',
    coalesce(c.ended_at, c.starts_at + interval '24 hours'), 'server_now', clock_timestamp());
END $$;

CREATE OR REPLACE FUNCTION public.event_clock_control(p_action text, p_start timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.event_clock%ROWTYPE; current_time_utc timestamptz;
BEGIN
  IF NOT public.is_organizer() THEN RAISE EXCEPTION 'Organizer required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO STRICT c FROM public.event_clock WHERE singleton FOR UPDATE;
  current_time_utc := clock_timestamp();
  IF p_action = 'end' THEN
    IF c.starts_at IS NULL OR current_time_utc < c.starts_at OR c.ended_at IS NOT NULL
      OR current_time_utc >= c.starts_at + interval '24 hours' THEN RAISE EXCEPTION 'The event is not live'; END IF;
    UPDATE public.event_clock SET ended_at = current_time_utc WHERE singleton;
  ELSIF p_action IN ('schedule', 'start') THEN
    IF c.starts_at <= current_time_utc THEN RAISE EXCEPTION 'The event has already started'; END IF;
    IF p_action = 'schedule' AND (p_start IS NULL OR p_start <= current_time_utc OR NOT isfinite(p_start)) THEN
      RAISE EXCEPTION 'Choose a future start time';
    END IF;
    UPDATE public.event_clock SET starts_at = CASE WHEN p_action = 'start' THEN current_time_utc ELSE p_start END WHERE singleton;
  ELSE RAISE EXCEPTION 'Unknown clock action';
  END IF;
  RETURN public.event_clock_state();
END $$;

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS progress_at timestamptz;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS submission_key uuid;
-- Fail on historical duplicates for operator review rather than rewriting history.
CREATE UNIQUE INDEX IF NOT EXISTS live_request_per_team ON public.requests(team_id)
  WHERE status IN ('open','claimed') AND cancelled_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS live_request_submission ON public.requests(team_id,submission_key);

CREATE OR REPLACE FUNCTION public.stage2_allocation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.cancelled_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Cancelled requests are closed';
  END IF;
  IF NEW.status = 'open' THEN NEW.progress_at := NULL; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_organizer() THEN
    IF public.get_current_mentor_id() IS NULL
      OR OLD.claimed_by IS DISTINCT FROM public.get_current_mentor_id()
      OR OLD.status <> 'claimed' OR NEW.status NOT IN ('claimed','resolved')
      OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
      OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
      OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
      RAISE EXCEPTION 'Only the assigned mentor can progress or resolve this request' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.submit_mentor_request(p_reason text, p_submission_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owned_id uuid := public.stage2_my_team_id(); table_no integer; request_id uuid;
BEGIN
  IF owned_id IS NULL THEN RAISE EXCEPTION 'Team ownership required' USING ERRCODE = '42501'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 OR p_submission_key IS NULL THEN
    RAISE EXCEPTION 'Enter a reason of 1 to 2000 characters';
  END IF;
  SELECT table_number INTO STRICT table_no FROM public.teams WHERE id = owned_id FOR UPDATE;
  SELECT id INTO request_id FROM public.requests WHERE team_id = owned_id AND submission_key = p_submission_key;
  IF FOUND THEN RETURN request_id; END IF;
  INSERT INTO public.requests(team_id,table_number,issue,status,submission_key)
    VALUES (owned_id,table_no,btrim(p_reason),'open',p_submission_key) RETURNING id INTO request_id;
  RETURN request_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Your team already has an active mentor request' USING ERRCODE = '23505';
END $$;

CREATE OR REPLACE FUNCTION public.live_mentor_requests()
RETURNS TABLE(id uuid, table_number integer, team_name text, issue text, status text,
  claimed_by uuid, mentor_name text, created_at timestamptz, team_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id,r.table_number,t.name,r.issue,
    CASE WHEN r.cancelled_at IS NOT NULL THEN 'cancelled'
      WHEN r.status = 'claimed' AND r.progress_at IS NOT NULL THEN 'in_progress'
      ELSE r.status END,
    r.claimed_by,m.name,r.created_at,r.team_id
  FROM public.requests r LEFT JOIN public.teams t ON t.id = r.team_id
    LEFT JOIN public.mentors m ON m.id = r.claimed_by
  WHERE public.is_organizer() OR r.team_id = public.stage2_my_team_id()
    OR r.claimed_by = public.get_current_mentor_id()
  ORDER BY r.created_at DESC, r.id DESC
$$;

CREATE OR REPLACE FUNCTION public.update_mentor_request(p_id uuid, p_action text, p_mentor uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.requests%ROWTYPE; actor uuid := public.get_current_mentor_id(); organizer boolean := public.is_organizer();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.requests WHERE id = p_id AND (organizer OR claimed_by = actor) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE = '42501'; END IF;
  IF r.cancelled_at IS NOT NULL OR r.status = 'resolved' THEN RAISE EXCEPTION 'Request is already closed'; END IF;
  IF p_action = 'assign' AND organizer AND r.status = 'open' THEN
    PERFORM 1 FROM public.mentors WHERE id = p_mentor AND role = 'mentor' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose an authorized mentor';
    END IF;
    IF EXISTS (SELECT 1 FROM public.requests WHERE claimed_by = p_mentor
      AND status = 'claimed' AND cancelled_at IS NULL) THEN
      RAISE EXCEPTION 'This mentor already has an active assignment';
    END IF;
    PERFORM public.claim_request(p_id,p_mentor);
  ELSIF p_action = 'progress' AND r.status = 'claimed' THEN
    IF r.progress_at IS NOT NULL THEN RETURN; END IF;
    UPDATE public.requests SET progress_at = clock_timestamp() WHERE id = p_id;
  ELSIF p_action = 'resolve' AND r.status = 'claimed' THEN
    PERFORM public.resolve_request(p_id);
  ELSIF p_action = 'cancel' AND organizer THEN
    UPDATE public.requests SET cancelled_at = clock_timestamp() WHERE id = p_id;
  ELSE RAISE EXCEPTION 'This transition is unavailable' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.activity_log(actor_id,action,entity_type,entity_id,details)
    VALUES (actor,'live_request_' || p_action,'request',p_id,jsonb_build_object('mentor_id',p_mentor));
END $$;

-- Keep legacy implementations callable by the RPC owner only.
REVOKE EXECUTE ON FUNCTION public.claim_request(uuid,uuid), public.release_request(uuid),
  public.resolve_request(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.live_request_activity(p_id uuid)
RETURNS TABLE(action text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT l.action,l.created_at FROM public.activity_log l
  WHERE public.is_organizer() AND l.entity_type = 'request' AND l.entity_id = p_id
  ORDER BY l.created_at DESC,l.id DESC
$$;

REVOKE ALL ON FUNCTION public.event_clock_state(), public.event_clock_control(text,timestamptz),
  public.submit_mentor_request(text,uuid), public.live_mentor_requests(),
  public.update_mentor_request(uuid,text,uuid), public.live_request_activity(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_clock_state(), public.event_clock_control(text,timestamptz),
  public.submit_mentor_request(text,uuid), public.live_mentor_requests(),
  public.update_mentor_request(uuid,text,uuid), public.live_request_activity(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
