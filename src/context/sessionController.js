import { isTeamIdentity, logTeamAccess } from '../lib/teamAccessDiagnostics.js';
class SessionAccessError extends Error {}

const empty = () => ({ status: 'ready', role: null, user: null, mentor: null, team: null, error: null, notice: null });
const invalidAuth = error => [401, 403].includes(error?.status) || ['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(error?.code);
const bounded = promise => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new SessionAccessError('Session verification timed out.')), 15000); })]).finally(() => clearTimeout(timer));
};

async function verifiedUser(client) {
  // Cached SDK sessions are restoration hints, never role/ownership proof.
  const restored = await client.auth.getSession();
  if (restored.error) {
    if (invalidAuth(restored.error)) return null;
    throw new SessionAccessError('Could not restore your session. Check your connection and retry.');
  }
  if (!restored.data?.session) return null;
  const verified = await client.auth.getUser();
  if (verified.error) {
    if (invalidAuth(verified.error)) return null;
    throw new SessionAccessError('Could not verify your session with Supabase. Please retry.');
  }
  return verified.data?.user ?? null;
}

export async function resolveAuthorization(staff, teamClient) {
  const [staffUser, teamUser] = await Promise.all([verifiedUser(staff), verifiedUser(teamClient)]);
  let staffIdentity = null;
  let teamIdentity = null;
  if (staffUser) {
    if (staffUser.is_anonymous !== false) throw new SessionAccessError('A non-anonymous staff account is required. Log out and sign in again.');
    const profile = await staff.from('mentors').select('id, user_id, name, role').eq('user_id', staffUser.id).maybeSingle();
    if (profile.error) throw new SessionAccessError('Could not verify your authorized staff profile. Please retry.');
    const mentor = profile.data;
    if (!mentor || mentor.user_id !== staffUser.id || !['mentor', 'organizer'].includes(mentor.role)) {
      throw new SessionAccessError('This account has no authorized staff profile. Log out or contact an organizer.');
    }
    if (mentor.role === 'organizer') {
      const authority = await staff.rpc('is_organizer');
      if (authority.error) throw new SessionAccessError('Could not verify Admin authorization. Please retry.');
      if (authority.data !== true) throw new SessionAccessError('Admin authorization was not confirmed by the backend.');
    }
    staffIdentity = { role: mentor.role === 'organizer' ? 'admin' : 'mentor', user: staffUser, mentor };
  }
  if (teamUser) {
    if (teamUser.is_anonymous !== true) throw new SessionAccessError('The team client contains a non-team session. Log out before continuing.');
    logTeamAccess('get_my_team', 'started');
    const owned = await teamClient.rpc('get_my_team');
    if (owned.error) {
      logTeamAccess('get_my_team', 'failed', owned.error);
      if (!invalidAuth(owned.error)) throw new SessionAccessError('Could not validate your team ownership. Please retry.');
    } else if (Array.isArray(owned.data) && owned.data.length === 0) {
      // Anonymous sign-in alone is deliberately NOT an authorized team session.
      logTeamAccess('get_my_team', 'empty_result');
    } else if (Array.isArray(owned.data) && owned.data.length === 1 && isTeamIdentity(owned.data[0])) {
      logTeamAccess('get_my_team', 'succeeded');
      teamIdentity = { role: 'team', user: teamUser, team: owned.data[0] };
    } else {
      throw new SessionAccessError('The team ownership service returned an unexpected identity.');
    }
  }
  if (staffIdentity && teamIdentity) throw new SessionAccessError('Two authorized sessions are active. Log out to choose one account before continuing.');
  // Detect an SDK account switch while backend ownership/profile queries ran.
  // This comparison can only deny access; it never grants a role from storage.
  for (const [client, identity] of [[staff, staffIdentity], [teamClient, teamIdentity]]) {
    if (!identity) continue;
    const current = await client.auth.getSession();
    if (current.error || current.data?.session?.user?.id !== identity.user.id) throw new SessionAccessError('Your session changed during verification. Please retry.');
  }
  return { ...empty(), ...(staffIdentity || teamIdentity || {}) };
}

