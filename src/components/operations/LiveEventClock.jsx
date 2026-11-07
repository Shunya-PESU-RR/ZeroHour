import { useEffect, useRef, useState } from 'react';
import { clockReading, istTimestamp } from '../../lib/eventClock';
import { operationsRpc, useOperationsRead, useOperationsRpc } from '../../lib/liveOperations';
import { Badge, Field, WorkspaceCard } from './WorkspaceUI';

export default function LiveEventClock({ admin = false }) {
  const client = useOperationsRpc();
  const [revision, setRevision] = useState(0);
  const sample = useOperationsRead('event_clock_state', revision);
  const [now, setNow] = useState(() => performance.now());
  const [start, setStart] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const lock = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const clock = sample?.data ? clockReading(sample, Math.max(now, sample.sampledAt)) : null;
  async function change(action) {
    if (lock.current) return;
    if (action === 'end' && !window.confirm('End the official event now?')) return;
    lock.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await operationsRpc(client, 'event_clock_control', { p_action: action, p_start: action === 'schedule' ? start + ':00+05:30' : null });
      setFeedback({ message: 'Official event clock updated.' });
      setRevision(value => value + 1);
    } catch (error) {
      setFeedback({ message: error.message, error: true });
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return <WorkspaceCard title="Event clock" label="24-HOUR MATHEMATICS HACKATHON" badge={<Badge>{clock?.label ?? 'Synchronizing'}</Badge>}>
    {!sample && <p role="status">Loading official clock…</p>}
    {sample?.error && <p role="alert">{sample.error}</p>}
    {clock && <>
      <div className="ops-clock">{clock.display}</div>
      <p>{clock.phase === 'before' ? 'Time until start' : clock.label}</p>
      <p>Start {istTimestamp(sample.data.starts_at)} · End {istTimestamp(sample.data.ends_at)}</p>
      {admin && <div className="ops-actions">
        <Field label="Official start time (IST)"><input type="datetime-local" value={start} onChange={event => setStart(event.target.value)} /></Field>
        <button disabled={pending || !start || !['before','unscheduled'].includes(clock.phase)} onClick={() => change('schedule')}>Set start</button>
        <button disabled={pending || !['before','unscheduled'].includes(clock.phase)} onClick={() => change('start')}>Start now</button>
        <button disabled={pending || clock.phase !== 'live'} onClick={() => change('end')}>End early</button>
      </div>}
    </>}
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </WorkspaceCard>;
}
