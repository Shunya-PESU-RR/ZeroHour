import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockReading, istTimestamp } from './eventClock.js';

const sample = {
  sampledAt: 400,
  data: { starts_at: '2026-11-14T04:30:00Z', ends_at: '2026-11-15T04:30:00Z', server_now: '2026-11-14T04:29:59Z' },
};

test('clock switches from waiting to live at the authoritative start', () => {
  assert.equal(clockReading(sample, 400).display, '00:00:01');
  assert.deepEqual(clockReading(sample, 1400), { phase: 'live', label: 'Hackathon Live', display: '24:00:00' });
});

test('independent browser monotonic origins agree after reload', () => {
  assert.deepEqual(clockReading(sample, 6400), clockReading({ ...sample, sampledAt: 100 }, 6100));
});

test('completion and early end clamp to zero', () => {
  assert.equal(clockReading(sample, 86401400).display, '00:00:00');
  const early = { ...sample, data: { ...sample.data, ends_at: '2026-11-14T04:30:01Z' } };
  assert.equal(clockReading(early, 3400).phase, 'ended');
  assert.equal(clockReading(early, 3400).display, '00:00:00');
});

test('unscheduled clock remains unset and display uses IST', () => {
  assert.equal(clockReading({ data: { starts_at: null } }, 0).phase, 'unscheduled');
  assert.match(istTimestamp(sample.data.starts_at), /10:00:00.*IST/);
});
