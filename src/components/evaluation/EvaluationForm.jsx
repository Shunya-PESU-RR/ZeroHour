import { useEffect, useState } from 'react';
import { MAX_SCORE, weightedScore } from '../../config/rubric';
import {
  useData, selectTeams, selectMentors, selectCriteria, getEvaluation, submitEvaluation,
} from '../../lib/api';

export default function EvaluationForm() {
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const criteria = useData(selectCriteria);
  const [mentorPick, setMentorPick] = useState('');
  const [teamPick, setTeamPick] = useState('');
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  // Fall back safely if teams/mentors were replaced by an upload
  const mentorId = mentors.some((m) => m.id === mentorPick) ? mentorPick : mentors[0]?.id || '';
  const teamId = teams.some((t) => t.id === teamPick) ? teamPick : '';

  useEffect(() => {
    if (!teamId || !mentorId) return;
    const existing = getEvaluation(teamId, mentorId);
    setScores(existing ? existing.scores : Object.fromEntries(criteria.map((c) => [c.id, 5])));
    setComment(existing ? existing.comment : '');
    setSaved(false);
  }, [teamId, mentorId, criteria]);

  const editing = teamId && getEvaluation(teamId, mentorId);
  const value = (c) => scores[c.id] ?? 5;
  const total = weightedScore(Object.fromEntries(criteria.map((c) => [c.id, value(c)])), criteria);

  return (
    <section className="panel">
      <h2>Evaluate a team</h2>

      <label className="field">
        Judging as
        <select value={mentorId} onChange={(e) => setMentorPick(e.target.value)}>
          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>

      <label className="field">
        Team
        <select value={teamId} onChange={(e) => setTeamPick(e.target.value)}>
          <option value="">Choose a team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>Table {t.table} - {t.name}</option>)}
        </select>
      </label>

      {teamId && (
        <>
          {criteria.map((c) => (
            <label className="field" key={c.id}>
              <span className="row">
                <span>{c.label} <small>weight {Math.round(c.weight * 100)}%</small></span>
                <strong className="score">{value(c)}</strong>
              </span>
              <input
                type="range" min="0" max={MAX_SCORE} step="1" value={value(c)}
                onChange={(e) => { setScores({ ...scores, [c.id]: Number(e.target.value) }); setSaved(false); }}
              />
            </label>
          ))}

          <label className="field">
            Comment
            <textarea rows="3" value={comment} onChange={(e) => { setComment(e.target.value); setSaved(false); }} />
          </label>

          <div className="row">
            <span>Total: <strong>{total.toFixed(2)}</strong> / {MAX_SCORE}</span>
            <button
              className="primary"
              onClick={() => { submitEvaluation({ teamId, mentorId, scores: Object.fromEntries(criteria.map((c) => [c.id, value(c)])), comment }); setSaved(true); }}
            >
              {editing ? 'Update evaluation' : 'Submit evaluation'}
            </button>
          </div>
          {saved && <p className="ok">Saved. You can edit it again any time.</p>}
        </>
      )}
    </section>
  );
}
