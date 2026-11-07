import LiveEventClock from '../components/operations/LiveEventClock';
import LiveRequests from '../components/operations/LiveRequests';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData, selectRequests, selectTeams, selectMentors, selectEvaluations, selectLoading, selectError, refreshOperations } from '../lib/api';
import { useAuth } from '../context/useAuth';
import { Badge, EmptyState, EventTimeline, Field, PendingNotice, ReviewSchedule, StatCard, WorkspaceCard, WorkspaceHeader } from '../components/operations/WorkspaceUI';
import { EventConfiguration, TrackConfiguration } from '../components/operations/ConfigurationPanels';
import RoundEditor from '../components/operations/RoundEditor';

function Roster({ teams, mentors, requests, kind }) {
  const [search, setSearch] = useState('');
  const records = (kind === 'teams' ? teams : mentors).filter(record => `${record.name} ${record.table ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <WorkspaceCard title={kind === 'teams' ? 'Team management' : 'Mentor management'} badge={<Badge>Live records · read only</Badge>}>
    <div className="ops-toolbar"><Field label={`Search ${kind}`}><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or table…" /></Field><button type="button" disabled>{kind === 'teams' ? 'Import CSV unavailable' : 'Add mentor unavailable'}</button></div>
    <p className="ops-help">Track assignments, PPT references, and editing await verified backend contracts. Credentials are never shown.</p>
    {records.length ? <div className="scroll"><table><thead><tr><th>Name</th><th>{kind === 'teams' ? 'Table' : 'Role'}</th><th>Requests</th><th>Track</th><th>Manage</th></tr></thead>
      <tbody>{records.map(record => <tr key={record.id}><td><strong>{record.name}</strong></td><td>{kind === 'teams' ? record.table : record.role}</td><td>{requests.filter(request => kind === 'teams' ? request.table === record.table : request.claimedBy === record.id).length}</td><td><span className="ops-muted">Not connected</span></td><td><button type="button" disabled>Edit unavailable</button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching records">No records to display from the current Supabase result.</EmptyState>}
  </WorkspaceCard>;
}

function EvaluationMonitoring({ evaluations, teams, mentors, admin }) {
  return <div className="ops-stack"><WorkspaceCard title={admin ? 'Evaluation monitoring' : 'Your evaluation history'} badge={<Badge>Legacy scoring · read only</Badge>}>
    <p className="ops-help">These are existing Supabase evaluations using the current four-metric rubric. They are not scores for the draft review rounds.</p>
    {evaluations.length ? <div className="scroll"><table><thead><tr><th>Team</th>{admin && <th>Evaluator</th>}<th>Status</th><th>Last updated</th></tr></thead><tbody>{evaluations.map(evaluation => <tr key={evaluation.id}><td>{teams.find(team => team.id === evaluation.teamId)?.name || 'Team details unavailable'}</td>{admin && <td>{mentors.find(mentor => mentor.id === evaluation.mentorId)?.name || 'Staff identity'}</td>}<td><Badge tone={evaluation.status === 'submitted' ? 'mint' : 'violet'}>{evaluation.status}</Badge></td><td>{evaluation.updatedAt ? new Date(evaluation.updatedAt).toLocaleString() : '—'}</td></tr>)}</tbody></table></div> : <EmptyState title="No evaluations in this result">Existing drafts and submitted evaluations will appear here when available.</EmptyState>}
    <Link className="btn" to={admin ? '/admin' : '/mentor/evaluate'}>Open existing grading form ↗</Link>
  </WorkspaceCard>{!admin && <WorkspaceCard title="Assigned review rounds"><EmptyState title="Round assignments not connected">An assistance assignment is not an evaluation assignment. No new grading permissions are inferred from your request queue.</EmptyState></WorkspaceCard>}</div>;
}

export function StaffWorkspaceView({ admin = false, canConfigure = false, requests = [], teams = [], mentors = [], evaluations = [], loading = false, error = null, onRefresh, refreshing = false }) {
  const [section, setSection] = useState('Overview');
  const sections = admin ? ['Overview','Requests','Teams','Mentors','Tracks & problems','Event & timeline','Review rounds','Evaluations','Leaderboard'] : ['Overview','Assigned requests','Team overview','Evaluations'];
  const ready = !loading && !error;
  return <div className="ops-workspace">
    <WorkspaceHeader eyebrow={admin ? 'ORGANIZER CONTROL · ZEROHOUR' : 'MENTOR WORKSPACE · ZEROHOUR'} title={admin ? 'Event operations' : 'Mentor workspace'}
      description={admin ? 'One place to coordinate teams, mentor support, and event reviews.' : 'Focus on your assigned teams. Read the context, understand the blocker, and guide the next step.'}
      actions={<><Badge tone="violet">Event operations</Badge>{onRefresh && <button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh data'}</button>}</>} />
    {error && <p role="alert" className="err">Could not refresh operations data: {error}. Existing records may be stale.</p>}
    {loading && <p role="status">Loading authorized Supabase records…</p>}
    <div className="ops-shell"><nav className="ops-sidebar" aria-label={admin ? 'Admin operations sections' : 'Mentor workspace sections'}>{sections.map(name => <button key={name} type="button" aria-pressed={section === name} className={section === name ? 'selected' : ''} onClick={() => setSection(name)}>{name}<span aria-hidden="true">↗</span></button>)}<div className="ops-sidebar-note"><span className="ops-status-dot" />Backend integration in progress<br />Drafts are never live data.</div></nav>
      <div className="ops-content">
        <div hidden={section !== 'Overview'} className="ops-stack">
          <div className="ops-stats">{admin && <StatCard label="Teams" value={ready ? teams.length : null} detail="Live roster" />}<StatCard label={admin ? 'Mentors' : 'Assigned requests'} value={ready ? (admin ? mentors.filter(mentor => mentor.role === 'mentor').length : requests.length) : null} detail={admin ? 'Live staff records' : 'Your identity only'} />
            <StatCard label={admin ? 'Open requests' : 'In progress'} value={ready ? requests.filter(request => request.status === (admin ? 'open' : 'claimed')).length : null} detail="Current request records" /><StatCard label="Resolved" value={ready ? requests.filter(request => request.status === 'resolved').length : null} detail="Retained request history" /></div>
          <div className="ops-grid ops-split"><LiveEventClock /><WorkspaceCard title={admin ? 'Operations readiness' : 'Assigned tracks'} label="AT A GLANCE">
            {admin ? <><PendingNotice>Request and clock controls use the live operations service. Review rounds remain drafts.</PendingNotice><ul className="ops-readiness"><li><span>Roster & legacy request records</span><Badge tone={ready ? 'mint' : 'muted'}>{ready ? 'Loaded' : 'Loading / unavailable'}</Badge></li><li><span>Clock & event phases</span><Badge>Official clock</Badge></li><li><span>Review publication</span><Badge>Draft only</Badge></li></ul></> : <EmptyState title="Track assignments unavailable">Your mentor-track relationships will appear after the approved backend integration. Team details below are limited to your assigned work.</EmptyState>}
          </WorkspaceCard></div>
          <WorkspaceCard title="Event timeline" badge={<Badge>Not published</Badge>}><EventTimeline /></WorkspaceCard>
          {!admin && <ReviewSchedule />}
        </div>
        <div hidden={section !== (admin ? 'Requests' : 'Assigned requests')}><LiveRequests mentors={mentors} admin={admin} enabled={section === (admin ? "Requests" : "Assigned requests")} /></div>
        {admin ? <>
          <div hidden={section !== 'Teams'}><Roster kind="teams" teams={teams} mentors={mentors} requests={requests} /></div>
          <div hidden={section !== 'Mentors'}><Roster kind="mentors" teams={teams} mentors={mentors} requests={requests} /></div>
          <fieldset className="ops-config-fieldset" disabled={!canConfigure} hidden={section !== 'Tracks & problems'}><legend className="ops-sr-only">Admin local track configuration drafts</legend><TrackConfiguration /></fieldset>
          <fieldset className="ops-config-fieldset" disabled={!canConfigure} hidden={section !== 'Event & timeline'}><legend className="ops-sr-only">Admin local event configuration drafts</legend><EventConfiguration /></fieldset>
          <fieldset className="ops-config-fieldset" disabled={!canConfigure} hidden={section !== 'Review rounds'}><legend className="ops-sr-only">Admin local review round drafts</legend><WorkspaceCard title="Review rounds & rubrics" badge={<Badge tone="violet">Unpublished drafts</Badge>}><RoundEditor /></WorkspaceCard></fieldset>
          <div hidden={section !== 'Leaderboard'}><WorkspaceCard title="Leaderboard" badge={<Badge>Legacy submitted scores</Badge>}><p>The existing leaderboard uses only submitted evaluations. Draft review rounds do not change its calculation.</p><Link className="btn primary" to="/admin/leaderboard">Open existing leaderboard ↗</Link><p className="ops-help">Track filtering, per-round scores, and ranking publication controls await backend support.</p></WorkspaceCard></div>
        </> : <div hidden={section !== 'Team overview'}><WorkspaceCard title="Authorized team overview" badge={<Badge>Assigned work only</Badge>}>
          {teams.length ? <div className="ops-team-list">{teams.map(team => <article key={team.id}><span className="ops-overline">TABLE {team.table}</span><h3>{team.name}</h3><p>Track and problem information not connected.</p><button type="button" disabled>PPT unavailable</button></article>)}</div> : <EmptyState title="No authorized team details loaded">Only teams attached to your current assigned requests are requested by this workspace.</EmptyState>}
        </WorkspaceCard></div>}
        <div hidden={section !== 'Evaluations'}><EvaluationMonitoring evaluations={evaluations} teams={teams} mentors={mentors} admin={admin} /></div>
      </div>
    </div>
  </div>;
}

export default function Dashboard({ mentorWorkspace = false }) {
  const { mentorId, isOrganizer } = useAuth();
  const requests = useData(selectRequests);
  const teams = useData(selectTeams);
  const mentors = useData(selectMentors);
  const evaluations = useData(selectEvaluations);
  const loading = useData(selectLoading);
  const error = useData(selectError);
  const [refreshing, setRefreshing] = useState(false);
  if (!mentorWorkspace && !isOrganizer) return <p role="alert">Organizer access is required.</p>;
  const visibleRequests = mentorWorkspace ? requests.filter(request => request.claimedBy === mentorId) : requests;
  const assignedTables = new Set(visibleRequests.filter(request => ['claimed', 'in_progress'].includes(request.status)).map(request => request.table));
  return <StaffWorkspaceView admin={!mentorWorkspace} canConfigure={!mentorWorkspace && isOrganizer} requests={visibleRequests}
    teams={mentorWorkspace ? teams.filter(team => assignedTables.has(team.table)) : teams}
    mentors={mentorWorkspace ? mentors.filter(mentor => mentor.id === mentorId) : mentors}
    evaluations={mentorWorkspace ? evaluations.filter(evaluation => evaluation.mentorId === mentorId) : evaluations} loading={loading} error={error}
    refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refreshOperations(); } finally { setRefreshing(false); } }} />;
}
