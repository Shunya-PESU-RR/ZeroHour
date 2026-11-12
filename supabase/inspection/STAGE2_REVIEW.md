# Stage 2 security and schema review

Status: **prepared, NOT applied, NOT live**. No frontend, authentication client,
production database, or deployment has been modified. Do not run these files yet.

## Authoritative contract and findings

The complete CSV contains 200 metadata rows: 8 relations (7 tables and a
sequence), 47 columns, 27 constraints, 23 indexes, 23 policies, 17 functions,
6 triggers, schema/default grants, 4 publication memberships, and role metadata.
SHA256: `EDD64E53B603DEA7991E43487039D9711DFE2BE080F25C027EB87A2626CE2AE1`.

Verified from definitions, not by executing against the deployment:

- `login_team(text,text)` checks an authenticated anonymous JWT, verifies
  `teams.access_code_hash` via `extensions.crypt`, and upserts `team_sessions`
  by `user_id`. Failed credentials return no row and leave any old binding intact.
- `get_my_team()` returns `(team_id uuid, team_name text, table_number integer)`
  through that binding, and requires the anonymous JWT flag.
- Both functions are postgres-owned SECURITY DEFINER with empty search_path.
  Neither definition/signature is changed by these drafts.
- The UNIQUE `teams.table_number` enables a current-table request mapping; it
  does NOT prove a table was never reused historically. This requires operator review.
- Public client roles currently hold TRUNCATE privileges, not protected by RLS.
- Broad SELECT policies expose unrelated teams, mentor identities, requests, and
  submitted scores to authenticated identities, including anonymous-auth teams.
- Readable team rows include access-code hashes; raw team replication publishes
  that column too. Column privileges and actual Realtime payloads need scrutiny.
- Claim permits mentor self-claim; release permits assigned-mentor self-release.
- No single-organizer constraint, tracks, problems, or evaluator assignments exist.
- `log_activity()` declares a uuid return variable but activity_log.id is bigint.
  The app instead inserts activity_log directly. Browser EXECUTE is removed from
  this unused broken RPC; its definition is retained for a separate repair.

## Proposed migrations, in order

1. `202611050000_stage2_preflight.sql`: compares all 17 function fingerprints and
   grants, all 23 policy expressions/roles/commands, and all exported column types
   and nullability. Abort on drift and request a fresh export. This is a guard,
   not a full database baseline or a complete dependency/extension inventory.
2. `202611050001_stage2_security.sql`: locks affected writes, requires exactly one
   existing organizer and explicit operator confirmation of its user UUID. A unique
   partial index prevents a second organizer; a trigger prevents deleting,
   demoting, or rebinding the sole organizer (including auth-user cascade deletion).
   It restricts anonymous team identities through team_sessions, scopes staff reads,
   removes public TRUNCATE and dangerous grants, and removes browser access to
   credential hashes. Admins allocate/release with existing audited, row-locked
   RPCs. Mentors may resolve only their assigned requests. Companion triggers
   enforce allocation and ownership independently of the RPC guard.
3. `202611050002_stage2_tracks.sql`: creates tracks, problem_statements,
   mentor_tracks and nullable team links. A composite FK prevents assigning a
   problem from another track. No final track names/content are invented. Adds
   `get_my_team_overview()` without changing old team login/identity contracts.

All files are explicit transactions, fail on existing objects rather than masking
conflicting schemas, and contain no DROP TABLE, history deletion, or database reset.
They are one-time versioned migrations, not rerunnable bootstrap scripts.
Do not rerun the older local 20261020 migration: it reinstates broad policies.
Do not use blanket `supabase db push` until migration history/baseline is reconciled.
The older migration is not a complete CREATE TABLE baseline.

## Minimal evaluation dependency

`evaluation_authorizations(team_id,mentor_id,granted_by,granted_at)` is a small
explicit Admin-controlled allowlist needed to enforce authorized evaluation writes.
It has no round/rubric/scoring fields. Existing scores and the existing unique
`(team_id,mentor_id)` constraint are retained unchanged. Assistance does not imply
evaluation permission. **No automatic evaluator backfill** is performed from old
scores; that would invent authorization. Existing own evaluations remain readable,
but mentors cannot save/submit until the Admin grants that pair explicitly.

After review and application, the Admin may INSERT an approved pair with
`granted_by = get_current_mentor_id()`. Revocation deletes only that permission,
never evaluations. Grant/revoke operations are transactionally recorded in the
existing immutable activity_log. Full round/rubric revision history remains a later stage.

## Admin confirmation and backfills — before any approved execution

The operator must privately confirm the existing organizer's `user_id`, `id`, and
`name` in Studio, and confirm its Auth identity is the intended non-anonymous Admin.
Do not send passwords/access codes. No account is created or automatically promoted.
Zero or multiple organizers abort the migration; resolve ambiguity through a
separately approved identity/data repair, not arbitrary row selection.

