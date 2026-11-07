-- REVIEW DRAFT. Do not apply without the Stage 2 runbook and isolated tests.
-- Contract: zerohour_deployed_schema_export.csv SHA256
-- EDD64E53B603DEA7991E43487039D9711DFE2BE080F25C027EB87A2626CE2AE1
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Serialize changes against existing writes; never select an Admin arbitrarily.
LOCK TABLE public.mentors, public.teams, public.requests,
  public.evaluations, public.team_sessions IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run the reviewed migration as postgres';
  END IF;
  IF (SELECT count(*) FROM public.mentors WHERE role = 'organizer') <> 1 THEN
    RAISE EXCEPTION 'Exactly one EXISTING organizer must be confirmed before migration';
  END IF;
  IF current_setting('zerohour.authorized_admin_user_id', true) IS DISTINCT FROM
     (SELECT user_id::text FROM public.mentors WHERE role = 'organizer') THEN
    RAISE EXCEPTION 'Operator must confirm the existing Admin user UUID in this database session';
  END IF;
  IF current_setting('zerohour.confirm_table_history', true) IS DISTINCT FROM 'reviewed' THEN
    RAISE EXCEPTION 'Review historical table ownership before authorizing the request backfill';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mentors m JOIN auth.users u ON u.id = m.user_id
    WHERE m.role = 'organizer' AND COALESCE(u.is_anonymous, false)
  ) THEN
    RAISE EXCEPTION 'Existing organizer must be a non-anonymous staff identity';
  END IF;
  IF to_regprocedure('public.login_team(text,text)') IS NULL
     OR to_regprocedure('public.get_my_team()') IS NULL THEN
    RAISE EXCEPTION 'Verified team ownership RPCs are required';
  END IF;
END $$;

-- At most one Admin, plus a trigger below preventing removal/demotion/rebinding.
CREATE UNIQUE INDEX stage2_one_organizer ON public.mentors ((role))
  WHERE role = 'organizer';

CREATE FUNCTION public.stage2_preserve_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.role = 'organizer' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'The sole Admin cannot be deleted; use a reviewed identity-transfer migration';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'The sole Admin identity cannot be removed, demoted, or rebound';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stage2_preserve_admin BEFORE UPDATE OR DELETE ON public.mentors
  FOR EACH ROW EXECUTE FUNCTION public.stage2_preserve_admin();

CREATE OR REPLACE FUNCTION public.is_organizer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'false'
    AND EXISTS (SELECT 1 FROM public.mentors WHERE user_id = auth.uid() AND role = 'organizer');
$$;
CREATE OR REPLACE FUNCTION public.get_current_mentor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT id FROM public.mentors WHERE user_id = auth.uid()
    AND COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'false';
$$;
CREATE FUNCTION public.stage2_my_team_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT team_id FROM public.team_sessions WHERE user_id = auth.uid()
    AND COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'true';
$$;

-- Minimal authorization dependency, NOT rounds/rubrics/dynamic grading.
-- No automatic authorization backfill: an old score is not proof of assignment.
CREATE TABLE public.evaluation_authorizations (
  team_id uuid NOT NULL REFERENCES public.teams(id),
  mentor_id uuid NOT NULL REFERENCES public.mentors(id),
  granted_by uuid NOT NULL REFERENCES public.mentors(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, mentor_id)
);
CREATE INDEX stage2_evaluation_authorizations_mentor ON public.evaluation_authorizations(mentor_id);
ALTER TABLE public.evaluation_authorizations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.stage2_can_evaluate(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.evaluation_authorizations
    WHERE team_id = p_team_id AND mentor_id = public.get_current_mentor_id());
$$;

-- Bind old requests once by the exported UNIQUE teams.table_number contract.
-- Unmatched historical requests stay NULL and Admin-only; never delete or guess.
ALTER TABLE public.requests ADD COLUMN team_id uuid REFERENCES public.teams(id);
UPDATE public.requests r SET team_id = t.id FROM public.teams t
  WHERE t.table_number = r.table_number;
CREATE INDEX stage2_requests_team ON public.requests(team_id);
CREATE INDEX stage2_requests_assignee_team ON public.requests(claimed_by, team_id);
CREATE INDEX stage2_team_sessions_team ON public.team_sessions(team_id);

CREATE FUNCTION public.stage2_can_view_team(p_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_organizer() OR p_team_id = public.stage2_my_team_id()
    OR (public.get_current_mentor_id() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM public.requests r WHERE r.team_id = p_team_id
        AND r.claimed_by = public.get_current_mentor_id() AND r.status = 'claimed')
      OR public.stage2_can_evaluate(p_team_id)
    ));
$$;

