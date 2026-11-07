# Stage 2 inspection and review

The deployed export has now been supplied and reviewed. See [STAGE2_REVIEW.md](STAGE2_REVIEW.md)
for the proposed migrations, compatibility assessment, tests, manual setup and rollback plan.
The original inspection instructions and initial findings below are retained as historical context.

Initial inspection status (superseded by the review document): no migrations had
been prepared. Proposed migrations now exist, but none have been applied and no
application code was changed.

## Obtain the missing schema

1. Open the correct deployed project in Supabase Dashboard → SQL Editor → New query.
2. Paste the complete contents of `stage2_schema_export.sql` and run it.
3. Export its result grid as CSV and review it locally before sharing.
4. Send that CSV for review. If a query errors, provide the error; do not relax permissions.

The script uses an explicitly read-only transaction and catalog SELECTs. It does
not read application rows, auth.users, passwords, access codes, or tokens. Function
bodies, policy expressions, and defaults can contain developer-hardcoded secrets;
redact any such literal values before sharing, preserving the surrounding logic.
Do not send .env files, connection strings, access tokens, or data exports.

This export includes application schemas, columns, keys, constraints, indexes,
policies, ACLs, functions (including ownership RPCs), SECURITY DEFINER/search_path,
triggers, role flags/memberships, and Realtime publication membership. It also
lists auth.users trigger definitions without reading auth.users rows. If those
triggers depend on custom functions inside managed schemas, their definitions may
need a targeted follow-up inspection. No ordinary application tables are queried.

## Evidence available locally

- Only `20261020_zerohour_policies_and_functions.sql` exists in local migrations.
  It assumes base tables already exist; it is not a complete database baseline.
- The historical `20261021_team_access_codes.sql` blob in `87d52ff` is empty.
- Frontend uses `login_team` and `get_my_team`, but their definitions are missing.
- Local policies grant authenticated-wide team, mentor, and request SELECT access,
  permit reading submitted evaluations, and permit mentor self-claim via RPC.
- No local singleton Admin constraint or verified track/problem ownership model.
- No psql, pg_dump, Supabase CLI, Docker, linked CLI project, or schema-capable
  database connector was found. Frontend public configuration is not catalog access.

These findings describe checked-in code, not verified deployed vulnerabilities.

## Conditional migration plan — not executable contracts

After reviewing the export, prepare versioned migrations that:

1. Fail preflight if existing Admin identity/ownership is ambiguous. Preserve the
   authorized account; never automatically select among multiple organizers.
2. Restrict Admin authorization server-side with a singleton authorization model
   compatible with existing roles and bootstrap paths.
3. Replace permissive policies and self-claim permissions transactionally, using
   the actual team ownership RPC contract. Check all effective grants and policies.
4. Add only missing track/problem relationships and required indexes, with nullable
   relationships for existing teams until explicit assignments are supplied.
5. Restrict mentor team/PPT access to authorized assignments. Verify the existing
   evaluator authorization model before changing scoring access; do not conflate
   assistance assignments with evaluator assignments.
6. Preserve historical request statuses/rows and RPC compatibility where safe.
   Do not introduce the complete chat, clock, or dynamic-round schema at Stage 2.

No exact SQL migrations or frontend contract changes should precede that review.

## Validation and rollback gates

Restore the verified schema into an isolated Supabase test environment. Use
synthetic test identities there, never production credentials or private data.
Test Admin, two distinct teams, assigned/unassigned mentors, anonymous requests,
and direct RPC/table access. Verify existing team login compatibility and history
preservation. Test concurrent assignment and single-Admin enforcement.

Before any later deployment, preserve schema/policy definitions and a private
database backup under the operator's control. Run migrations transactionally with
preflight checks. Exact rollback depends on the verified schema; do not blindly
restore broad historical policies or drop populated extension tables. Prefer
forward fixes that retain records. No deployment or migration execution is
authorized by this preparation step.
