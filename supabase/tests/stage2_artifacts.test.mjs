// Offline artifact/contract checks only. No database connection or SQL execution.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const base = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, base), 'utf8');
const csv = read('inspection/zerohour_deployed_schema_export.csv');
// RFC4180 quoted fields, doubled quotes, and multiline data.
function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(field); field = ''; }
    else if (!quoted && c === '\n') { row.push(field.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  assert.equal(quoted, false, 'closed CSV quotes');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows.slice(1).map(([section, name, definition]) => ({ section, name, data: JSON.parse(definition) }));
}
const rows = parseCsv(csv);
const security = read('migrations/202611050001_stage2_security.sql');
const tracks = read('migrations/202611050002_stage2_tracks.sql');
const preflight = read('migrations/202611050000_stage2_preflight.sql');
const funcs = rows.filter(r => r.section === '06_functions');
test('complete authoritative snapshot is pinned and every definition parses', () => {
  assert.equal(createHash('sha256').update(readFileSync(new URL('inspection/zerohour_deployed_schema_export.csv', base))).digest('hex'), 'edd64e53b603dea7991e43487039d9711dfe2be080f25c027eb87a2626ce2ae1');
  assert.equal(rows.length, 200);
  assert.equal(funcs.length, 17);
});
test('all deployed function fingerprints are represented in drift preflight', () => {
  for (const { name, data } of funcs) {
    const signature = name.replace(/\bp_[a-z_]+\s+/g, '');
    assert.ok(preflight.includes(`to_regprocedure('${signature}')`));
    assert.ok(preflight.includes(createHash('md5').update(data.definition).digest('hex')));
  }
});
test('team authentication definitions are not replaced or dropped', () => {
  for (const sql of [security, tracks]) assert.doesNotMatch(sql, /(?:CREATE(?: OR REPLACE)?|DROP) FUNCTION public\.(?:login_team|get_my_team)\s*\(/i);
  const login = funcs.find(f => f.name.startsWith('public.login_team(')).data.definition;
  assert.ok(login.includes('public.team_sessions'));
  assert.ok(login.includes('extensions.crypt'));
});
test('request RPC bodies preserve the exported atomic workflow and audit inserts', () => {
  for (const name of ['claim_request', 'release_request', 'resolve_request']) {
    const original = funcs.find(f => f.name.startsWith(`public.${name}(`)).data.definition;
    const guard = name === 'resolve_request'
      ? "\n  IF public.get_current_mentor_id() IS NULL THEN\n    RAISE EXCEPTION 'A non-anonymous staff identity is required' USING ERRCODE = '42501';\n  END IF;\n"
      : "\n  IF NOT public.is_organizer() THEN\n    RAISE EXCEPTION 'Only the Admin can allocate or release requests' USING ERRCODE = '42501';\n  END IF;\n";
    const i = original.indexOf('BEGIN') + 5;
    const expected = (original.slice(0, i) + guard + original.slice(i)).replace("SET search_path TO 'public', 'pg_temp'", "SET search_path TO ''").trimEnd() + ';';
    assert.ok(security.includes(expected), `${name} differs only by reviewed guard/search_path`);
  }
});
test('migration drafts are transactional and contain no destructive record removal', () => {
  for (const sql of [preflight, security, tracks]) {
    assert.match(sql, /\bBEGIN;/); assert.match(sql, /COMMIT;\s*$/);
    assert.doesNotMatch(sql, /\bDROP TABLE\b|\bTRUNCATE\s+(?:TABLE\s+)?public\.|\bDELETE FROM\b/i);
    const delimiters = sql.match(/\$(?:function)?\$/g) ?? [];
    assert.equal(delimiters.length % 2, 0);
  }
});
test('existing evaluation identity and statuses are not migrated to new contracts', () => {
  assert.doesNotMatch(security + tracks, /ALTER TABLE public\.evaluations/);
  assert.doesNotMatch(security + tracks, /(?:ADD COLUMN|CREATE TABLE)[^;]*(?:round_id|chat_messages|event_clock)/i);
  assert.match(security, /CREATE TABLE public\.evaluation_authorizations/);
});
test('new team projection excludes hashes and original IDs remain the relationship', () => {
  const overview = tracks.slice(tracks.indexOf('CREATE FUNCTION public.get_my_team_overview'));
  assert.doesNotMatch(overview, /access_code_hash|SELECT\s+\*/);
  assert.match(overview, /s\.user_id = auth\.uid\(\)/);
  assert.match(overview, /is_anonymous/);
  assert.match(tracks, /FOREIGN KEY \(problem_statement_id, track_id\)/);
});
