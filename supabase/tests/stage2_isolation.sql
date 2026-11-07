-- ISOLATED SUPABASE ONLY. Not run by preparation. psql, ON_ERROR_STOP required.
-- Run after the three proposed migrations against a disposable Supabase database.
-- Before running: SET zerohour.test_environment = 'isolated';
-- Uses synthetic auth.users rows, never passwords. All fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_setting('zerohour.test_environment', true) IS DISTINCT FROM 'isolated' THEN
    RAISE EXCEPTION 'Refusing tests without explicit isolated-environment acknowledgement';
  END IF;
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Test setup requires postgres'; END IF;
END $$;

CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', message; END IF; END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean := false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN RAISE; END IF;
    caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Expected SQLSTATE % for %', expected_state, statement; END IF;
END $$;

CREATE TEMP TABLE stage2_fixture AS SELECT
  (SELECT user_id FROM public.mentors WHERE role='organizer') admin_user,
  (SELECT id FROM public.mentors WHERE role='organizer') admin_mentor,
  gen_random_uuid() team_a_user, gen_random_uuid() team_b_user,
  gen_random_uuid() mentor_a_user, gen_random_uuid() mentor_b_user,
  gen_random_uuid() team_a, gen_random_uuid() team_b,
  gen_random_uuid() mentor_a, gen_random_uuid() mentor_b,
  gen_random_uuid() request_a, gen_random_uuid() request_b,
  gen_random_uuid() track_a, gen_random_uuid() track_b,
  gen_random_uuid() problem_a, gen_random_uuid() problem_b;
GRANT SELECT ON stage2_fixture TO authenticated, anon;
SELECT pg_temp.assert_true(admin_user IS NOT NULL, 'one staging Admin exists') FROM stage2_fixture;
-- Standard Supabase auth.users fixture contract; validate in disposable staging.
INSERT INTO auth.users (id, is_anonymous)
SELECT team_a_user, true FROM stage2_fixture UNION ALL SELECT team_b_user, true FROM stage2_fixture
UNION ALL SELECT mentor_a_user, false FROM stage2_fixture UNION ALL SELECT mentor_b_user, false FROM stage2_fixture;
INSERT INTO public.mentors(id,user_id,name,role)
SELECT mentor_a,mentor_a_user,'Stage2 test mentor A','mentor' FROM stage2_fixture
UNION ALL SELECT mentor_b,mentor_b_user,'Stage2 test mentor B','mentor' FROM stage2_fixture;
-- Deliberate collision fails rather than modifying any pre-existing record.
INSERT INTO public.teams(id,name,table_number,access_code_hash)
SELECT team_a,'Stage2 isolated team A',2147483646,extensions.crypt('stage2-test-only',extensions.gen_salt('bf')) FROM stage2_fixture
UNION ALL SELECT team_b,'Stage2 isolated team B',2147483647,extensions.crypt('stage2-test-only',extensions.gen_salt('bf')) FROM stage2_fixture;
INSERT INTO public.tracks(id,name) SELECT track_a,'Stage2 isolated track A' FROM stage2_fixture
UNION ALL SELECT track_b,'Stage2 isolated track B' FROM stage2_fixture;
INSERT INTO public.problem_statements(id,track_id,title,statement)
SELECT problem_a,track_a,'Test A','Synthetic problem A' FROM stage2_fixture
UNION ALL SELECT problem_b,track_b,'Test B','Synthetic problem B' FROM stage2_fixture;
UPDATE public.teams SET track_id=f.track_a,problem_statement_id=f.problem_a FROM stage2_fixture f WHERE id=f.team_a;
UPDATE public.teams SET track_id=f.track_b,problem_statement_id=f.problem_b FROM stage2_fixture f WHERE id=f.team_b;
INSERT INTO public.requests(id,table_number,issue)
SELECT request_a,2147483646,'Synthetic request A' FROM stage2_fixture
UNION ALL SELECT request_b,2147483647,'Synthetic request B' FROM stage2_fixture;
INSERT INTO public.evaluations(team_id,mentor_id,scores,status)
SELECT team_a,mentor_a,'{"idea":5,"tech":5,"impact":5,"pitch":5}'::jsonb,'submitted' FROM stage2_fixture;
CREATE TEMP TABLE stage2_history AS SELECT * FROM public.evaluations;

