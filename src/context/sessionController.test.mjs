import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController, resolveAuthorization } from './sessionController.js';
import { routeDecision } from './routePolicy.js';

// Isolated test doubles only. No real Supabase clients, tokens or network calls.
const staffUser = { id: 'staff-auth-fixture', is_anonymous: false };
const teamUser = { id: 'team-auth-fixture', is_anonymous: true };
const identity = { team_id: 'team-fixture', team_name: 'Fixture team', table_number: 1 };
const profile = { id: 'mentor-fixture', user_id: staffUser.id, name: 'Fixture staff', role: 'organizer' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fakeClient(options = {}) {
  const cfg = { user: null, owned: false, admin: true, logoutClears: true, ...options };
  const listeners = new Set();
  const calls = [];
  const emit = () => listeners.forEach(fn => fn('SIGNED_IN', { user: cfg.user }));
  const client = {
    cfg, calls, emit,
    auth: {
      getSession: async () => ({ data: { session: cfg.user ? { user: { ...cfg.user, app_metadata: { role: 'admin' } } } : null }, error: null }),
      getUser: async () => { calls.push('getUser'); if (cfg.verification) return cfg.verification(); return { data: { user: cfg.user }, error: cfg.userError ?? null }; },
      onAuthStateChange: fn => { listeners.add(fn); return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } }; },
      signInWithPassword: async args => { calls.push(['staff-sign-in',args]); if (cfg.signInWait) await cfg.signInWait; cfg.user = staffUser; emit(); return { data: { user: staffUser }, error: null }; },
      signInAnonymously: async () => { calls.push('anonymous-sign-in'); cfg.user = teamUser; emit(); return { data: { session: { user: teamUser } }, error: null }; },
      signOut: async () => { calls.push('signOut'); if (cfg.logoutClears) cfg.user = null; emit(); return { error: cfg.logoutError ?? null }; },
    },
    from: table => {
      assert.equal(table,'mentors');
      return { select: () => ({ eq: (column, id) => {
        assert.equal(column,'user_id'); assert.equal(id,staffUser.id);
        return { maybeSingle: async () => ({ data: cfg.profile === undefined ? profile : cfg.profile, error: cfg.profileError ?? null }) };
      } }) };
    },
    rpc: async (name,args) => {
      calls.push([name,args]);
      if (name === 'is_organizer') return { data: cfg.admin, error: null };
      if (name === 'get_my_team') return { data: cfg.owned ? [cfg.identity || identity] : [], error: cfg.ownershipError ?? null };
      if (name === 'login_team') { cfg.owned = cfg.loginAccepted !== false; return { data: cfg.owned ? [identity] : [], error: null }; }
      throw new Error('Unexpected test RPC');
    },
  };
  return client;
}
async function setup(staff = fakeClient(), teamClient = fakeClient()) {
  const controller = createSessionController({ staff, teamClient });
  const stop = controller.start();
  await controller.refresh();
  return { controller, staff, teamClient, stop };
}

