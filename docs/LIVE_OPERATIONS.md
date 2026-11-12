# ZeroHour live operations

The app uses separate Supabase clients for team and staff identities. The session
coordinator verifies Auth users and resolves team ownership through get_my_team.
The existing staff cache reads the roster, requests and evaluations. Setup
imports, phase drafts and rubric drafts remain local. Dynamic review rounds and
chat conversations have separate schema requirements. The evaluation write gate
remains in force pending integration of the evaluation authorization contract.

| Interface | Backend operation |
| --- | --- |
| Team identity | Existing login_team, team_sessions and get_my_team |
| Track and problem statement | Stage 2 get_my_team_overview |
| Official clock | event_clock_state and organizer-only event_clock_control |
| Team submission | submit_mentor_request with server-derived team and table |
| Request lists | live_mentor_requests scoped to the team, assigned mentor or organizer |
| Request transitions and audit | update_mentor_request and organizer-only live_request_activity |

The clock uses PostgreSQL timestamps. It starts unscheduled. The organizer can
schedule an IST start, start immediately or end early. The natural end is exactly
24 elapsed hours after start. Browsers advance a server timestamp using
performance.now and resample every five seconds while visible. Network latency
introduces an approximation of up to the request round trip when resynchronizing.
Clock and request snapshots refresh after mutations, reconnection and tab return.
The request list does not subscribe to a shared row stream. Staff roster and
evaluation subscriptions remain separate.

Pending maps to open and Assigned maps to claimed. Progress and cancellation
timestamps extend the existing lifecycle. The request projection reports those
additional statuses while preserving legacy rows. Teams can have one active
request. A submission UUID makes an ambiguous network retry safe. Assignment
locks the mentor row and verifies availability. The assigned mentor can progress
or resolve a request. Organizers can assign, progress, resolve or cancel it.
Request activity is written in the same transaction as the update.

## Isolated setup and rollout

Use a disposable Supabase database restored from the reviewed schema and apply the
Stage 2 package with its documented identity and history checks. Review existing
duplicate active requests per team before creating the unique index. The migration
aborts on duplicates, leaving the operator to reconcile them explicitly.

From the repository root, with the isolated database connection selected in psql:

```powershell
psql -v ON_ERROR_STOP=1 -f supabase/migrations/202611060001_live_operations.sql
npm ci
npm run dev
npm run build
npm run lint
node --test src/lib/eventClock.test.mjs src/context/sessionController.test.mjs src/context/routePolicy.test.mjs src/lib/teamAccessDiagnostics.test.mjs src/config/operations.test.mjs
```

Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the isolated project's
values. Apply Stage 2 before the live operations migration. The migration revokes
client EXECUTE on legacy request transition RPCs while its owner can still reuse
their validation. Apply only after reviewing dependent clients.

Use two team accounts, an organizer and two mentors in separate browser profiles.
Verify team credential login, restore and logout. Confirm the clock starts
unscheduled, then schedule an isolated start and check waiting, live, refresh,
client clock skew, natural completion and early completion. Submit a request,
retry with the same submission key, and attempt a distinct concurrent submission.
Verify the second team cannot see it, an unassigned mentor cannot change it,
and team callers cannot invoke clock or assignment controls. Assign, progress and
resolve, checking each dashboard and activity within a polling interval. Repeat
with cancellation and connection interruption. Use the existing Stage 2
isolation checks before applying this migration to staging.

Production rollout requires approval of Stage 2 and this migration, staging
verification with real Auth and RLS, and the organizer's official start time.