-- Existing request integrity trigger remains in place. This companion pins the
-- new ownership field, including service-written requests and legacy table IDs.
CREATE FUNCTION public.stage2_request_team_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_table integer;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.table_number IS DISTINCT FROM OLD.table_number) THEN
    RAISE EXCEPTION 'Historical request ownership is immutable; use a reviewed repair migration';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.team_id IS NULL THEN
      SELECT id INTO NEW.team_id FROM public.teams WHERE table_number = NEW.table_number;
    END IF;
    SELECT table_number INTO v_table FROM public.teams WHERE id = NEW.team_id;
    IF v_table IS NULL OR v_table <> NEW.table_number THEN
      RAISE EXCEPTION 'A request must reference a valid matching team and table';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stage2_request_team_guard BEFORE INSERT OR UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.stage2_request_team_guard();

CREATE FUNCTION public.stage2_team_table_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Team IDs are immutable'; END IF;
  IF NEW.table_number IS DISTINCT FROM OLD.table_number AND EXISTS (
    SELECT 1 FROM public.requests WHERE team_id = OLD.id
  ) THEN RAISE EXCEPTION 'Re-seating a team with historical requests requires a reviewed migration'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stage2_team_table_guard BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.stage2_team_table_guard();

-- Replace old policies entirely: permissive policies otherwise combine with OR.
-- Preserve the access-request flow, excluding anonymous team identities.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN
      ('teams','mentors','requests','evaluations','team_sessions','activity_log','mentor_access_requests')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END $$;

-- Remove table-level grants (including TRUNCATE, which RLS does not constrain).
REVOKE ALL ON public.teams, public.mentors, public.requests, public.evaluations,
  public.team_sessions, public.activity_log, public.mentor_access_requests,
  public.evaluation_authorizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.activity_log_id_seq FROM PUBLIC, anon, authenticated;
-- Never expose password hashes to browser identities, including the Admin browser.
GRANT SELECT (id, name, table_number, created_at) ON public.teams TO authenticated;
GRANT INSERT (name, table_number), UPDATE (name, table_number) ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mentors TO authenticated;
GRANT SELECT ON public.requests, public.team_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evaluations TO authenticated;
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT USAGE ON SEQUENCE public.activity_log_id_seq TO authenticated;
GRANT SELECT, INSERT ON public.mentor_access_requests TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.evaluation_authorizations TO authenticated;

CREATE POLICY stage2_team_read ON public.teams FOR SELECT TO authenticated
  USING (public.stage2_can_view_team(id));
CREATE POLICY stage2_team_insert ON public.teams FOR INSERT TO authenticated WITH CHECK (public.is_organizer());
CREATE POLICY stage2_team_update ON public.teams FOR UPDATE TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY stage2_mentor_read ON public.mentors FOR SELECT TO authenticated
  USING (public.is_organizer() OR id = public.get_current_mentor_id());
CREATE POLICY stage2_mentor_insert ON public.mentors FOR INSERT TO authenticated WITH CHECK (public.is_organizer());
CREATE POLICY stage2_mentor_update ON public.mentors FOR UPDATE TO authenticated
  USING (public.is_organizer() OR id = public.get_current_mentor_id())
  WITH CHECK (public.is_organizer() OR (id = public.get_current_mentor_id() AND role = 'mentor'));
CREATE POLICY stage2_request_read ON public.requests FOR SELECT TO authenticated USING (
  public.is_organizer() OR team_id = public.stage2_my_team_id()
  OR claimed_by = public.get_current_mentor_id()
);
-- No direct request mutation privileges: Admin RPCs allocate; assigned RPC resolves.
CREATE POLICY stage2_session_read ON public.team_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND COALESCE(auth.jwt()->>'is_anonymous','false') = 'true');
CREATE POLICY stage2_evaluation_read ON public.evaluations FOR SELECT TO authenticated
  USING (public.is_organizer() OR mentor_id = public.get_current_mentor_id());
CREATE POLICY stage2_evaluation_insert ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer() OR (mentor_id = public.get_current_mentor_id() AND public.stage2_can_evaluate(team_id)));
CREATE POLICY stage2_evaluation_update ON public.evaluations FOR UPDATE TO authenticated
  USING (public.is_organizer() OR (mentor_id = public.get_current_mentor_id() AND public.stage2_can_evaluate(team_id)))
  WITH CHECK (public.is_organizer() OR (mentor_id = public.get_current_mentor_id() AND public.stage2_can_evaluate(team_id)));
CREATE POLICY stage2_eval_authorization_read ON public.evaluation_authorizations FOR SELECT TO authenticated
  USING (public.is_organizer() OR mentor_id = public.get_current_mentor_id());
CREATE POLICY stage2_eval_authorization_grant ON public.evaluation_authorizations FOR INSERT TO authenticated
  WITH CHECK (public.is_organizer() AND granted_by = public.get_current_mentor_id());