-- Team login success, ownership, invalid/empty login, protected columns.
SELECT set_config('request.jwt.claim.sub',team_a_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',team_a_user,'role','authenticated','is_anonymous',true)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.login_team('Stage2 isolated team A','stage2-test-only')), 'existing login_team success');
SELECT pg_temp.assert_true((SELECT team_id=(SELECT team_a FROM stage2_fixture) FROM public.get_my_team()), 'existing get_my_team identity');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.login_team('Stage2 isolated team B','wrong')), 'wrong access code rejected');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.login_team('', '')), 'empty login rejected');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.teams), 'team sees only its own team');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.mentors), 'team sees no private mentors');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.requests), 'team sees only own requests');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.evaluations), 'team cannot read even own submitted evaluations');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.tracks), 'team sees only authorized track');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.problem_statements), 'team sees only assigned problem');
SELECT pg_temp.assert_true((SELECT track_name='Stage2 isolated track A' AND problem_statement='Synthetic problem A' FROM public.get_my_team_overview()), 'overview contract');
SELECT pg_temp.expect_error('SELECT access_code_hash FROM public.teams','42501');
SELECT pg_temp.expect_error('TRUNCATE public.teams','42501');
SELECT pg_temp.expect_error('UPDATE public.team_sessions SET team_id=gen_random_uuid()','42501');
SELECT pg_temp.expect_error('SELECT public.claim_request((SELECT request_a FROM stage2_fixture),(SELECT mentor_a FROM stage2_fixture))','42501');
RESET ROLE;

-- A different team cannot see A's requests or change its login binding directly.
SELECT set_config('request.jwt.claim.sub',team_b_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',team_b_user,'role','authenticated','is_anonymous',true)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.login_team('Stage2 isolated team B','stage2-test-only')), 'team B login');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.requests WHERE id=(SELECT request_a FROM stage2_fixture)), 'cross-team isolation');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.teams WHERE id=(SELECT team_a FROM stage2_fixture)), 'cross-team roster isolation');
RESET ROLE;

-- Admin assignment, release, immutable singleton and separate evaluator grants.
SELECT set_config('request.jwt.claim.sub',admin_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.is_organizer(), 'Admin recognized');
SELECT public.claim_request(request_a,mentor_a) FROM stage2_fixture;
SELECT public.release_request(request_a) FROM stage2_fixture;
SELECT public.claim_request(request_a,mentor_a) FROM stage2_fixture;
SELECT pg_temp.expect_error('UPDATE public.mentors SET role=''organizer'' WHERE id=(SELECT mentor_b FROM stage2_fixture)','23505');
SELECT pg_temp.expect_error('UPDATE public.mentors SET role=''mentor'' WHERE id=(SELECT admin_mentor FROM stage2_fixture)','P0001');
SELECT pg_temp.expect_error('UPDATE public.teams SET problem_statement_id=(SELECT problem_b FROM stage2_fixture) WHERE id=(SELECT team_a FROM stage2_fixture)','23503');
RESET ROLE;

-- Assigned mentor: no self-claim/release, own history only, explicit grading gate.
SELECT set_config('request.jwt.claim.sub',mentor_a_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',mentor_a_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.is_organizer(), 'mentor is not Admin');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_my_team()), 'staff cannot use team identity RPC');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.requests), 'mentor only sees assigned request');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.teams), 'mentor only sees active assigned team');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.mentors), 'mentor only sees own profile');
SELECT pg_temp.expect_error('SELECT public.claim_request((SELECT request_b FROM stage2_fixture),(SELECT mentor_a FROM stage2_fixture))','42501');
SELECT pg_temp.expect_error('SELECT public.release_request((SELECT request_a FROM stage2_fixture))','42501');
SELECT pg_temp.assert_true(NOT public.stage2_can_evaluate((SELECT team_a FROM stage2_fixture)), 'assistance does not grant evaluation permission');
SELECT pg_temp.expect_error('INSERT INTO public.evaluations(team_id,mentor_id) SELECT team_b,mentor_a FROM stage2_fixture','42501');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.evaluations WHERE team_id=(SELECT team_b FROM stage2_fixture)), 'no foreign scores');
RESET ROLE;

