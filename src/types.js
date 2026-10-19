/**
 * SHARED DATA SHAPES - agree these with Dev A and the scoring/leaderboard dev.
 *
 * Team:       { id, name, table }
 * Mentor:     { id, name }
 * Request:    { id, table, issue, status: 'open'|'claimed'|'resolved', claimedBy: mentorId|null, createdAt }
 * Evaluation: { teamId, mentorId, scores: { [criterionId]: number }, comment, updatedAt }
 */
export const REQUEST_STATUS = { OPEN: 'open', CLAIMED: 'claimed', RESOLVED: 'resolved' };
