import { useState } from 'react';
import { initialReviewRounds, rubricTotal, validRound } from '../../config/operations';
import { Badge, Field, PendingNotice } from './WorkspaceUI';

export default function RoundEditor() {
  const [rounds, setRounds] = useState(initialReviewRounds);
  const [selected, setSelected] = useState('round-1');
  const [validation, setValidation] = useState('');
  const active = rounds.find(round => round.id === selected);
  function edit(patch) { setRounds(previous => previous.map(round => round.id === selected ? { ...round, ...patch } : round)); setValidation(''); }
  function addRound() {
    const id = crypto.randomUUID();
    setRounds(previous => [...previous, { id, name: 'Untitled review', window: '', metrics: [] }]);
    setSelected(id); setValidation('');
  }
  function editMetric(id, patch) { edit({ metrics: active.metrics.map(metric => metric.id === id ? { ...metric, ...patch } : metric) }); }
  const valid = rounds.every(validRound);
  return <div className="ops-round-editor">
    <PendingNotice>Local configuration draft. The three supplied rubrics are editable defaults; nothing is published or used by live scoring.</PendingNotice>
    <div className="ops-round-tabs" aria-label="Choose a draft review round">{rounds.map((round, index) => <button type="button" key={round.id} className={selected === round.id ? 'selected' : ''} aria-pressed={selected === round.id} onClick={() => { setSelected(round.id); setValidation(''); }}>
      <span>ROUND {index + 1}</span><strong>{round.name}</strong><small>{rubricTotal(round.metrics)} / 100 marks</small>
    </button>)}</div>
    <div className="ops-form-grid"><Field label="Round name"><input value={active.name} onChange={event => edit({ name: event.target.value })} /></Field>
      <Field label="Suggested event-clock window" hint="Draft label, not an authoritative event schedule."><input value={active.window} onChange={event => edit({ window: event.target.value })} placeholder="e.g. Hour 2–4" /></Field></div>
    <div className="ops-metrics-heading"><h3>Grading metrics</h3><Badge tone={validRound(active) ? 'mint' : 'coral'}>{rubricTotal(active.metrics)} / 100 marks</Badge></div>
    <p className="ops-help">Maximum marks are each metric’s share of the 100-mark total.</p>
    <div className="ops-metrics">{active.metrics.map((metric, index) => <div className="ops-metric" key={metric.id}>
      <Field label={`Metric ${index + 1}`}><input value={metric.label} onChange={event => editMetric(metric.id, { label: event.target.value })} /></Field>
      <Field label="Max marks"><input type="number" min="1" max="100" step="1" value={metric.max} onChange={event => editMetric(metric.id, { max: event.target.value })} /></Field>
      <button type="button" aria-label={`Remove metric ${index + 1}`} onClick={() => edit({ metrics: active.metrics.filter(item => item.id !== metric.id) })}>Remove</button>
    </div>)}</div>
    <div className="ops-actions"><button type="button" onClick={() => edit({ metrics: [...active.metrics, { id: crypto.randomUUID(), label: '', max: 0 }] })}>+ Add metric</button>
      <button type="button" onClick={addRound}>+ Add round</button><button type="button" disabled={rounds.length === 1} onClick={() => { const next = rounds.filter(round => round.id !== selected); setRounds(next); setSelected(next[0].id); setValidation(''); }}>Remove round</button>
      <button type="button" onClick={() => setValidation(valid ? 'All draft rubrics total 100 marks and have named metrics. Nothing was published.' : 'Each round needs a name, named metrics with positive maximum marks, and a total of exactly 100.')}>Validate drafts</button>
      <button type="button" className="primary" disabled>Publish unavailable</button></div>
    {validation && <p role="status" className={valid ? 'ok' : 'err'}>{validation}</p>}
    <p className="ops-help">Drafts remain in memory while this workspace is open. Refreshing or leaving the dashboard clears them.</p>
  </div>;
}
