-- Read-only post-migration checks. Run as operator; no private record contents.
BEGIN TRANSACTION READ ONLY;
SELECT count(*) AS organizer_count_must_be_one FROM public.mentors WHERE role='organizer';
SELECT count(*) AS unmatched_historical_requests_admin_only FROM public.requests WHERE team_id IS NULL;
SELECT count(*) AS mismatched_request_tables_must_be_zero FROM public.requests r
  JOIN public.teams t ON t.id=r.team_id WHERE r.table_number<>t.table_number;
SELECT count(*) AS inconsistent_problem_tracks_must_be_zero FROM public.teams t
  JOIN public.problem_statements p ON p.id=t.problem_statement_id WHERE t.track_id IS DISTINCT FROM p.track_id;
SELECT has_table_privilege('anon','public.teams','TRUNCATE') AS anon_truncate_must_be_false,
  has_table_privilege('authenticated','public.teams','TRUNCATE') AS authenticated_truncate_must_be_false,
  has_column_privilege('authenticated','public.teams','access_code_hash','SELECT') AS hash_read_must_be_false;
SELECT p.oid::regprocedure AS function, p.prosecdef, p.proconfig, p.proacl,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute_must_be_false
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname LIKE 'stage2_%' OR p.proname IN
 ('claim_request','release_request','resolve_request','login_team','get_my_team','get_my_team_overview','bootstrap_first_organizer'));
SELECT schemaname,tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;
SELECT c.relname,c.relrowsecurity,c.relreplident FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT * FROM pg_publication_tables WHERE schemaname='public';
-- Compare counts privately with pre-migration operator-recorded counts.
SELECT 'teams' AS entity,count(*) FROM public.teams
UNION ALL SELECT 'mentors',count(*) FROM public.mentors
UNION ALL SELECT 'requests',count(*) FROM public.requests
UNION ALL SELECT 'evaluations',count(*) FROM public.evaluations
UNION ALL SELECT 'team_sessions',count(*) FROM public.team_sessions;
COMMIT;