CREATE POLICY stage2_eval_authorization_revoke ON public.evaluation_authorizations FOR DELETE TO authenticated
  USING (public.is_organizer());
CREATE POLICY stage2_log_read ON public.activity_log FOR SELECT TO authenticated USING (public.is_organizer());
CREATE POLICY stage2_log_insert ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (actor_id = public.get_current_mentor_id()
    AND action IN ('submit_evaluation','save_draft_evaluation')
    AND entity_type = 'evaluation'
    AND EXISTS (SELECT 1 FROM public.evaluations e
      WHERE e.id = entity_id AND e.mentor_id = public.get_current_mentor_id()));
CREATE POLICY stage2_access_read ON public.mentor_access_requests FOR SELECT TO authenticated
  USING (public.is_organizer() OR (user_id = auth.uid() AND COALESCE(auth.jwt()->>'is_anonymous','false') = 'false'));
CREATE POLICY stage2_access_insert ON public.mentor_access_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND COALESCE(auth.jwt()->>'is_anonymous','false') = 'false'
    AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

-- Preserve login_team()/get_my_team() bodies, signatures and anonymous JWT checks.
-- Existing review RPC remains Admin-only through the replaced is_organizer().
-- Reset EXECUTE on every exported public function, then allow only required RPCs.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature); END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.is_organizer(), public.get_current_mentor_id(),
  public.stage2_my_team_id(), public.stage2_can_view_team(uuid), public.stage2_can_evaluate(uuid),
  public.login_team(text,text), public.get_my_team(), public.claim_request(uuid,uuid),
  public.release_request(uuid), public.resolve_request(uuid),
  public.review_mentor_access_request(uuid,text) TO authenticated;
-- log_activity() is unused by the app and returns uuid despite bigint log IDs.
-- Keep it intact for history; no browser EXECUTE until separately repaired.

-- Trigger guard closes RPC self-claim/release even if an old function body is
-- accidentally restored. Admin allocation uses existing atomic, audited RPCs.
CREATE FUNCTION public.stage2_allocation_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_organizer() THEN
    IF NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
       OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
       OR NEW.status = 'open' AND OLD.status <> 'open' THEN
      RAISE EXCEPTION 'Only the Admin can allocate or release mentor requests' USING ERRCODE = '42501';
    END IF;
    IF public.get_current_mentor_id() IS NULL
       OR OLD.claimed_by IS DISTINCT FROM public.get_current_mentor_id()
       OR OLD.status <> 'claimed' OR NEW.status <> 'resolved' THEN
      RAISE EXCEPTION 'Mentors may only resolve their assigned requests' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stage2_allocation_guard BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.stage2_allocation_guard();
REVOKE ALL ON FUNCTION public.stage2_preserve_admin(), public.stage2_request_team_guard(),
  public.stage2_team_table_guard(), public.stage2_allocation_guard() FROM PUBLIC, anon, authenticated;

-- Reuse the existing immutable audit log; browser inserts cannot forge these actions.
CREATE FUNCTION public.stage2_evaluator_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_team uuid; v_mentor uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_team := NEW.team_id; v_mentor := NEW.mentor_id;
  ELSE v_team := OLD.team_id; v_mentor := OLD.mentor_id; END IF;
  INSERT INTO public.activity_log(actor_id,action,entity_type,entity_id,details)
  VALUES (public.get_current_mentor_id(),
    CASE WHEN TG_OP = 'INSERT' THEN 'grant_evaluator' ELSE 'revoke_evaluator' END,
    'evaluation_authorization', v_team,
    jsonb_build_object('team_id',v_team,'mentor_id',v_mentor));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stage2_evaluator_audit AFTER INSERT OR DELETE ON public.evaluation_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.stage2_evaluator_audit();
REVOKE ALL ON FUNCTION public.stage2_evaluator_audit() FROM PUBLIC, anon, authenticated;