In the SAME database session that would run the migration files, set:

```sql
SET zerohour.authorized_admin_user_id = '<confirmed-existing-Auth-user-UUID>';
SET zerohour.confirm_table_history = 'reviewed';
```

The latter is an acknowledgement, not proof: certify historical requests' table
numbers still identify the same teams. If tables have been reused or ownership is
uncertain, STOP: revise the backfill to an explicitly reviewed request-ID/team-ID
mapping. Do not set the acknowledgement simply to bypass this gate.

Record private pre-migration counts/IDs for teams, staff, sessions, requests and
evaluations. Backfill matched requests once; unmatched requests retain NULL team_id,
their original fields/status/history, and Admin-only visibility. Request ownership
is then immutable. Repair unmatched records only in a separate reviewed operator
migration. Existing team IDs, auth session bindings, access-code hashes and scores
are not rewritten. Teams without tracks/problems remain NULL until explicit Admin
configuration. No fictional phases or problem statements are seeded.

## Trigger and grant compatibility

- Existing request timestamp/state-machine triggers remain: `open/claimed/resolved`,
  no reopen or cancellation is added. Reassignment remains an Admin release followed
  by assignment; an atomic reassignment workflow/history belongs to Stage 3.
- Existing mentor identity, evaluation identity/timestamp, and log-actor triggers
  remain. New guards have distinct names and do not disable old protections.
- Existing bootstrap retains its service-role-only grant, but cannot create a
  second Admin or demote/delete the protected Admin. Trusted database operators
  can alter schema; application guarantees cannot constrain a schema owner.
- Function EXECUTE is explicitly reset for browser roles on public functions;
  trigger/event-trigger functions are not public callable RPCs. Required helpers,
  ownership RPCs and protected operations are regranted only to authenticated.
  All new SECURITY DEFINER helpers have empty search_path and qualified relations.
- Existing mentor access request review still uses its SECURITY DEFINER RPC and
  `is_organizer()`. Anonymous team users no longer submit mentor access applications.
- postgres-owned future public objects default to no browser grants. A global
  postgres function-default PUBLIC EXECUTE revoke is required because a schema-local
  revoke cannot cancel the built-in global default; it affects future postgres-owned
  functions across schemas, not existing functions. Review this scope explicitly. Existing
  supabase_admin-owned defaults remain: objects created as that managed role must
  still be explicitly hardened. Do not blindly alter managed-role defaults.
- No direct client INSERT/UPDATE/DELETE on requests or DELETE on history tables.
  Direct log inserts are limited to own evaluation events; administrative allocation
  and evaluator-authorization audit actions can only be emitted by trusted RPCs/triggers.
  Admin team inserts intentionally omit access-code hash writes; credential setup
  remains a trusted operator operation until a separately reviewed provisioning flow.

## Minimal frontend plan — NOT implemented

| File | Coordinated change after backend approval/testing |
| --- | --- |
| src/pages/TeamDashboard.jsx | Load get_my_team_overview with teamSupabase; show returned identity, track name/description, full problem/instructions and validated HTTPS resource link. NULL => “To be announced”. Keep current session/logout semantics. |
| src/pages/Dashboard.jsx | Remove mentor Claim and Release controls; show assigned requests and Resolve. Keep Admin allocation. Display assigned team via request.team_id instead of joining on mutable table number. |
| src/lib/api.js | Map request.team_id and new team links; keep explicit safe team column selectors. Scope evaluation options to evaluation_authorizations, separately from assistance assignments. Handle denied operations without direct-update fallbacks. |
| src/components/evaluation/EvaluationForm.jsx | Offer only authorized team choices for mentors; Admin retains all-team access. Explain missing authorization clearly. |
| src/components/Layouts.jsx / src/App.jsx | Preserve authentication guards. Restrict mentor full-leaderboard navigation until a separately approved aggregate publication contract exists. |

No chat/clock/timeline/dynamic-round UI is made live. Keep those sections explicitly
upcoming. Private submitted scores are no longer a globally readable leaderboard
feed: Admin still sees all evaluations; mentors see only their own, teams none.
Do not present the mentor's partial score dataset as global rankings.

Keep the homepage, infinity interaction, registration URLs and visual identity intact.

## Realtime gate

Existing publication membership is retained. RLS/column grants must apply to
subscriber delivery, not only REST. The current app uses unprojected postgres_changes
subscriptions. Before rollout, test that team payloads omit access_code_hash and
foreign rows, including old_record/delete behavior; test reassignment/revocation
while already subscribed. If the deployed Realtime version requires explicit
column selection, coordinate safe per-table selections in api.js. Never regrant
hash SELECT or widen RLS to make subscriptions work. If safe delivery cannot be
verified, block rollout and prepare a safe projection/Broadcast alternative.
Do not claim authenticated Realtime or revocation behavior has passed from SQL tests.

