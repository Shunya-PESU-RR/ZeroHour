import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { routeDecision } from '../context/routePolicy';
import { AccessBrand, Button, LogoutButton, PageShell } from './ui/SharedUI';

export default function SessionRoutes() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const decision = routeDecision({ status: auth.status, role: auth.accessRole }, pathname);
  if (decision.kind === 'loading') return <PageShell className="zh-session-state"><section className="panel"><AccessBrand /><p role="status">{auth.status === 'logging_out' ? 'Signing out safely…' : 'Restoring and verifying your session…'}</p></section></PageShell>;
  if (decision.kind === 'error') return <PageShell className="zh-session-state"><section className="panel"><AccessBrand /><h1>Session access unavailable</h1><p role="alert">{auth.error}</p><div className="row">
    {auth.status !== 'logout_error' && <Button onClick={() => { void auth.refreshSession(); }}>Retry verification</Button>}
    <LogoutButton />
  </div></section></PageShell>;
  if (decision.kind === 'redirect') return <Navigate to={decision.to} replace />;
  return <>{auth.notice && <p role="status" className="zh-session-notice">{auth.notice}</p>}<Outlet /></>;
}
