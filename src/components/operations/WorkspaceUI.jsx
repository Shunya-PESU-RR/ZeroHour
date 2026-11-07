import { useId, useState } from 'react';
import logo from '../../assets/shunya-logo.svg';
import './operations.css';

export function Badge({ children, tone = 'muted' }) {
  return <span className={`ops-badge ops-badge-${tone}`}>{children}</span>;
}
export function WorkspaceHeader({ eyebrow, title, description, actions }) {
  return <header className="ops-header">
    <div className="ops-heading"><img src={logo} width="48" height="48" alt="SHUNYA" />
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div></div>
    {actions && <div className="ops-actions">{actions}</div>}
    {description && <p className="ops-description">{description}</p>}
  </header>;
}
export function WorkspaceCard({ title, label, badge, children, className = '' }) {
  const id = useId();
  return <section className={`ops-card ${className}`} aria-labelledby={id}>
    <header className="ops-card-header"><div>{label && <p className="eyebrow">{label}</p>}<h2 id={id}>{title}</h2></div>{badge}</header>
    {children}
  </section>;
}
export function EmptyState({ title, children }) {
  return <div className="ops-empty"><span aria-hidden="true">↗</span><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
export function PendingNotice({ children = 'This feature is awaiting its backend integration. No changes are sent to Supabase.' }) {
  return <p className="ops-notice"><Badge tone="violet">Backend pending</Badge><span>{children}</span></p>;
}
export function StatCard({ label, value, detail }) {
  return <article className="ops-stat"><p>{label}</p><strong className="numeric">{value ?? '—'}</strong><small>{detail}</small></article>;
}
export function Field({ label, children, hint }) {
  return <label className="ops-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function EventTimeline({ phases = [], draft = false }) {
  const [selected, setSelected] = useState(null);
  const current = phases.find(phase => phase.id === selected);
  return <div className="ops-timeline">
    {phases.length ? <>
      <ol>{phases.map(phase => <li key={phase.id}><button type="button" className={selected === phase.id ? 'selected' : ''} onClick={() => setSelected(phase.id)} aria-pressed={selected === phase.id}>
        <span className="ops-timeline-dot" /><strong>{phase.name}</strong><small>{phase.start}–{phase.end} h {draft ? '· draft' : ''}</small>
      </button></li>)}</ol>
      <div className="ops-timeline-detail">{current ? <><h3>{current.name}</h3><p>{current.description || 'No description added.'}</p></> : <p>Select a phase to inspect its details.</p>}</div>
    </> : <EmptyState title="Timeline not published">Event phases and milestones will appear here when configured.</EmptyState>}
  </div>;
}

export function ReviewSchedule() {
  return <WorkspaceCard title="Upcoming reviews" label="CHECKPOINTS" badge={<Badge>Not published</Badge>}>
    <EmptyState title="Your review schedule will appear here">Review rounds and evaluator assignments are not connected yet. Admin draft rubrics are not a published schedule.</EmptyState>
  </WorkspaceCard>;
}
