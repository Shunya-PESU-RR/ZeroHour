import { useState } from 'react';
import { useData, selectTeams, selectMentors, selectError, selectLoading } from '../lib/api';
import { getLocalSetup, replaceLocalList, setLocalAccessStatus } from '../lib/localSetup';
import { parseTeams, parseCriteria, parseNames } from '../lib/parse';

function UploadBox({ title, help, example, current, onApply }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);

  function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(file);
  }

  return (
    <div className="upload">
      <h3>{title} <small>{current}</small></h3>
      <p className="muted">{help}</p>
      <input type="file" accept=".txt,.csv" onChange={onFile} />
      <textarea rows="5" value={text} placeholder={example} onChange={(e) => setText(e.target.value)} />
      <button className="primary" onClick={() => setMsg(onApply(text))}>Apply</button>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.message}</p>}
    </div>
  );
}

export default function Setup() {
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const loading = useData(selectLoading);
  const error = useData(selectError);
  const [local, setLocal] = useState(getLocalSetup);
  const [accessError, setAccessError] = useState('');
  const { criteria, registrations, accessRequests } = local;

  const apply = (parse, key) => (text) => {
    const res = parse(text);
    if (res.error) return { ok: false, message: res.error };
    try {
      setLocal(replaceLocalList(key, res.items));
      return { ok: true, message: 'Saved ' + res.items.length + ' entries in this browser.' };
    } catch {
      return { ok: false, message: 'Could not save the entries in this browser.' };
    }
  };

  function changeAccessStatus(id, status) {
    setAccessError('');
    try {
      setLocal(setLocalAccessStatus(id, status));
    } catch {
      setAccessError('Could not save the status in this browser.');
    }
  }

  return (
    <section className="panel wide">
      <h2>Setup</h2>
      {error && <p className="err" role="alert">{error}</p>}
      {loading ? <p role="status">Loading live roster…</p> : (
        <p>Live roster: {teams.length} teams · {mentors.length} staff</p>
      )}
      <p className="muted">Uploads, registration records, and access approvals below are stored in this browser. Live scoring uses the event rubric.</p>

      <div className="grid3">
        <UploadBox title="Local teams" current={local.teams.length + ' saved'}
          help="One team per line. Optionally start with the table number: 12, Team name."
          example={'1, Team Alpha\n2, Byte Me'}
          onApply={apply(parseTeams, 'teams')} />
        <UploadBox title="Local evaluation criteria" current={criteria.length + ' saved'}
          help="One per line: criterion name, weight. Weights are normalised to 100%."
          example={'Idea & originality, 25\nTechnical execution, 30'}
          onApply={apply(parseCriteria, 'criteria')} />
        <UploadBox title="Local mentors" current={local.mentors.length + ' saved'}
          help="One mentor name per line."
          example={'Asha\nRahul'}
          onApply={apply(parseNames, 'mentors')} />
      </div>

      <h3>Local registrations <small>{registrations.length}</small></h3>
      {registrations.length === 0 ? <p className="empty">No registrations yet.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Team</th><th>College</th><th>Email</th><th>Members</th></tr></thead>
          <tbody>{registrations.map((r) => (
            <tr key={r.id}><td>{r.teamName}</td><td>{r.college || '-'}</td><td>{r.email}</td><td>{r.members.join(', ')}</td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h3>Local mentor access requests <small>{accessRequests.length}</small></h3>
      {accessError && <p className="err" role="alert">{accessError}</p>}
      {accessRequests.length === 0 ? <p className="empty">No requests yet.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Team</th><th>Email</th><th>Note</th><th>Status</th><th></th></tr></thead>
          <tbody>{accessRequests.map((a) => (
            <tr key={a.id}>
              <td>{a.teamName}</td><td>{a.email}</td><td>{a.note || '-'}</td><td>{a.status}</td>
              <td>
                <div className="row">
                  <button onClick={() => changeAccessStatus(a.id, 'approved')}>Approve</button>
                  <button onClick={() => changeAccessStatus(a.id, 'rejected')}>Reject</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