export function createSessionController({ staff, teamClient, configured = true }) {
  let state = { ...empty(), status: configured ? 'loading' : 'ready' };
  let revision = 0;
  let operation = 0;
  let running = false;
  let mutation = false;
  let logoutBlocked = false;
  let timer = null;
  let notice = null;
  let inFlightLogin = null;
  const listeners = new Set();
  const publish = next => { state = next; listeners.forEach(listener => listener()); };
  const clearTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };

  async function refresh(expected = null) {
    if (!configured || logoutBlocked) return state;
    clearTimer();
    const ticket = ++revision;
    publish({ ...empty(), status: 'loading' });
    try {
      const next = await bounded(resolveAuthorization(staff, teamClient));
      if (expected?.teamId && (next.role !== 'team' || next.team?.team_id !== expected.teamId)) throw new SessionAccessError('Team ownership could not be confirmed.');
      if (expected?.staff && !['admin', 'mentor'].includes(next.role)) throw new SessionAccessError('Staff authorization could not be confirmed.');
      if (running && ticket === revision) publish({ ...next, notice: next.role ? null : notice });
    } catch (error) {
      if (running && ticket === revision) publish({ ...empty(), status: 'error', error: error instanceof SessionAccessError ? error.message : 'Could not verify your session. Check your connection and retry.' });
    }
    return state;
  }
  function schedule(event) {
    if (event === 'INITIAL_SESSION') return; // start() already restores both clients.
    if (!running || mutation || logoutBlocked) return;
    // Never await Auth calls from inside a Supabase auth-state callback.
    ++revision;
    publish({ ...empty(), status: 'loading' });
    clearTimer();
    timer = setTimeout(() => { timer = null; void refresh(); }, 0);
  }
  function start() {
    running = true;
    if (!configured) return () => { running = false; };
    const subscriptions = [staff, teamClient].map(client => client.auth.onAuthStateChange(schedule).data.subscription);
    void refresh();
    const onPageShow = event => { if (event.persisted) schedule(); };
    if (typeof window !== 'undefined') window.addEventListener('pageshow', onPageShow);
    return () => {
      running = false; ++revision; ++operation; mutation = false; clearTimer();
      subscriptions.forEach(subscription => subscription.unsubscribe());
      if (typeof window !== 'undefined') window.removeEventListener('pageshow', onPageShow);
    };
  }
  function beginLogin() {
    if (!configured) throw new SessionAccessError('Sign-in is not configured. Please contact an organizer.');
    if (mutation || state.role || logoutBlocked || state.status !== 'ready') throw new SessionAccessError('Finish the current session before signing in again.');
    mutation = true; notice = null; clearTimer(); ++revision;
    return ++operation;
  }
  function assertOperation(ticket) {
    if (!running || ticket !== operation) throw new SessionAccessError('Sign-in was cancelled. Please try again.');
  }
  async function performStaffSignIn(email, password) {
    const ticket = beginLogin();
    try {
      const result = await staff.auth.signInWithPassword({ email: email.trim(), password });
      assertOperation(ticket);
      if (result.error) throw new SessionAccessError('Sign-in failed. Check your credentials or contact an organizer.');
      const next = await refresh({ staff: true });
      assertOperation(ticket);
      if (!['admin', 'mentor'].includes(next.role)) throw new SessionAccessError('Staff authorization could not be confirmed.');
      return next;
    } catch (error) {
      if (error instanceof SessionAccessError) throw error;
      throw new SessionAccessError('Staff sign-in could not be completed. Please retry.');
    } finally { if (ticket === operation) mutation = false; }
  }
  async function performTeamSignIn(name, accessCode) {
    if (!name.trim() || !accessCode) throw new SessionAccessError('Enter your team name and access code.');
    const ticket = beginLogin();
    let stage = 'anonymous_sign_in';
    try {
      logTeamAccess(stage, 'started');
      const result = await teamClient.auth.signInAnonymously();
      assertOperation(ticket);
      if (result.error) { logTeamAccess(stage, 'failed', result.error); throw new SessionAccessError('Could not start anonymous team sign-in. Please retry or contact an organizer.'); }
      if (!result.data?.session) throw new SessionAccessError('No anonymous session was returned.');
      logTeamAccess(stage, 'succeeded');
      stage = 'login_team';
      // Preserve the deployed RPC argument names and exact access-code value.
      const login = await teamClient.rpc('login_team', { p_team_name: name.trim(), p_access_code: accessCode });
      assertOperation(ticket);
      if (login.error) { logTeamAccess(stage, 'failed', login.error); throw new SessionAccessError('The team verification service could not complete sign-in. Please retry.'); }
      if (Array.isArray(login.data) && login.data.length === 0) {
        logTeamAccess(stage, 'empty_result');
        // This new anonymous identity has no team authorization. Do not grant a
        // role from sign-in alone, even if session cleanup fails.
        try { await teamClient.auth.signOut(); } catch { /* no authority was granted */ }
        throw new SessionAccessError('Invalid team name or access code.');
      }
      if (!Array.isArray(login.data) || login.data.length !== 1 || !isTeamIdentity(login.data[0])) throw new SessionAccessError('The team service returned an unexpected identity.');
      logTeamAccess(stage, 'succeeded');
      const next = await refresh({ teamId: login.data[0].team_id });
      assertOperation(ticket);
      if (next.role !== 'team' || next.team.team_id !== login.data[0].team_id) throw new SessionAccessError('Team ownership could not be confirmed.');
      return next;
    } catch (error) {
      if (error instanceof SessionAccessError) throw error;
      logTeamAccess(stage, 'failed', error);
      throw new SessionAccessError('Team sign-in could not be completed. Please retry.');
    } finally { if (ticket === operation) mutation = false; }
  }
  function trackLogin(work) {
    inFlightLogin = work;
    void work.finally(() => { if (inFlightLogin === work) inFlightLogin = null; }).catch(() => {});
    return work;
  }
  const signIn = (...args) => trackLogin(performStaffSignIn(...args));
  const signInTeam = (...args) => trackLogin(performTeamSignIn(...args));
  async function signOut() {
    if (mutation && state.status === 'logging_out') return;
    mutation = true; logoutBlocked = true; clearTimer(); ++revision;
    const ticket = ++operation;
    publish({ ...empty(), status: 'logging_out' });
    try {
      // Finish/cancel an older login before clearing SDK sessions, so a late Auth
      // response cannot recreate the browser session after successful logout.
      if (inFlightLogin) await bounded(inFlightLogin.catch(() => {}));
      const results = await bounded(Promise.allSettled([staff.auth.signOut(), teamClient.auth.signOut()]));
      if (!running || ticket !== operation) return;
      const remaining = await bounded(Promise.all([staff.auth.getSession(), teamClient.auth.getSession()]));
      if (!running || ticket !== operation) return;
      if (remaining.some(result => result.error || result.data?.session)) throw new SessionAccessError('Your session may still be active. Retry logout before continuing.');
      const warning = results.some(result => result.status === 'rejected' || result.value.error);
      logoutBlocked = false;
      notice = warning ? 'Signed out of this browser. Server-side session revocation could not be confirmed.' : null;
      publish({ ...empty(), notice });
    } catch {
      if (running && ticket === operation) publish({ ...empty(), status: 'logout_error', error: 'Logout could not be completed safely. Your session may still be active. Please retry.' });
      throw new SessionAccessError('Logout could not be completed safely.');
    } finally { if (ticket === operation) mutation = false; }
  }
  return { getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, start, refresh, signIn, signInTeam, signOut };
}
