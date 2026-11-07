// The migration package is prepared, not deployed or verified. This is not a
// permission check: RLS/RPC authorization must be verified before enabling writes.
// No browser setting or environment flag can unlock pending operations.
export const OPERATIONS_WRITES_READY = false;
export const OPERATIONS_PENDING = 'Read-only until the backend permissions are applied and verified.';

export function requireOperationsWrites() {
  if (!OPERATIONS_WRITES_READY) throw new Error(OPERATIONS_PENDING);
}

const round = (id, name, window, metrics) => ({
  id, name, window,
  metrics: metrics.map(([label, max], index) => ({ id: `${id}-${index}`, label, max })),
});

// Supplied event defaults. Local configuration drafts, never live evaluations.
export function initialReviewRounds() {
  return [
    round('round-1', 'Ideation & Technical Feasibility', 'Hour 2–4', [
      ['Problem understanding & relevance', 20],
      ['Innovation & originality', 20],
      ['Technical approach & architecture', 25],
      ['Feasibility within 24 hours', 20],
      ['Clarity of proposed solution', 15],
    ]),
    round('round-2', 'Development & Technical Progress', 'Hour 10–14', [
      ['Technical implementation & code quality', 30],
      ['Functional progress / working components', 25],
      ['Technical complexity & innovation', 20],
      ['Integration & system architecture', 15],
      ['Debugging & problem-solving', 10],
    ]),
    round('round-3', 'Final Product & Demonstration', 'Hour 23–24', [
      ['Functionality & live demonstration', 30],
      ['Technical depth & implementation', 25],
      ['Innovation & uniqueness', 15],
      ['Real-world applicability & impact', 15],
      ['Reliability, testing & robustness', 10],
      ['Technical explanation & Q&A', 5],
    ]),
  ];
}

export function rubricTotal(metrics) {
  return metrics.reduce((sum, metric) => sum + (Number(metric.max) || 0), 0);
}
export function validRound(round) {
  return Boolean(round.name.trim() && round.metrics.length &&
    round.metrics.every(metric => metric.label.trim() && Number.isFinite(Number(metric.max)) && Number(metric.max) > 0) &&
    Math.abs(rubricTotal(round.metrics) - 100) < 0.000001);
}
