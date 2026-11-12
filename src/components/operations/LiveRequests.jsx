import { useRef, useState } from 'react';
import { istTimestamp } from '../../lib/eventClock';
import { operationsRpc, useOperationsRead, useOperationsRpc } from '../../lib/liveOperations';
import { Badge, EmptyState, Field, WorkspaceCard } from './WorkspaceUI';

const labels = { open: 'Pending', claimed: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', cancelled: 'Cancelled' };
const active = request => ['open', 'claimed', 'in_progress'].includes(request.status);

export default function LiveRequests({ team, admin = false, mentors = [], enabled = true }) {
  const client = useOperationsRpc();
  const [revision, setRevision] = useState(0);
  const result = useOperationsRead('live_mentor_requests', revision, null, enabled);
  const [reason, setReason] = useState('');
  const [filter, setFilter] = useState('all');
  const [oldest, setOldest] = useState(false);
  const [selected, setSelected] = useState(null);
  const [assignment, setAssignment] = useState({});
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const lock = useRef(false);
  const submission = useRef(null);
  const audit = useOperationsRead('live_request_activity', revision, selected, enabled && admin && Boolean(selected));
  const rows = result?.data ?? [];
  const filtered = rows.filter(row => filter === 'all' || row.status === filter);
  if (oldest) filtered.reverse();

  async function mutate(name, args) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await operationsRpc(client, name, args);
      if (name === 'submit_mentor_request') {
        submission.current = null;
        setReason('');
      }
      setFeedback({ message: name === 'submit_mentor_request' ? 'Mentor request submitted.' : 'Request updated.' });
      setRevision(value => value + 1);
    } catch (error) {
      setFeedback({ error: true, message: error.message });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!result?.data || lock.current || rows.some(active) || !reason.trim()) return;
    if (submission.current?.reason !== reason) submission.current = { reason, key: crypto.randomUUID() };
    void mutate('submit_mentor_request', { p_reason: reason, p_submission_key: submission.current.key });
  }

  function update(id, action) {
    if (action === 'cancel' && !window.confirm('Cancel this mentor request?')) return;
    void mutate('update_mentor_request', { p_id: id, p_action: action, p_mentor: action === 'assign' ? assignment[id] : null });
  }

  return <WorkspaceCard title={team ? 'Mentor assistance' : admin ? 'Mentor request queue' : 'Your assigned requests'}>
    {!result && <p role="status">Loading requests…</p>}
    {result?.error && <p role="alert">{result.error}</p>}
    {team && <form onSubmit={submit} className="ops-stack">
      <p>{team.team_name} · Table {team.table_number}</p>
      <Field label="What do you need help with?"><textarea required maxLength={2000} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} /></Field>
      <button type="submit" className="primary" disabled={pending || !result?.data || rows.some(active) || !reason.trim()}>Request a mentor</button>
      {rows.some(active) && <p>Your team already has an active request.</p>}
    </form>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    {result?.data && <>
      <div className="ops-form-grid">
        <Field label="Status"><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Submission order"><select value={oldest ? 'oldest' : 'newest'} onChange={event => setOldest(event.target.value === 'oldest')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></Field>
      </div>
      {!filtered.length && <EmptyState title="No matching mentor requests" />}
      <div className="ops-stack">
        {filtered.map(row => <article key={row.id} className="ops-card">
          <h3>{row.team_name || 'Historical request'} · Table {row.table_number}</h3>
          <Badge>{labels[row.status] ?? row.status}</Badge>
          <p className="ops-full-text">{row.issue}</p>
          <p>{istTimestamp(row.created_at)} · Mentor {row.mentor_name || 'Unassigned'}</p>
          {!team && <div className="ops-actions">
            {admin && row.status === 'open' && <>
              <Field label="Available mentor"><select value={assignment[row.id] || ''} onChange={event => setAssignment(previous => ({ ...previous, [row.id]: event.target.value }))}>
                <option value="">Select a mentor</option>
                {mentors.filter(mentor => mentor.role === 'mentor' && !rows.some(request => active(request) && request.claimed_by === mentor.id)).map(mentor => <option key={mentor.id} value={mentor.id}>{mentor.name}</option>)}
              </select></Field>
              <button disabled={pending || !assignment[row.id]} onClick={() => update(row.id, 'assign')}>Assign</button>
            </>}
            {row.status === 'claimed' && <button disabled={pending} onClick={() => update(row.id, 'progress')}>In Progress</button>}
            {['claimed', 'in_progress'].includes(row.status) && <button disabled={pending} onClick={() => update(row.id, 'resolve')}>Resolve</button>}
            {admin && active(row) && <button disabled={pending} onClick={() => update(row.id, 'cancel')}>Cancel request</button>}
            {admin && <button onClick={() => setSelected(selected === row.id ? null : row.id)} aria-expanded={selected === row.id}>Activity</button>}
          </div>}
          {selected === row.id && <>
            {!audit && <p role="status">Loading activity…</p>}
            {audit?.error && <p role="alert">{audit.error}</p>}
            {audit?.data?.length ? <ul>{audit.data.map((entry, index) => <li key={index}>{entry.action.replaceAll('_', ' ')} · {istTimestamp(entry.created_at)}</li>)}</ul> : audit?.data && <p>No recorded activity.</p>}
          </>}
        </article>)}
      </div>
    </>}
  </WorkspaceCard>;
}