-- Unassigned mentor cannot see the request or resolve it via SECURITY DEFINER.
SELECT set_config('request.jwt.claim.sub',mentor_b_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',mentor_b_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.requests), 'unassigned mentor sees no requests');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.teams), 'unassigned mentor sees no teams');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.evaluations), 'unassigned mentor sees no scores');
SELECT pg_temp.expect_error('SELECT public.resolve_request((SELECT request_a FROM stage2_fixture))','P0001');
RESET ROLE;

-- Explicit grant allows the existing draft/upsert evaluation contract.
SELECT set_config('request.jwt.claim.sub',admin_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
INSERT INTO public.evaluation_authorizations(team_id,mentor_id,granted_by)
SELECT team_a,mentor_a,admin_mentor FROM stage2_fixture
UNION ALL SELECT team_b,mentor_a,admin_mentor FROM stage2_fixture;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',mentor_a_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',mentor_a_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.stage2_can_evaluate((SELECT team_a FROM stage2_fixture)), 'explicit evaluator grant');
UPDATE public.evaluations SET comment='Authorized test edit' WHERE team_id=(SELECT team_a FROM stage2_fixture);
INSERT INTO public.evaluations(team_id,mentor_id,scores,status)
SELECT team_b,mentor_a,'{"idea":5,"tech":5,"impact":5,"pitch":5}'::jsonb,'draft' FROM stage2_fixture;
SELECT pg_temp.assert_true((SELECT status='draft' FROM public.evaluations WHERE team_id=(SELECT team_b FROM stage2_fixture)), 'authorized draft saved');
UPDATE public.evaluations SET status='submitted' WHERE team_id=(SELECT team_b FROM stage2_fixture);
SELECT pg_temp.assert_true((SELECT status='submitted' AND submitted_at IS NOT NULL FROM public.evaluations WHERE team_id=(SELECT team_b FROM stage2_fixture)), 'authorized submission saved');
SELECT pg_temp.expect_error('INSERT INTO public.evaluation_authorizations(team_id,mentor_id,granted_by) SELECT team_b,mentor_b,mentor_a FROM stage2_fixture','42501');
SELECT pg_temp.expect_error('INSERT INTO public.activity_log(actor_id,action,entity_type,entity_id) SELECT mentor_a,''claim_request'',''request'',request_b FROM stage2_fixture','42501');
SELECT public.resolve_request(request_a) FROM stage2_fixture;
SELECT pg_temp.assert_true((SELECT status='resolved' FROM public.requests WHERE id=(SELECT request_a FROM stage2_fixture)), 'assigned resolve succeeds');
RESET ROLE;

-- Revoking authorization preserves scores but blocks subsequent mentor writes.
SELECT set_config('request.jwt.claim.sub',admin_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
DELETE FROM public.evaluation_authorizations WHERE team_id=(SELECT team_b FROM stage2_fixture);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',mentor_a_user::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',mentor_a_user,'role','authenticated','is_anonymous',false)::text,true)
FROM stage2_fixture;
SET LOCAL ROLE authenticated;
WITH changed AS (UPDATE public.evaluations SET comment='Must not be written'
  WHERE team_id=(SELECT team_b FROM stage2_fixture) RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed), 'revoked evaluator cannot edit');
SELECT pg_temp.assert_true((SELECT status='submitted' FROM public.evaluations WHERE team_id=(SELECT team_b FROM stage2_fixture)), 'revocation retained historical score');
RESET ROLE;

-- Anonymous without an Auth session has no direct table/RPC access.
SELECT set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE anon;
SELECT pg_temp.expect_error('SELECT id FROM public.teams','42501');
SELECT pg_temp.expect_error('SELECT public.get_my_team()','42501');
SELECT pg_temp.expect_error('SELECT public.claim_request(gen_random_uuid(),gen_random_uuid())','42501');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.mentors WHERE role='organizer'), 'exactly one Admin retained');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT id FROM stage2_history EXCEPT SELECT id FROM public.evaluations), 'evaluation identities retained');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.requests WHERE id IN (SELECT request_a FROM stage2_fixture UNION SELECT request_b FROM stage2_fixture)), 'request identities retained');
ROLLBACK;
\echo Stage 2 isolated assertions completed; all fixtures rolled back.
