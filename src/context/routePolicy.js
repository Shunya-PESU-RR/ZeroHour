export const roleHome = role => role === 'team' ? '/team/dashboard' : role === 'admin' ? '/admin/dashboard' : role === 'mentor' ? '/mentor' : '/';
const adminPages = new Set(['/admin', '/admin/dashboard', '/admin/leaderboard', '/admin/setup']);
const mentorPages = new Set(['/mentor', '/mentor/evaluate', '/mentor/leaderboard']);
const publicPages = new Set(['/', '/about', '/admin/login', '/team-login', '/mentor-access']);

export function routeDecision(session, pathname) {
  if (['loading', 'logging_out'].includes(session.status)) return { kind: 'loading' };
  if (session.status !== 'ready') return { kind: 'error' };
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (session.role) {
    const allowed = session.role === 'team' ? path === '/team/dashboard'
      : session.role === 'admin' ? adminPages.has(path) : session.role === 'mentor' && mentorPages.has(path);
    return allowed ? { kind: 'allow' } : { kind: 'redirect', to: roleHome(session.role) };
  }
  if (path === '/admin' || path.startsWith('/admin/')) return publicPages.has(path) ? { kind: 'allow' } : { kind: 'redirect', to: '/admin/login' };
  if (path === '/team/dashboard' || path.startsWith('/team/')) return { kind: 'redirect', to: '/team-login' };
  if (path === '/mentor' || path.startsWith('/mentor/')) return { kind: 'redirect', to: '/mentor-access' };
  return publicPages.has(path) ? { kind: 'allow' } : { kind: 'redirect', to: '/' };
}
