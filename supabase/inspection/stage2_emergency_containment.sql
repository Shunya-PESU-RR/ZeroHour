-- REVIEW ONLY. Post-commit emergency containment, NOT a restore of broad policies.
-- Run only after explicit operator approval. Causes browser operations outage.
-- Preserves all data and keeps the original anonymous team identity login usable.
BEGIN;
REVOKE ALL ON public.teams, public.mentors, public.requests, public.evaluations,
  public.team_sessions, public.activity_log, public.mentor_access_requests,
  public.evaluation_authorizations FROM PUBLIC, anon, authenticated;
-- Column ACLs survive table-level REVOKE; remove the explicit safe-column grants too.
REVOKE SELECT (id,name,table_number,created_at), INSERT (name,table_number), UPDATE (name,table_number)
  ON public.teams FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF to_regclass('public.tracks') IS NOT NULL THEN
    REVOKE ALL ON public.tracks, public.problem_statements, public.mentor_tracks FROM PUBLIC, anon, authenticated;
    REVOKE SELECT(track_id,problem_statement_id), UPDATE(track_id,problem_statement_id)
      ON public.teams FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
REVOKE ALL ON SEQUENCE public.activity_log_id_seq FROM PUBLIC, anon, authenticated;
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature); END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.login_team(text,text), public.get_my_team() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
