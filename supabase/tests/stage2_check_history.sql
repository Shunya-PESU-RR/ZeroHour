-- ISOLATED validation after migrations, SAME session as stage2_capture_history.sql.
DO $$ BEGIN
  IF current_setting('zerohour.test_environment',true) IS DISTINCT FROM 'isolated' THEN
    RAISE EXCEPTION 'History test requires disposable isolated environment';
  END IF;
END $$;
CREATE TEMP TABLE stage2_history_after AS
SELECT 'teams'::text AS entity,id::text AS id,
  md5((to_jsonb(t)-'access_code_hash'-'track_id'-'problem_statement_id')::text) AS fingerprint FROM public.teams t
UNION ALL SELECT 'mentors',id::text,md5(to_jsonb(m)::text) FROM public.mentors m
UNION ALL SELECT 'requests',id::text,md5((to_jsonb(r)-'team_id')::text) FROM public.requests r
UNION ALL SELECT 'evaluations',id::text,md5(to_jsonb(e)::text) FROM public.evaluations e
UNION ALL SELECT 'team_sessions',user_id::text,md5(to_jsonb(s)::text) FROM public.team_sessions s;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM stage2_history_before b FULL JOIN stage2_history_after a USING(entity,id)
    WHERE b.fingerprint IS DISTINCT FROM a.fingerprint
  ) THEN RAISE EXCEPTION 'Migration changed existing identity/history fields'; END IF;
END $$;
-- No fixture cleanup needed: temporary snapshots disappear when the session ends.
