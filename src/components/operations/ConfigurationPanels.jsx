import LiveEventClock from './LiveEventClock';
import { useState } from 'react';
import { Badge, EmptyState, EventTimeline, Field, PendingNotice, WorkspaceCard } from './WorkspaceUI';

export function TrackConfiguration() {
  const [tracks, setTracks] = useState([]);
  const [problems, setProblems] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trackId, setTrackId] = useState('');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  return <div className="ops-stack">
    <PendingNotice>Local drafts only. Nothing here creates a live track, changes a team assignment, or publishes a problem statement. Refresh clears drafts.</PendingNotice>
    <div className="ops-grid ops-split">
      <WorkspaceCard title="Track management" badge={<Badge tone="violet">Local draft</Badge>}>
        <form className="ops-form" onSubmit={event => { event.preventDefault(); if (!name.trim()) return; setTracks(previous => [...previous, { id: crypto.randomUUID(), name: name.trim(), description: description.trim() }]); setName(''); setDescription(''); }}>
          <Field label="Track name"><input required value={name} onChange={event => setName(event.target.value)} /></Field>
          <Field label="Description"><textarea rows="3" value={description} onChange={event => setDescription(event.target.value)} /></Field>
          <div className="ops-actions"><button type="submit">+ Add to local draft</button><button type="button" className="primary" disabled>Publish unavailable</button></div>
        </form>
        <div className="ops-draft-list">{tracks.length ? tracks.map(track => <article key={track.id}><strong>{track.name}</strong><p>{track.description || 'No description added.'}</p><Badge>Unpublished draft</Badge></article>) : <EmptyState title="No track drafts">Add a track to begin planning.</EmptyState>}</div>
      </WorkspaceCard>
      <WorkspaceCard title="Problem statements" badge={<Badge tone="violet">Local draft</Badge>}>
        <form className="ops-form" onSubmit={event => { event.preventDefault(); if (!title.trim() || !statement.trim() || !trackId) return; setProblems(previous => [...previous, { id: crypto.randomUUID(), trackId, title: title.trim(), statement: statement.trim() }]); setTitle(''); setStatement(''); }}>
          <Field label="Local draft track"><select required value={trackId} onChange={event => setTrackId(event.target.value)}><option value="">Choose a draft track</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}</select></Field>
          <Field label="Problem title"><input required value={title} onChange={event => setTitle(event.target.value)} /></Field>
          <Field label="Full problem statement"><textarea required rows="5" value={statement} onChange={event => setStatement(event.target.value)} /></Field>
          <div className="ops-actions"><button type="submit" disabled={!tracks.length}>+ Add to local draft</button><button type="button" className="primary" disabled>Publish unavailable</button></div>
        </form>
        <div className="ops-draft-list">{problems.map(problem => <article key={problem.id}><small>{tracks.find(track => track.id === problem.trackId)?.name}</small><h3>{problem.title}</h3><p>{problem.statement}</p><Badge>Unpublished draft</Badge></article>)}</div>
      </WorkspaceCard>
    </div>
    <WorkspaceCard title="Team and mentor track assignments"><EmptyState title="Live assignments are locked">Assignments will use the approved team-track and mentor-track relationships. Local draft tracks cannot be assigned to live people.</EmptyState></WorkspaceCard>
  </div>;
}

export function EventConfiguration() {
  const [phases, setPhases] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('1');
  const [error, setError] = useState('');
  return <div className="ops-stack">
    <PendingNotice>Timeline phases are local drafts. The official clock is managed separately above the phase editor.</PendingNotice>
    <LiveEventClock admin />
    <WorkspaceCard title="Phase editor" badge={<Badge tone="violet">Local draft</Badge>}>
      <form className="ops-form" onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || Number(start) >= Number(end)) { setError('Name the phase and set its end after its start.'); return; }
        if (phases.some(phase => Number(start) < Number(phase.end) && Number(end) > Number(phase.start))) { setError('This phase overlaps an existing draft phase.'); return; }
        setPhases(previous => [...previous, { id: crypto.randomUUID(), name: name.trim(), description, start: Number(start), end: Number(end) }].sort((a, b) => a.start - b.start));
        setName(''); setDescription(''); setError('');
      }}>
        <div className="ops-form-grid"><Field label="Phase name"><input required value={name} onChange={event => setName(event.target.value)} /></Field>
          <Field label="Start · elapsed hours"><input type="number" min="0" max="24" step="0.25" required value={start} onChange={event => setStart(event.target.value)} /></Field>
          <Field label="End · elapsed hours"><input type="number" min="0" max="24" step="0.25" required value={end} onChange={event => setEnd(event.target.value)} /></Field></div>
        <Field label="Description"><textarea rows="2" value={description} onChange={event => setDescription(event.target.value)} /></Field>
        <div className="ops-actions"><button type="submit">+ Add draft phase</button><button type="button" disabled={!phases.length} onClick={() => setPhases([])}>Clear draft phases</button><button type="button" className="primary" disabled>Publish unavailable</button></div>
        {error && <p className="err" role="alert">{error}</p>}
      </form>
    </WorkspaceCard>
    <WorkspaceCard title="Timeline preview" badge={<Badge>Not published</Badge>}><EventTimeline phases={phases} draft /></WorkspaceCard>
  </div>;
}
