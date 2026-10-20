import { useState } from 'react';
import { weightedScore } from '../config/rubric';
import {
  useData, selectRequests, selectTeams, selectMentors, selectEvaluations, selectCriteria,
  updateRequest, createRequest,
} from '../lib/api';
import { REQUEST_STATUS as S } from '../types';

function RequestsTab() {
  const requests = useData(selectRequests);
  const mentors = useData(selectMentors);
  const teams = useData(selectTeams);
  const [claimer, setClaimer] = useState({});
  const mentorName = (id) => mentors.find((m) => m.id === id)?.name ?? '-';
  const columns = [
    { key: S.OPEN, title: 'Open' },
    { key: S.CLAIMED, title: 'Claimed' },
    { key: S.RESOLVED, title: 'Resolved' },
  ];

  return (
    <>
      <button className="ghost" disabled={!teams.length} onClick={() => {
        const t = teams[Math.floor(Math.random() * teams.length)];
        createRequest({ table: t.table, issue: 'Test request from table ' + t.table });
      }}>Add test request</button>

      <div className="board">
        {columns.map((col) => {
          const items = requests.filter((r) => r.status === col.key);
          return (
            <div className="column" key={col.key}>
              <h3>{col.title} <small>{items.length}</small></h3>
              {items.length === 0 && <p className="empty">No {col.title.toLowerCase()} requests.</p>}
              {items.map((r) => (
                <div className={'card ' + r.status} key={r.id}>
                  <strong>Table {r.table}</strong>
                  <p>{r.issue}</p>
                  {r.claimedBy && <small>Mentor: {mentorName(r.claimedBy)}</small>}
                  <div className="row">
                    {r.status === S.OPEN && (
                      <>
                        <select value={claimer[r.id] || ''} onChange={(e) => setClaimer({ ...claimer, [r.id]: e.target.value })}>
                          <option value="">Assign mentor</option>
                          {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button disabled={!claimer[r.id]} onClick={() => updateRequest(r.id, { status: S.CLAIMED, claimedBy: claimer[r.id] })}>Claim</button>
                      </>
                    )}
                    {r.status === S.CLAIMED && (
                      <>
                        <button onClick={() => updateRequest(r.id, { status: S.OPEN, claimedBy: null })}>Release</button>
                        <button className="primary" onClick={() => updateRequest(r.id, { status: S.RESOLVED })}>Resolve</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function EvaluationsTab() {
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const evaluations = useData(selectEvaluations);
  const criteria = useData(selectCriteria);
  const find = (teamId, mentorId) => evaluations.find((e) => e.teamId === teamId && e.mentorId === mentorId);
  const done = evaluations.length;
  const total = teams.length * mentors.length;

  return (
    <>
      <p>{done} of {total} evaluations submitted ({total ? Math.round((done / total) * 100) : 0}%)</p>
      <div className="scroll">
        <table>
          <thead>
            <tr><th>Team</th>{mentors.map((m) => <th key={m.id}>{m.name}</th>)}</tr>
          </thead>
          <tbody>
            {teams.map((t) => (
              <tr key={t.id}>
                <td>Table {t.table} - {t.name}</td>
                {mentors.map((m) => {
                  const ev = find(t.id, m.id);
                  return (
                    <td key={m.id} className={ev ? 'done' : 'pending'} title={ev?.comment || ''}>
                      {ev ? weightedScore(ev.scores, criteria).toFixed(2) : 'Pending'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState('requests');
  return (
    <section className="panel wide">
      <h2>Organizer dashboard</h2>
      <div className="tabs">
        <button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Mentor requests</button>
        <button className={tab === 'evals' ? 'active' : ''} onClick={() => setTab('evals')}>Evaluation progress</button>
      </div>
      {tab === 'requests' ? <RequestsTab /> : <EvaluationsTab />}
    </section>
  );
}
