import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { DEFAULT_CRITERIA, MAX_SCORE, weightedScore } from '../../config/rubric';
import { OPERATIONS_WRITES_READY, OPERATIONS_PENDING } from '../../config/operations';
import {
  useData,
  selectTeams,
  getEvaluation,
  selectLoading,
  selectError,
  submitEvaluation,
} from '../../lib/api';

const emptyScores = () => Object.fromEntries(DEFAULT_CRITERIA.map((c) => [c.id, 5]));

export default function EvaluationForm() {
  const { mentorId, isOrganizer } = useAuth();
  const teamsLoading = useData(selectLoading);
  const teamsError = useData(selectError);
  const teams = useData(selectTeams);
  const [teamId, setTeamId] = useState('');
  const [scores, setScores] = useState(emptyScores);
  const [comment, setComment] = useState('');
  const [existingEval, setExistingEval] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load existing evaluation asynchronously when teamId or mentorId changes
  useEffect(() => {
    if (!teamId || !mentorId) return;

    let isMounted = true;

    async function loadEvaluation() {
      try {
        const data = await getEvaluation(teamId);
        if (!isMounted) return;
        setScores({ ...emptyScores(), ...data?.scores });
        setComment(data?.comment ?? '');
        setExistingEval(data);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load existing evaluation:', err);
        setLoadFailed(true);
        setErrorMessage(err.message || 'Failed to load existing evaluation.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadEvaluation();

    return () => {
      isMounted = false;
    };
  }, [teamId, mentorId]);

  const handleTeamChange = (e) => {
    const selected = e.target.value;
    setTeamId(selected);
    setSavedMessage('');
    setErrorMessage('');
    setLoadFailed(false);
    setIsLoading(Boolean(selected));
    setScores(emptyScores());
    setComment('');
    setExistingEval(null);
  };

  const isEditing = Boolean(existingEval);
  const isSubmitted = existingEval?.status === 'submitted';

  async function handleSave(statusToSet) {
    if (!teamId) {
      setErrorMessage('Please select a team.');
      return;
    }
    if (!mentorId) {
      setErrorMessage('No active mentor identity detected.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSavedMessage('');

    try {
      const saved = await submitEvaluation({
        teamId,
        scores,
        comment,
        status: statusToSet,
      });

      setExistingEval(saved);
      setSavedMessage(
        statusToSet === 'submitted'
          ? 'Evaluation successfully submitted. Scores are updated on the leaderboard.'
          : 'Evaluation saved as draft.'
      );
    } catch (err) {
      console.error('Submit evaluation error:', err);
      setErrorMessage(err.message || 'Failed to save evaluation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>Evaluate a team</h2>
      <Link className="btn" to={isOrganizer ? '/admin/dashboard' : '/mentor'}>Open {isOrganizer ? 'operations' : 'mentor'} workspace ↗</Link>
      <p className="ops-notice">Legacy four-metric scoring form. {OPERATIONS_PENDING} Draft review-round rubrics do not change these scores.</p>

      {teamsError && <p className="err" role="alert">{teamsError}</p>}
      {teamsLoading && <p role="status">Loading teams…</p>}
      <label className="field">
        Team
        <select value={teamId} onChange={handleTeamChange} disabled={isSubmitting || teamsLoading}>
          <option value="">Choose a team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.table} - {t.name}
            </option>
          ))}
        </select>
      </label>

      {isLoading && <p className="empty">Loading evaluation record...</p>}

      {errorMessage && <p className="err" role="alert">{errorMessage}</p>}
      {teamId && !isLoading && !loadFailed && (
        <>
          {existingEval && (
            <p style={{ margin: '4px 0 16px', fontSize: '0.85rem' }}>
              Current Status:{' '}
              <strong style={{ color: isSubmitted ? 'var(--ok)' : 'var(--warn)' }}>
                {isSubmitted ? 'Submitted' : 'Draft'}
              </strong>
            </p>
          )}

          {DEFAULT_CRITERIA.map((c) => (
            <label className="field" key={c.id}>
              <span className="row">
                {c.label} <small>weight {Math.round(c.weight * 100)}%</small>
                <strong className="score">{scores[c.id] ?? 0}</strong>
              </span>
              <input
                type="range"
                min="0"
                max={MAX_SCORE}
                step="1"
                value={scores[c.id] ?? 0}
                onChange={(e) => {
                  setScores({ ...scores, [c.id]: Number(e.target.value) });
                  setSavedMessage('');
                }}
              />
            </label>
          ))}

          <label className="field">
            Comment
            <textarea
              rows="3"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSavedMessage('');
              }}
              placeholder="Constructive feedback for the team..."
            />
          </label>

          <div className="row" style={{ gap: '10px' }}>
            <span>
              Total: <strong>{weightedScore(scores).toFixed(2)}</strong> / {MAX_SCORE}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                disabled={!OPERATIONS_WRITES_READY || isSubmitting || (isSubmitted && !isOrganizer)}
                onClick={() => handleSave('draft')}
              >
                {isSubmitting ? 'Saving...' : 'Save draft'}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!OPERATIONS_WRITES_READY || isSubmitting}
                onClick={() => handleSave('submitted')}
              >
                {isSubmitting
                  ? 'Saving...'
                  : isEditing && isSubmitted
                  ? 'Update evaluation'
                  : 'Submit evaluation'}
              </button>
            </div>
          </div>

          {savedMessage && <p className="ok">{savedMessage}</p>}
        </>
      )}
    </section>
  );
}
