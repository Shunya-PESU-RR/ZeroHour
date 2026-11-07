
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import logo from '../assets/shunya-logo.svg';
import { LogoutButton, PageShell } from './ui/SharedUI';

export const PUBLIC_REGISTRATION_URL = 'https://unstop.com/p/zerohour-shunya-club-1797247';

export { AccessBrand } from './ui/SharedUI';

export function PublicLayout() {
  const { accessRole } = useAuth();
  return (
    <>
      <header className="site-nav">
        <Link to="/" className="brand">
          <img src={logo} alt="Shunya" className="brand-logo" />
          ZERO<span>HOUR</span>
        </Link>
        <nav aria-label="Main navigation">
          {accessRole === 'team' ? <><NavLink to="/team/dashboard">Team Dashboard</NavLink><LogoutButton /></> : <>
          <NavLink to="/" end>Home</NavLink>
          <a href={PUBLIC_REGISTRATION_URL} target="_blank" rel="noreferrer">Register</a>
          <NavLink to="/admin/login">Admin</NavLink>
          <NavLink to="/mentor-access">Mentor</NavLink>
          <NavLink to="/team-login">Team Login</NavLink>
          </>}
        </nav>
      </header>
      <Outlet />
      <footer className="footer">
        ZeroHour • Powered by SHUNYA • PES UNIVERSITY
      </footer>
    </>
  );
}

export function AdminLayout({ organizer }) {
  return (
    <>
      <header className="site-nav workspace-nav">
        <Link to="/" className="brand">
          <img src={logo} alt="Shunya" className="brand-logo" />
          ZERO<span>HOUR</span> <small>{organizer ? 'admin' : 'mentor'}</small>
        </Link>
        <nav aria-label={organizer ? 'Organizer workspace' : 'Mentor workspace'}>
          <NavLink to={organizer ? '/admin' : '/mentor/evaluate'} end>Evaluate</NavLink>
          <NavLink to={organizer ? '/admin/dashboard' : '/mentor'} end>Dashboard</NavLink>
          <NavLink to={organizer ? '/admin/leaderboard' : '/mentor/leaderboard'}>Leaderboard</NavLink>
          {organizer && <NavLink to="/admin/setup">Setup</NavLink>}
          <LogoutButton />
        </nav>
      </header>
      <PageShell className={organizer ? 'ops-page admin-workspace' : 'ops-page'}>
        <Outlet />
      </PageShell>
    </>
  );
}
