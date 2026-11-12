/**
 * SHARED DATA SHAPES (agree these with Srujan before connecting Supabase)
 *
 * Team:          { id, name, table }
 * Mentor:        { id, name }
 * Criterion:     { id, label, weight }            // weights sum to 1
 * Request:       { id, table, issue, status: 'open'|'claimed'|'resolved', claimedBy, createdAt }
 * Evaluation:    { teamId, mentorId, scores: { [criterionId]: number }, comment, updatedAt }
 * Registration:  { id, teamName, college, email, members: string[], createdAt }
 * AccessRequest: { id, teamName, email, note, status: 'pending'|'approved'|'rejected', createdAt }
 */
export const REQUEST_STATUS = { OPEN: 'open', CLAIMED: 'claimed', RESOLVED: 'resolved' };
