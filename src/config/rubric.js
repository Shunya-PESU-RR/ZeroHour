export const MAX_SCORE = 10;

// Default criteria. Organizers can replace these from Admin > Setup (upload).
export const DEFAULT_CRITERIA = [
  { id: 'idea', label: 'Idea & originality', weight: 0.25 },
  { id: 'tech', label: 'Technical execution', weight: 0.3 },
  { id: 'impact', label: 'Impact & usefulness', weight: 0.25 },
  { id: 'pitch', label: 'Presentation', weight: 0.2 },
];

// Weighted score out of MAX_SCORE for any criteria list
export function weightedScore(scores = {}, criteria = DEFAULT_CRITERIA) {
  const total = criteria.reduce((s, c) => s + c.weight, 0) || 1;
  return criteria.reduce((sum, c) => sum + (scores[c.id] ?? 0) * c.weight, 0) / total;
}
