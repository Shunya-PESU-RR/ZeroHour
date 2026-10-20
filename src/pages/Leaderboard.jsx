import { useState } from 'react';
import { weightedScore } from '../config/rubric';
import { useData, selectTeams, selectMentors, selectEvaluations, selectCriteria } from '../lib/api';

const FILTERS = [10, 20, 'All'];

export default function Leaderboard() {
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const evaluations = useData(selectEvaluations);
  const criteria = useData(selectCriteria);
  const [filter, setFilter] = useState(10);

  const rows = teams
    .map((team) => {
      const evs = evaluations.filter((e) => e.teamId === team.id);
      const perMentor = Object.fromEntries(evs.map((e) => [e.mentorId, weightedScore(e.scores, criteria)]));
      const avg = evs.length ? evs.reduce((s, e) => s + weightedScore(e.scores, criteria), 0) / evs.length : null;
      return { team, perMentor, avg, count: evs.length };
    })
    .filter((r) => r.avg !== null)
    .sort((a, b) => b.avg - a.avg || b.count - a.count || a.team.name.localeCompare(b.team.name));

  const shown = filter === 'All' ? rows : rows.slice(0, filter);

  return (
    <section className="panel wide">
      <h2>Leaderboard</h2>
      <div className="row">
        <p>{rows.length} of {teams.length} teams scored</p>
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'All' ? 'All' : 'Top ' + f}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="empty">No evaluations yet. Scores appear here as mentors submit them.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Team</th>
                {mentors.map((m) => <th key={m.id}>{m.name}</th>)}
                <th>Evals</th><th>Average / 10</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.team.id}>
                  <td>{i + 1}</td>
                  <td>Table {r.team.table} - {r.team.name}</td>
                  {mentors.map((m) => (
                    <td key={m.id}>{r.perMentor[m.id] !== undefined ? r.perMentor[m.id].toFixed(2) : '-'}</td>
                  ))}
                  <td>{r.count} of {mentors.length}</td>
                  <td className="done">{r.avg.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
