-- REVIEW DRAFT. Requires 202611050001. No final event content is seeded.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stage2_track_name ON public.tracks(lower(trim(name)));
CREATE TABLE public.problem_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  statement text NOT NULL CHECK (length(trim(statement)) > 0),
  instructions text NOT NULL DEFAULT '',
  resource_url text CHECK (resource_url IS NULL OR resource_url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, track_id)
);
CREATE INDEX stage2_problem_track ON public.problem_statements(track_id);
CREATE TABLE public.mentor_tracks (
  mentor_id uuid NOT NULL REFERENCES public.mentors(id),
  track_id uuid NOT NULL REFERENCES public.tracks(id),
  PRIMARY KEY (mentor_id, track_id)
);
CREATE INDEX stage2_mentor_tracks_track ON public.mentor_tracks(track_id);
ALTER TABLE public.teams
  ADD COLUMN track_id uuid REFERENCES public.tracks(id),
  ADD COLUMN problem_statement_id uuid,
  ADD CONSTRAINT stage2_problem_requires_track CHECK (problem_statement_id IS NULL OR track_id IS NOT NULL),
  ADD CONSTRAINT stage2_team_problem_track FOREIGN KEY (problem_statement_id, track_id)
    REFERENCES public.problem_statements(id, track_id);
CREATE INDEX stage2_teams_track ON public.teams(track_id);
CREATE INDEX stage2_teams_problem_track ON public.teams(problem_statement_id, track_id);
-- All old teams have NULL assignments. Populate only from Admin-approved mapping.

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_tracks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tracks, public.problem_statements, public.mentor_tracks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracks, public.problem_statements, public.mentor_tracks TO authenticated;
GRANT SELECT (track_id, problem_statement_id), UPDATE (track_id, problem_statement_id) ON public.teams TO authenticated;

CREATE FUNCTION public.stage2_can_view_track(p_track_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_organizer()
    OR EXISTS (SELECT 1 FROM public.teams t
      WHERE t.track_id = p_track_id AND public.stage2_can_view_team(t.id))
    OR EXISTS (SELECT 1 FROM public.mentor_tracks mt
      WHERE mt.track_id = p_track_id AND mt.mentor_id = public.get_current_mentor_id());
$$;
CREATE FUNCTION public.stage2_can_view_problem(p_problem_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_organizer() OR EXISTS (
    SELECT 1 FROM public.teams t WHERE t.problem_statement_id = p_problem_id
      AND public.stage2_can_view_team(t.id)
  );
$$;
REVOKE ALL ON FUNCTION public.stage2_can_view_track(uuid), public.stage2_can_view_problem(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage2_can_view_track(uuid), public.stage2_can_view_problem(uuid) TO authenticated;

CREATE POLICY stage2_track_read ON public.tracks FOR SELECT TO authenticated USING (public.stage2_can_view_track(id));
CREATE POLICY stage2_track_manage ON public.tracks FOR ALL TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY stage2_problem_read ON public.problem_statements FOR SELECT TO authenticated USING (public.stage2_can_view_problem(id));
CREATE POLICY stage2_problem_manage ON public.problem_statements FOR ALL TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());
CREATE POLICY stage2_mentor_track_read ON public.mentor_tracks FOR SELECT TO authenticated
  USING (public.is_organizer() OR mentor_id = public.get_current_mentor_id());
CREATE POLICY stage2_mentor_track_manage ON public.mentor_tracks FOR ALL TO authenticated
  USING (public.is_organizer()) WITH CHECK (public.is_organizer());

-- Additive RPC: old get_my_team() return signature and login behavior stay intact.
-- No table SELECT *, no credential/hash fields, NULL means not assigned.
CREATE FUNCTION public.get_my_team_overview()
RETURNS TABLE (
  team_id uuid, team_name text, table_number integer,
  track_id uuid, track_name text, track_description text,
  problem_statement_id uuid, problem_title text, problem_statement text,
  problem_instructions text, problem_resource_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id, t.name, t.table_number, tr.id, tr.name, tr.description,
    ps.id, ps.title, ps.statement, ps.instructions, ps.resource_url
  FROM public.team_sessions s JOIN public.teams t ON t.id = s.team_id
  LEFT JOIN public.tracks tr ON tr.id = t.track_id
  LEFT JOIN public.problem_statements ps ON ps.id = t.problem_statement_id AND ps.track_id = t.track_id
  WHERE s.user_id = auth.uid()
    AND COALESCE(auth.jwt()->>'is_anonymous', 'false') = 'true';
$$;
REVOKE ALL ON FUNCTION public.get_my_team_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_team_overview() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
