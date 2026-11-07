# Session, routing and shared UI review

## Implemented frontend authorization

`sessionController.js` is the single authorization coordinator for both existing
Supabase clients. SDK persistence/storage keys are unchanged. `getSession()` is
only a restoration hint; a cached role, user object, localStorage flag, URL state,
or anonymous signup alone cannot authorize a protected page.

- Staff: `auth.getUser()` verifies the current Auth identity. The linked mentors
  row must match that user and have an authorized role. Organizer/Admin access
  additionally requires the existing `is_organizer()` RPC to return true.
- Team: verified Auth user must be anonymous AND `get_my_team()` must return one
  valid `(team_id, team_name, table_number)` record. That RPC checks auth.uid(),
  the anonymous JWT flag, and team_sessions ownership on the backend.
- Restoring/verifying/signing out renders a shared loading screen, never protected
  content or a login flash. Verification failures fail closed with retry/logout.
- Two simultaneous authorized roles (the clients have separate storage keys)
  produce a blocked conflict state. Log out before choosing one account. No role
  priority is silently inferred from a URL or client preference.
- Route policy is evaluated on every React Router location change. Authorized
  teams are restricted to /team/dashboard; Admins to existing /admin pages;
  mentors to existing /mentor pages. Public/login/cross-role/unknown URLs redirect
  to the verified role's dashboard. Existing route paths remain available.
- Explicit logout signs out BOTH SDK clients, invalidates in-flight verification,
  waits for older login attempts so late responses cannot recreate authority,
  and verifies local sessions were cleared before returning to /. Protected
  workspaces unmount, which clears private API caches, subscriptions and UI drafts.
  Permanent legacy setup records/preferences are not deleted.
- If sign-out cannot clear a local session, the app blocks access and offers retry;
  it does not falsely report success. If local sessions cleared but remote
  revocation failed, the public page displays a warning. Live JWT expiry/revocation
  semantics remain controlled by Supabase.
- Back/Forward remain normal browser navigation. Guards re-run; no navigation or
  tab-closing blockers are installed. Restored bfcache pages reverify sessions.

## Existing login contracts preserved

The team login remains anonymous sign-in →
`login_team({p_team_name: name.trim(), p_access_code: exactCode})` →
server-verified `get_my_team()` → dashboard. Access codes are never normalized,
logged, reset or rehashed. No new team fields are required. A signup notification
cannot prematurely grant a team role while the credential RPC is still in flight.
Rejected credentials still display the generic non-enumerating error.

Staff login remains Supabase email/password sign-in; account role is resolved
from authorized backend data. The existing /admin evaluation URL is preserved;
verified Admin login/home redirects now lead to /admin/dashboard.

## Shared visual system

Existing landing tokens now live in src/styles/tokens.css. Existing palette,
fonts, gradients and landing appearance are preserved. Landing CTA styling and
shared Button use the same height, padding, border, gradient, shadow, transitions
and focus palette. AuthLayout is shared by Admin, Mentor and Team login. PageShell
is shared by dashboards, loading/error states and auth pages. It reuses the
official SHUNYA SVG and existing moire with reduced-motion support.

## Backend audit: unresolved deployment risk

The supplied deployed schema export is authoritative for this review; no deployed
schema/policy edits or production data changes were made.

The team ownership RPCs are postgres-owned SECURITY DEFINER, have empty search_path,
are granted to authenticated (not anon), and return an explicit identity projection.
`login_team` verifies extensions.crypt against access_code_hash and writes
team_sessions; get_my_team joins that mapping through auth.uid(). These support
the frontend contract without browser-provided team IDs.

However, existing policies still grant broad authenticated reads of teams, mentors,
requests and submitted evaluations, including authenticated anonymous users.
Browser roles also have dangerous table grants and team credential hashes are
readable under the exported broad table grants. claim_request permits mentor
self-claim; release_request permits mentor self-release. is_organizer accepts
organizer profiles without an exactly-one-Admin constraint. Frontend routing does
NOT repair these database vulnerabilities, and frontend tests cannot prove RLS
isolation. No privileged operations were newly enabled.

SQL requiring separate review/approval remains the existing Stage 2 package:

1. 202611050000_stage2_preflight.sql
2. 202611050001_stage2_security.sql
3. 202611050002_stage2_tracks.sql

See supabase/inspection/STAGE2_REVIEW.md for Admin identity confirmation, historical
request backfill gates, isolated SQL tests and rollback. These files were not
modified or applied in this task. Do not run the older migration to reinstate
broad policies. No additional schema contract is needed for the new route guards.

## Verification and practical limits

Automated tests use isolated test clients, never live data or production accounts:
server verification, anonymous ownership, missing/expired sessions, restored
sessions, Admin RPC denial, simultaneous roles, race-safe logout, failed logout,
RPC argument preservation and React Router memory-history Back/Forward policy.
Existing rubric and diagnostic tests remain relevant.

Validation performed: 26 Node tests passed; production build passed with bundle-size
warnings; lint passed with no warnings. Browser signed-out direct entry, reload,
Back/Forward and unknown-route checks passed. Admin and Team auth layouts were
inspected at 1440px and 375px; entry buttons share computed 48px height, font,
gradient and border, with no horizontal overflow observed. Positive authenticated
browser sessions/logout and database isolation were not tested.

Browser checks without credentials can verify signed-out direct entry, reload,
Back/Forward and responsive auth layouts. Positive team/Admin restoration and
cross-session behavior require real authorized accounts in an isolated Supabase
environment. SQL isolation tests in the Stage 2 package also remain unexecuted.
Do not claim these authenticated/database tests passed without running them.

## Files changed in this task

- src/App.jsx; src/context/AuthContext.jsx
- src/context/sessionController.js; src/context/sessionController.test.mjs
- src/context/routePolicy.js; src/context/routePolicy.test.mjs
- src/components/SessionRoutes.jsx; src/components/Layouts.jsx
- src/components/ui/SharedUI.jsx; src/components/ui/shared-ui.css
- src/pages/AdminLogin.jsx; src/pages/TeamLogin.jsx; src/pages/TeamDashboard.jsx
- src/styles.css; src/styles/tokens.css; src/pages/landing.css
- docs/SESSION_ROUTING_REVIEW.md

Supabase client configuration, backend RPC bodies, production data, credentials,
hashes and all SQL migration files were left unchanged. Existing operational write
locks remain in place pending verified backend permissions.
