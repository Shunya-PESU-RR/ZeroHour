import { useEffect, useState } from 'react';
import { RUBRIC, MAX_SCORE, weightedScore } from '../../config/rubric';
import { useData, selectTeams, getEvaluation, submitEvaluation } from '../../lib/api';

const emptyScores = () => Object.fromEntries(RUBRIC.map((c) => [c.id, 5]));

export default function EvaluationForm({ mentorId }) {
  const teams = useData(selectTeams);
  const [teamId, setTeamId] = useState('');
  const [scores, setScores] = useState(emptyScores);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  // Load an existing evaluation when the team or mentor changes, so edits are possible
  useEffect(() => {
    if (!teamId) return;
    const existing = getEvaluation(teamId, mentorId);
    setScores(existing ? existing.scores : emptyScores());
    setComment(existing ? existing.comment : '');
    setSaved(false);
  }, [teamId, mentorId]);

  const editing = teamId && getEvaluation(teamId, mentorId);

  function handleSubmit() {
    submitEvaluation({ teamId, mentorId, scores, comment });
    setSaved(true);
  }

  return (
    <section className="panel">
      <h2>Evaluate a team</h2>

      <label className="field">
        Team
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Choose a team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>Table {t.table} - {t.name}</option>
          ))}
        </select>
      </label>

      {teamId && (
        <>
          {RUBRIC.map((c) => (
            <label className="field" key={c.id}>
              <span className="row">
                {c.label} <small>weight {Math.round(c.weight * 100)}%</small>
                <strong className="score">{scores[c.id]}</strong>
              </span>
              <input
                type="range" min="0" max={MAX_SCORE} step="1"
                value={scores[c.id]}
                onChange={(e) => { setScores({ ...scores, [c.id]: Number(e.target.value) }); setSaved(false); }}
              />
            </label>
          ))}

          <label className="field">
            Comment
            <textarea rows="3" value={comment} onChange={(e) => { setComment(e.target.value); setSaved(false); }} />
          </label>

          <div className="row">
            <span>Total: <strong>{weightedScore(scores).toFixed(2)}</strong> / {MAX_SCORE}</span>
            <button className="primary" onClick={handleSubmit}>
              {editing ? 'Update evaluation' : 'Submit evaluation'}
            </button>
          </div>
          {saved && <p className="ok">Saved. You can edit it again any time.</p>}
        </>
      )}
    </section>
  );
}
