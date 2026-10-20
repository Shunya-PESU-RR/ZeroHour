import { useState } from 'react';
import {
  useData, selectTeams, selectMentors, selectCriteria, selectRegistrations, selectAccessRequests,
  replaceTeams, replaceMentors, replaceCriteria, setAccessStatus,
} from '../lib/api';
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
  const criteria = useData(selectCriteria);
  const registrations = useData(selectRegistrations);
  const accessRequests = useData(selectAccessRequests);

  const apply = (parse, replace, label) => (text) => {
    const res = parse(text);
    if (res.error) return { ok: false, message: res.error };
    replace(res.items);
    return { ok: true, message: 'Loaded ' + res.items.length + ' ' + label + '. Existing evaluations were cleared.' };
  };

  return (
    <section className="panel wide">
      <h2>Setup</h2>
      <p className="muted">Upload a .txt or .csv file (or paste text) and press Apply. Applying replaces the current list and clears evaluations.</p>

      <div className="grid3">
        <UploadBox title="Teams" current={teams.length + ' loaded'}
          help="One team per line. Optionally start with the table number: 12, Team name."
          example={'1, Team Alpha\n2, Byte Me'}
          onApply={apply(parseTeams, replaceTeams, 'teams')} />
        <UploadBox title="Evaluation criteria" current={criteria.length + ' loaded'}
          help="One per line: criterion name, weight. Weights are normalised to 100%."
          example={'Idea & originality, 25\nTechnical execution, 30'}
          onApply={apply(parseCriteria, replaceCriteria, 'criteria')} />
        <UploadBox title="Mentors" current={mentors.length + ' loaded'}
          help="One mentor name per line."
          example={'Asha\nRahul'}
          onApply={apply(parseNames, replaceMentors, 'mentors')} />
      </div>

      <h3>Registrations <small>{registrations.length}</small></h3>
      {registrations.length === 0 ? <p className="empty">No registrations yet.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Team</th><th>College</th><th>Email</th><th>Members</th></tr></thead>
          <tbody>{registrations.map((r) => (
            <tr key={r.id}><td>{r.teamName}</td><td>{r.college || '-'}</td><td>{r.email}</td><td>{r.members.join(', ')}</td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h3>Mentor access requests <small>{accessRequests.length}</small></h3>
      {accessRequests.length === 0 ? <p className="empty">No requests yet.</p> : (
        <div className="scroll"><table>
          <thead><tr><th>Team</th><th>Email</th><th>Note</th><th>Status</th><th></th></tr></thead>
          <tbody>{accessRequests.map((a) => (
            <tr key={a.id}>
              <td>{a.teamName}</td><td>{a.email}</td><td>{a.note || '-'}</td><td>{a.status}</td>
              <td>
                <div className="row">
                  <button onClick={() => setAccessStatus(a.id, 'approved')}>Approve</button>
                  <button onClick={() => setAccessStatus(a.id, 'rejected')}>Reject</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