test('cached role flags cannot authorize; Auth getUser and backend ownership are required', async () => {
  const staff = fakeClient({ user: staffUser, userError: { status: 401 } });
  const team = fakeClient({ user: teamUser });
  const result = await resolveAuthorization(staff,team);
  assert.equal(result.role,null);
  assert.ok(staff.calls.includes('getUser'));
  assert.ok(team.calls.some(call => Array.isArray(call) && call[0] === 'get_my_team'));
  assert.equal(routeDecision(result,'/team/dashboard').to,'/team-login');
});
test('restores a verified team session and refresh preserves the same backend-owned identity', async () => {
  const team = fakeClient({ user: teamUser, owned: true });
  const first = await setup(fakeClient(),team);
  assert.equal(first.controller.getSnapshot().role,'team');
  first.stop();
  const second = await setup(fakeClient(),team);
  assert.deepEqual(second.controller.getSnapshot().team,identity);
  second.stop();
});
test('admin requires both matching staff profile and positive backend authorization', async () => {
  assert.equal((await resolveAuthorization(fakeClient({user:staffUser}),fakeClient())).role,'admin');
  await assert.rejects(resolveAuthorization(fakeClient({user:staffUser,admin:false}),fakeClient()),/not confirmed/);
  await assert.rejects(resolveAuthorization(fakeClient({user:staffUser,profile:{...profile,user_id:'other'}}),fakeClient()),/no authorized staff profile/);
});
test('expired or invalid server sessions do not render protected content', async () => {
  for (const role of ['staff','team']) {
    const expired = fakeClient({user:role==='staff'?staffUser:teamUser,owned:true,userError:{status:401}});
    const result = await resolveAuthorization(role==='staff'?expired:fakeClient(),role==='team'?expired:fakeClient());
    assert.equal(result.role,null);
    assert.equal(routeDecision(result,role==='staff'?'/admin/dashboard':'/team/dashboard').kind,'redirect');
  }
});
test('ownership errors fail closed and simultaneous authorized roles are blocked', async () => {
  await assert.rejects(resolveAuthorization(fakeClient(),fakeClient({user:teamUser,ownershipError:{status:503}})),/ownership/);
  await assert.rejects(resolveAuthorization(fakeClient({user:staffUser}),fakeClient({user:teamUser,owned:true})),/Two authorized sessions/);
});
test('anonymous sign-in cannot grant a role until login_team and get_my_team both confirm it', async () => {
  const {controller,teamClient,stop} = await setup();
  await controller.signInTeam('  Fixture team  ',' exact code ');
  assert.deepEqual(teamClient.calls.find(call => Array.isArray(call) && call[0]==='login_team')[1], {p_team_name:'Fixture team',p_access_code:' exact code '});
  assert.equal(controller.getSnapshot().role,'team');
  stop();
});
test('rejected team credentials remain public without a login flash or granted team role', async () => {
  const team = fakeClient({loginAccepted:false});
  const {controller,stop}=await setup(fakeClient(),team);
  const seen=[]; const unlisten=controller.subscribe(()=>seen.push(controller.getSnapshot().role));
  await assert.rejects(controller.signInTeam('Fixture','wrong'),/Invalid team name or access code/);
  assert.equal(controller.getSnapshot().status,'ready'); assert.equal(controller.getSnapshot().role,null);
  assert.ok(seen.every(role=>role===null));
  unlisten(); stop();
});
test('loading blocks all direct URLs until verification completes', async () => {
  const wait=deferred(); const staff=fakeClient({user:staffUser,verification:()=>wait.promise});
  const controller=createSessionController({staff,teamClient:fakeClient()}); const stop=controller.start();
  assert.equal(routeDecision(controller.getSnapshot(),'/admin/dashboard').kind,'loading');
  wait.resolve({data:{user:staffUser},error:null}); await controller.refresh();
  assert.equal(controller.getSnapshot().role,'admin'); stop();
});
test('logout clears both clients and stale verification cannot republish private data', async () => {
  const env=await setup(fakeClient({user:staffUser}),fakeClient());
  const wait=deferred(); env.staff.cfg.verification=()=>wait.promise;
  const old=env.controller.refresh();
  await env.controller.signOut();
  wait.resolve({data:{user:staffUser},error:null}); await old;
  assert.equal(env.controller.getSnapshot().role,null);
  assert.ok(env.staff.calls.includes('signOut') && env.teamClient.calls.includes('signOut'));
  assert.equal(routeDecision(env.controller.getSnapshot(),'/').kind,'allow');
  env.stop();
});
test('logout failures never report success while a local session remains', async () => {
  const env=await setup(fakeClient({user:staffUser,logoutClears:false,logoutError:{status:503}}));
  await assert.rejects(env.controller.signOut(),/safely/);
  assert.equal(env.controller.getSnapshot().status,'logout_error');
  assert.equal(env.controller.getSnapshot().user,null);
  assert.equal(routeDecision(env.controller.getSnapshot(),'/admin/dashboard').kind,'error');
  await env.controller.refresh(); assert.equal(env.controller.getSnapshot().status,'logout_error');
  env.staff.cfg.logoutClears=true; env.staff.cfg.logoutError=null;
  await env.controller.signOut(); assert.equal(env.controller.getSnapshot().status,'ready'); env.stop();
});
test('remote revocation errors are disclosed when SDK local sessions were still cleared', async () => {
  const env=await setup(fakeClient({user:staffUser,logoutError:{status:503}}));
  await env.controller.signOut();
  assert.equal(env.controller.getSnapshot().role,null);
  assert.match(env.controller.getSnapshot().notice,/revocation could not be confirmed/); env.stop();
});
test('logout waits for a pending login and prevents late authentication restoring access', async () => {
  const wait=deferred(); const env=await setup(fakeClient({signInWait:wait.promise}));
  const login=env.controller.signIn('test@example.invalid','test-only');
  const logout=env.controller.signOut();
  wait.resolve(); await assert.rejects(login,/cancelled/); await logout;
  assert.equal(env.staff.cfg.user,null); assert.equal(env.controller.getSnapshot().role,null); env.stop();
});
test('a mismatching login/ownership response never publishes a team identity', async () => {
  const team=fakeClient({identity:{...identity,team_id:'different-owned-team'}});
  const env=await setup(fakeClient(),team);
  await assert.rejects(env.controller.signInTeam('Fixture','exact-code'),/ownership/);
  assert.equal(env.controller.getSnapshot().status,'error');
  assert.equal(env.controller.getSnapshot().team,null); env.stop();
});
test('unexpected verification errors never expose raw backend messages', async () => {
  const secret='PRIVATE_DIAGNOSTIC_SENTINEL';
  const env=await setup(fakeClient({user:staffUser,verification:async()=>{throw new Error(secret);}}));
  assert.equal(env.controller.getSnapshot().status,'error');
  assert.equal(env.controller.getSnapshot().error.includes(secret),false); env.stop();
});