-- Future postgres-owned public objects must explicitly grant browser privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
-- A schema-local REVOKE cannot cancel PostgreSQL's global PUBLIC EXECUTE default.
-- This affects only FUTURE postgres-owned functions, across schemas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Function bodies below are recovered from the export with ONLY an early Admin
-- guard added to claim/release and a staff guard added to resolve. See generator.
-- END CORE; recovered RPC definitions and COMMIT are appended by preparation.
-- BEGIN RECOVERED RPCS
CREATE OR REPLACE FUNCTION public.claim_request(p_request_id uuid, p_mentor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_target_mentor RECORD;
  v_request RECORD;
BEGIN
  IF NOT public.is_organizer() THEN
    RAISE EXCEPTION 'Only the Admin can allocate or release requests' USING ERRCODE = '42501';
  END IF;

  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  IF p_mentor_id IS NULL THEN
    RAISE EXCEPTION 'Mentor ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Authorize: Ordinary mentors can only claim for themselves; organizers can assign to any mentor
  IF v_caller_mentor.role <> 'organizer' AND v_caller_mentor.id <> p_mentor_id THEN
    RAISE EXCEPTION 'Unauthorized: mentors can only claim requests for themselves';
  END IF;

  -- 5. Validate that target mentor exists
  SELECT * INTO v_target_mentor FROM public.mentors WHERE id = p_mentor_id;
  IF v_target_mentor IS NULL THEN
    RAISE EXCEPTION 'Target mentor not found';
  END IF;

  -- 6. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 7. Ensure request is open
  IF v_request.status <> 'open' THEN
    RAISE EXCEPTION 'Request is already claimed or resolved';
  END IF;

  -- 8. Apply claim update
  UPDATE public.requests
  SET status = 'claimed',
      claimed_by = p_mentor_id,
      claimed_at = now()
  WHERE id = p_request_id;

  -- 9. Log activity using the authenticated caller as actor
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'claim_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'claimed_by', p_mentor_id,
      'claimed_by_name', v_target_mentor.name,
      'caller_id', v_caller_mentor.id,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id, 'claimed_by', p_mentor_id);
END;
$function$;
CREATE OR REPLACE FUNCTION public.release_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_request RECORD;
BEGIN
  IF NOT public.is_organizer() THEN
    RAISE EXCEPTION 'Only the Admin can allocate or release requests' USING ERRCODE = '42501';
  END IF;

  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 5. Verify request is claimed
  IF v_request.status <> 'claimed' THEN
    RAISE EXCEPTION 'Request is not currently claimed';
  END IF;

  -- 6. Authorize: Only assigned mentor or organizer can release
  IF v_caller_mentor.role <> 'organizer' AND (v_request.claimed_by IS NULL OR v_request.claimed_by <> v_caller_mentor.id) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned mentor or organizer can release this request';
  END IF;

  -- 7. Apply release update
  UPDATE public.requests
  SET status = 'open',
      claimed_by = NULL,
      claimed_at = NULL
  WHERE id = p_request_id;

  -- 8. Log activity
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'release_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'released_by', v_caller_mentor.id,
      'previous_claim', v_request.claimed_by,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$function$;
CREATE OR REPLACE FUNCTION public.resolve_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller_user_id UUID;
  v_caller_mentor RECORD;
  v_request RECORD;
  v_duration_seconds NUMERIC;
BEGIN
  IF public.get_current_mentor_id() IS NULL THEN
    RAISE EXCEPTION 'A non-anonymous staff identity is required' USING ERRCODE = '42501';
  END IF;

  -- 1. Validate caller authentication
  v_caller_user_id := auth.uid();
  IF v_caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Validate input parameters
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request ID is required';
  END IF;

  -- 3. Fetch caller mentor profile
  SELECT * INTO v_caller_mentor FROM public.mentors WHERE user_id = v_caller_user_id;
  IF v_caller_mentor IS NULL THEN
    RAISE EXCEPTION 'Current user has no linked mentor profile';
  END IF;

  -- 4. Concurrency lock on the request row
  SELECT * INTO v_request FROM public.requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 5. Verify request is claimed
  IF v_request.status <> 'claimed' THEN
    RAISE EXCEPTION 'Request is not in claimed state';
  END IF;

  -- 6. Authorize: Only assigned mentor or organizer can resolve
  IF v_caller_mentor.role <> 'organizer' AND (v_request.claimed_by IS NULL OR v_request.claimed_by <> v_caller_mentor.id) THEN
    RAISE EXCEPTION 'Unauthorized: only assigned mentor or organizer can resolve this request';
  END IF;

  IF v_request.claimed_at IS NOT NULL THEN
    v_duration_seconds := ROUND(EXTRACT(EPOCH FROM (now() - v_request.claimed_at)));
  ELSE
    v_duration_seconds := NULL;
  END IF;

  -- 7. Apply resolve update
  UPDATE public.requests
  SET status = 'resolved',
      resolved_at = now()
  WHERE id = p_request_id;

  -- 8. Log activity
  INSERT INTO public.activity_log (actor_id, action, entity_type, entity_id, details)
  VALUES (
    v_caller_mentor.id,
    'resolve_request',
    'request',
    p_request_id,
    jsonb_build_object(
      'resolved_by', v_caller_mentor.id,
      'duration_seconds', v_duration_seconds,
      'table', v_request.table_number
    )
  );

  RETURN jsonb_build_object('success', true, 'id', p_request_id);
END;
$function$;
COMMIT;
