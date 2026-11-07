-- ISOLATED validation, before migration, SAME psql session as migration/check.
-- Stores only row fingerprints/IDs in session-temporary tables; prints no content.
-- Credential hashes are deliberately excluded from the team fingerprint.
DO $$ BEGIN
  IF current_setting('zerohour.test_environment',true) IS DISTINCT FROM 'isolated' THEN
    RAISE EXCEPTION 'History test requires disposable isolated environment';
  END IF;
END $$;
CREATE TEMP TABLE stage2_history_before AS
SELECT 'teams'::text AS entity,id::text AS id,
  md5((to_jsonb(t)-'access_code_hash'-'track_id'-'problem_statement_id')::text) AS fingerprint FROM public.teams t
UNION ALL SELECT 'mentors',id::text,md5(to_jsonb(m)::text) FROM public.mentors m
UNION ALL SELECT 'requests',id::text,md5((to_jsonb(r)-'team_id')::text) FROM public.requests r
UNION ALL SELECT 'evaluations',id::text,md5(to_jsonb(e)::text) FROM public.evaluations e
UNION ALL SELECT 'team_sessions',user_id::text,md5(to_jsonb(s)::text) FROM public.team_sessions s;
