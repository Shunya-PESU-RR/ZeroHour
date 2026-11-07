import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialReviewRounds, rubricTotal, validRound, requireOperationsWrites } from './operations.js';

test('supplied rounds preserve exact individual marks and total 100', () => {
  const rounds = initialReviewRounds();
  assert.deepEqual(rounds.map(round => round.metrics.map(metric => metric.max)), [
    [20,20,25,20,15], [30,25,20,15,10], [30,25,15,15,10,5],
  ]);
  assert.deepEqual(rounds.map(round => round.window), ['Hour 2–4','Hour 10–14','Hour 23–24']);
  assert.ok(rounds.every(round => validRound(round) && rubricTotal(round.metrics) === 100));
});
test('draft validation rejects missing metrics, unnamed metrics, invalid marks, and incorrect totals', () => {
  const round = initialReviewRounds()[0];
  assert.equal(validRound({ ...round, name: ' ' }), false);
  assert.equal(validRound({ ...round, metrics: [] }), false);
  for (const patch of [{label:' '}, {max:0}, {max:-1}, {max:Infinity}, {max:'not a mark'}, {max:21}]) {
    assert.equal(validRound({ ...round, metrics: round.metrics.map((metric,i) => i === 0 ? {...metric,...patch} : metric) }), false);
  }
});
test('editing a draft never mutates the supplied defaults or live rubric', () => {
  const edited = initialReviewRounds(); edited[0].metrics[0].max = 99;
  assert.equal(initialReviewRounds()[0].metrics[0].max, 20);
});
test('operational writes fail closed before any backend mutation', () => {
  assert.throws(requireOperationsWrites, /backend permissions.*applied and verified/);
});