References: https://supabase.com/docs/guides/database/postgres/column-level-security
and https://supabase.com/docs/guides/realtime/postgres-changes

## Verification and tests

Executed offline: `node --test supabase/tests/stage2_artifacts.test.mjs`.
These check snapshot integrity, full CSV parsing, fingerprint coverage, preserved
team-auth definitions, exact recovered RPC bodies, transaction framing, retained
evaluation contracts and safe overview fields. They are NOT a PostgreSQL parser,
database authorization test, or proof that the migrations execute successfully.

Prepared, NOT executed:

- `stage2_verify.sql`: read-only catalog/grant checks, counts, ownership consistency.
- `stage2_capture_history.sql` and `stage2_check_history.sql`: same-session before/
  after row fingerprints in isolated staging, excluding newly added relationship
  columns and team credential hashes. Check no original IDs/content disappear/change.
  Run capture BEFORE migrations and check immediately AFTER, with clients stopped.
- `supabase/tests/stage2_isolation.sql`: rollback-only fixtures for two teams, two
  mentors and the existing staging Admin; valid/invalid team credential RPC calls,
  cross-team/mentor isolation, hash denial, TRUNCATE denial, Admin assignment,
  mentor self-claim/release rejection, authorized resolution/evaluation, mismatched
  track rejection, singleton protection and history ID preservation.

No psql, Postgres server, Supabase CLI or Docker is installed here. No SQL was
executed against any database. App code did not change, so build/lint were not rerun.

For a later approved ISOLATED validation only: restore the verified schema and
extension dependencies into a disposable Supabase project, create ONE synthetic
non-anonymous Admin/Auth profile via trusted setup, confirm it as above, and apply
the three migrations in order. Restore schema from an operator-controlled schema
dump; the CSV is an inspection artifact, not a restorable baseline.
For preservation testing, add synthetic historical requests/evaluations first,
then run the capture, migrations, and check files in the same psql session. Keep
the isolated-environment and Admin/backfill confirmation settings for that session.

With psql connected to the disposable instance, execute the test as follows:

```text
psql <isolated-connection-options> -W -v ON_ERROR_STOP=1 -c "SET zerohour.test_environment='isolated'" -f supabase/tests/stage2_isolation.sql
```

Use password prompting/private pgpass, not a credential-bearing command string.
The isolation script writes synthetic auth.users(id,is_anonymous) fixture rows
inside its transaction; verify that managed Auth fixture contract in staging first.
It always ends in ROLLBACK; on error, close the session to abort the transaction.
Never run it against production, even though changes normally roll back.

SET ROLE/JWT SQL simulations do not validate Auth token issuance or browser login.
In particular, old triggers trust session_user=postgres, even after SET ROLE.
Test real anonymous sign-in/login, staff email/password sign-in, route guards,
team-session persistence, reconnect/logout cleanup, draft/save/submit permissions,
reassignment and score privacy using actual isolated Auth sessions as well.
Test concurrent duplicate Admin promotion and request assignment from two sessions;
expect one winner and transactional rejection, not lost history.

## Rollback and rollout strategy

No execution/deployment is authorized by this package. Obtain separate approval
after isolated validation and coordinated frontend review. Use a maintenance window;
do not leave migrations partially applied while clients are active. Preserve a
private operator-controlled backup plus baseline schema/grants/identity counts.

- Failure BEFORE a migration COMMIT: roll back that transaction; a SQL Editor
  error may leave a transaction open, so explicitly ROLLBACK before proceeding.
- Failure AFTER a prior migration committed: do not rerun all files or blindly
  restore permissive policies. Keep extension tables/columns/IDs and all new data.
  Prepare a forward correction; track migration can be retried only if its whole
  transaction rolled back and the security migration remains valid.
- Security incident after commit: reviewed `stage2_emergency_containment.sql`
  revokes browser operational access, including explicit column grants, while
  retaining the old team login/identity RPCs. This is containment with an operational
  outage, not a full down migration. Operator/service access remains for repair.
- Full return to baseline would restore known cross-team exposure and self-claim;
  do not supply/apply that as a routine rollback. A restore is a separately approved
  recovery operation in a protected environment, not a destructive production reset.

No data must be dropped to reverse UI rollout. Existing login RPCs remain stable;
the frontend can continue showing its current identity-only team dashboard.

## Unresolved review gates

Confirm actual sole Admin identity/count and historical table ownership privately;
confirm future approved evaluator pairs. Validate real Auth and Realtime behavior,
PostgreSQL execution, managed dependencies and baseline migration history in
isolation. The export contains no application rows and cannot answer those questions.
PPT links do not exist in this deployed contract and are not invented here.
Chat, event clock, phase configuration, immutable assignment audit/reassignment,
dynamic rounds/rubrics and public aggregate rankings remain future stages.
