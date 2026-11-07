import { useState } from 'react';
import { weightedScore } from '../config/rubric';
import { useAuth } from '../context/useAuth';
import {
  useData,
  selectTeams,
  selectMentors,
  selectSubmittedEvaluations,
  selectLoading,
  selectError,
} from '../lib/api';

const FILTERS = [10, 20, 'All'];

export default function Leaderboard() {
  const { isOrganizer } = useAuth();
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const submittedEvals = useData(selectSubmittedEvaluations);
  const loading = useData(selectLoading);
  const error = useData(selectError);
  const [filter, setFilter] = useState(10);
  if (!isOrganizer) return <section className="panel"><h2>Leaderboard access pending</h2><p>Global rankings require a verified publication policy. Your own evaluation history is available in the mentor workspace.</p></section>;

  // One row per team that has at least one submitted evaluation: average of the mentors' weighted scores
  const rows = teams
    .map((team) => {
      const evs = submittedEvals.filter((e) => e.teamId === team.id);
      const perMentor = Object.fromEntries(
        evs.map((e) => [e.mentorId, weightedScore(e.scores)])
      );
      const avg = evs.length
        ? evs.reduce((sum, e) => sum + weightedScore(e.scores), 0) / evs.length
        : null;
      return { team, perMentor, avg, count: evs.length };
    })
    .filter((r) => r.avg !== null)
    // Tie-break: highest average score, then more evaluations submitted, then team name
    .sort(
      (a, b) =>
        b.avg - a.avg ||
        b.count - a.count ||
        a.team.name.localeCompare(b.team.name)
    );

  const shown = filter === 'All' ? rows : rows.slice(0, filter);

  return (
    <section className="panel wide">
      <h2>Leaderboard</h2>

      {error && (
        <p style={{ color: 'var(--warn)', margin: '8px 0 16px', fontWeight: 600 }}>
          {error}
        </p>
      )}

      <div className="row">
        <p>
          {loading && teams.length === 0
            ? 'Loading rankings...'
            : `${rows.length} of ${teams.length} teams scored`}
        </p>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={filter === f ? 'active' : ''}
              onClick={() => setFilter(f)}
            >
              {f === 'All' ? 'All' : 'Top ' + f}
            </button>
          ))}
        </div>
      </div>

      {loading && teams.length === 0 ? (
        <p className="empty">Loading leaderboard data from Supabase...</p>
      ) : shown.length === 0 ? (
        <p className="empty">
          No submitted evaluations yet. Scores will appear here as mentors submit them.
        </p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                {mentors.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
                <th>Evals</th>
                <th>Average / 10</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.team.id}>
                  <td className="numeric">{i + 1}</td>
                  <td>Table {r.team.table} - {r.team.name}</td>
                  {mentors.map((m) => (
                    <td className="numeric" key={m.id}>
                      {r.perMentor[m.id] !== undefined
                        ? r.perMentor[m.id].toFixed(2)
                        : '-'}
                    </td>
                  ))}
                  <td className="numeric">
                    {r.count} of {mentors.length}
                  </td>
                  <td className="done numeric">{r.avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
