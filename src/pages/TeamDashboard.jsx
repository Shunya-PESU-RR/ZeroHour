import LiveEventClock from '../components/operations/LiveEventClock';
import LiveRequests from '../components/operations/LiveRequests';
import { useOperationsRead } from '../lib/liveOperations';
import { useAuth } from "../context/useAuth";
import { PageShell, LogoutButton } from "../components/ui/SharedUI";

import { Badge, EmptyState, EventTimeline, PendingNotice, ReviewSchedule, WorkspaceCard, WorkspaceHeader } from '../components/operations/WorkspaceUI';

export function TeamWorkspaceView({ team, logoutAction }) {
  // Accepts the approved overview projection when that read integration is later
  // verified. Current get_my_team returns identity only; no extra query is made.
  const overviewLoaded = Object.hasOwn(team || {}, 'track_id');
  const trackLabel = team?.track_name || (overviewLoaded ? 'To be announced' : 'Awaiting integration');
  const resourceUrl = typeof team?.problem_resource_url === 'string' && /^https:\/\//i.test(team.problem_resource_url) ? team.problem_resource_url : null;
  return <div className="ops-workspace">
    <WorkspaceHeader eyebrow="PARTICIPANT WORKSPACE · ZEROHOUR" title={team?.team_name || 'Team workspace'}
      description="Your team, your next milestone, and a direct path to mentor support."
      actions={<>{team && <Badge tone="mint">Team identity connected</Badge>}{logoutAction}</>} />
    <div className="ops-team-banner"><div><span>TEAM ID</span><strong className="numeric">{team?.team_id || 'Sign in to load your team'}</strong></div>
      <div><span>TABLE</span><strong className="numeric">{team?.table_number ?? '—'}</strong></div><div><span>TRACK</span><strong>{trackLabel}</strong></div><div><span>PHASE</span><strong>Not published</strong></div></div>
    <PendingNotice>{team ? 'Team identity is connected through the existing login.' : 'Sign in to load your team identity; no team data is present in this view.'} Review rounds and conversation messaging are separate from mentor request status.</PendingNotice>
    <div className="ops-grid ops-team-top">
      <WorkspaceCard title="Your problem statement" label="THE CHALLENGE" badge={<Badge>{overviewLoaded ? 'Team overview' : 'Not connected'}</Badge>}>
        <div className="ops-problem"><p className="ops-overline">SELECTED TRACK</p><h3>{trackLabel}</h3><p>{team?.track_description || (overviewLoaded ? 'Your selected track details will appear here once assigned.' : 'Track name and description will be loaded after the team overview integration is enabled.')}</p>
          <hr />{team?.problem_statement ? <><h3>{team.problem_title}</h3><p className="ops-full-text">{team.problem_statement}</p>{team.problem_instructions && <><h3>Instructions</h3><p className="ops-full-text">{team.problem_instructions}</p></>}{resourceUrl && <a className="btn" href={resourceUrl} target="_blank" rel="noopener noreferrer">Open problem resources ↗</a>}</> : <EmptyState title={overviewLoaded ? 'To be announced' : 'Your challenge will appear here'}>{overviewLoaded ? 'No problem statement has been assigned yet.' : 'The full problem statement, instructions, and resources will be shown from your authorized team record. No problem has been loaded.'}</EmptyState>}</div>
      </WorkspaceCard>
      <LiveEventClock />
    </div>
    <div className="ops-grid ops-split"><WorkspaceCard title="Event timeline" label="YOUR NEXT MOVE" badge={<Badge>Not published</Badge>}><EventTimeline /></WorkspaceCard><ReviewSchedule /></div>
    <LiveRequests team={team} />
  </div>;
}

export default function TeamDashboard() {
  const { team } = useAuth();
  const overview = useOperationsRead("get_my_team_overview");
  const details = overview?.data?.find(row => row.team_id === team.team_id);
  return <PageShell className="ops-page"><TeamWorkspaceView key={team.team_id} team={{ ...team, ...details }} logoutAction={<LogoutButton />} /></PageShell>;
}
