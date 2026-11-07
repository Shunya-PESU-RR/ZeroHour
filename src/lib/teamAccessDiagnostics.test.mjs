import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTeamIdentity, safeTeamDiagnostic, teamAccessFailureMessage, logTeamAccess } from './teamAccessDiagnostics.js';

test('the deployed three-field identity is sufficient; no Stage 2 fields are required', () => {
  assert.equal(isTeamIdentity({ team_id: 'test-id', team_name: 'Test identity', table_number: 1 }), true);
  for (const value of [null, {}, { team_id: 'test-id' }, { team_id: 'test-id', team_name: 'Test', table_number: '1' }]) {
    assert.equal(isTeamIdentity(value), false);
  }
});
test('diagnostics never include response data, input values, arbitrary codes, or backend messages', () => {
  const sentinel = 'DO_NOT_DISCLOSE_CREDENTIAL_TOKEN_HASH';
  const error = { status: 403, code: sentinel, message: `Invalid team session ${sentinel}`, details: sentinel, hint: sentinel, session: { access_token: sentinel } };
  const diagnostic = safeTeamDiagnostic('login_team', 'failed', error);
  assert.deepEqual(diagnostic, { stage: 'login_team', outcome: 'failed', status: 403, code: 'unrecognized_code', category: 'anonymous_session_rejected' });
  assert.equal(JSON.stringify(diagnostic).includes(sentinel), false);
  assert.equal(teamAccessFailureMessage('login_team', error).includes(sentinel), false);
  assert.equal(JSON.stringify(safeTeamDiagnostic(sentinel, sentinel, error)).includes(sentinel), false);
});
test('known failure stages distinguish transport, permissions, missing RPC and rate limits', () => {
  assert.equal(safeTeamDiagnostic('login_team', 'failed', { code: '42501', status: 403 }).category, 'permission_denied');
  assert.equal(safeTeamDiagnostic('get_my_team', 'failed', { code: 'PGRST202' }).category, 'rpc_not_available');
  assert.equal(safeTeamDiagnostic('anonymous_sign_in', 'failed', { message: 'Failed to fetch' }).category, 'network');
  assert.match(teamAccessFailureMessage('anonymous_sign_in', { status: 429 }), /wait/);
  assert.match(teamAccessFailureMessage('get_session', {}), /restored/);
});
test('empty RPC results have a distinct diagnostic and no implied database error', () => {
  assert.deepEqual(safeTeamDiagnostic('login_team', 'empty_result'), {
    stage: 'login_team', outcome: 'empty_result', status: null, code: null, category: 'unspecified',
  });
});
test('logging is disabled when not running in Vite development mode', () => {
  const original = console.debug;
  let calls = 0;
  console.debug = () => { calls++; };
  try { logTeamAccess('login_team', 'failed', { message: 'private' }); }
  finally { console.debug = original; }
  assert.equal(calls, 0);
});
