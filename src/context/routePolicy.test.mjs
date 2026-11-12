import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryRouter, redirect } from 'react-router-dom';
import { routeDecision, roleHome } from './routePolicy.js';
const verified = role => ({status:'ready',role});
test('direct URL entry enforces team/admin/mentor ownership for every application destination', () => {
  const paths=['/','/about','/team-login','/admin/login','/mentor-access','/team/dashboard','/admin','/admin/dashboard','/admin/setup','/admin/leaderboard','/mentor','/mentor/evaluate','/not-a-route'];
  for (const role of ['team','admin','mentor']) for (const path of paths) {
    const allowed=role==='team'?path==='/team/dashboard':role==='admin'?['/admin','/admin/dashboard','/admin/setup','/admin/leaderboard'].includes(path):['/mentor','/mentor/evaluate'].includes(path);
    const result=routeDecision(verified(role),path);
    assert.equal(result.kind,allowed?'allow':'redirect',`${role} on ${path}`);
    if(!allowed)assert.equal(result.to,roleHome(role));
  }
});
test('signed-out entry, unknown URLs, restoration and logout states fail closed', () => {
  assert.equal(routeDecision(verified(null),'/team/dashboard').to,'/team-login');
  assert.equal(routeDecision(verified(null),'/admin/dashboard').to,'/admin/login');
  assert.equal(routeDecision(verified(null),'/mentor').to,'/mentor-access');
  assert.equal(routeDecision(verified(null),'/unknown').to,'/');
  for(const status of ['loading','logging_out']) for(const path of ['/','/admin/dashboard','/team/dashboard'])assert.equal(routeDecision({status,role:'admin'},path).kind,'loading');
  for(const status of ['error','logout_error'])assert.equal(routeDecision({status,role:'admin'},'/admin/dashboard').kind,'error');
});
test('React Router memory history Back/Forward cannot bypass the same central policy', async () => {
  let session=verified('team');
  const router=createMemoryRouter([{path:'*',loader:({request})=>{
    const decision=routeDecision(session,new URL(request.url).pathname);
    if(decision.kind==='redirect')return redirect(decision.to);
    return decision.kind;
  }}],{initialEntries:['/','/admin/login','/team/dashboard'],initialIndex:2});
  try {
    await router.navigate(-1); assert.equal(router.state.location.pathname,'/team/dashboard');
    await router.navigate(1); assert.equal(router.state.location.pathname,'/team/dashboard');
    session=verified(null); await router.navigate('/',{replace:true});
    await router.navigate('/admin/dashboard'); assert.equal(router.state.location.pathname,'/admin/login');
    session=verified('admin'); await router.navigate('/team/dashboard'); assert.equal(router.state.location.pathname,'/admin/dashboard');
    await router.navigate(-1); assert.equal(router.state.location.pathname,'/admin/dashboard');
  } finally {router.dispose();}
});
