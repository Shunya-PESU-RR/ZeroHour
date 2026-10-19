// Hardcoded rubric. Move to the database later if organizers need to edit it.
export const MAX_SCORE = 10;

export const RUBRIC = [
  { id: 'idea', label: 'Idea & originality', weight: 0.25 },
  { id: 'tech', label: 'Technical execution', weight: 0.3 },
  { id: 'impact', label: 'Impact & usefulness', weight: 0.25 },
  { id: 'pitch', label: 'Presentation', weight: 0.2 },
];

// Weighted score out of MAX_SCORE
export function weightedScore(scores = {}) {
  return RUBRIC.reduce((sum, c) => sum + (scores[c.id] ?? 0) * c.weight, 0);
}
