
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import logo from '../assets/shunya-logo.svg';

export function PublicLayout() {
  return (
    <>
      <header className="site-nav">
        <Link to="/" className="brand">
          <img src={logo} alt="Shunya" className="brand-logo" />
          ZERO<span>HOUR</span>
        </Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
           <a href="https://youtube.com" target="_blank" rel="noreferrer"> Register </a>
          <NavLink to="/admin/login">Admin</NavLink>
          <NavLink to="/team-login">Team Login</NavLink>
        </nav>
      </header>
      <Outlet />
      <footer className="footer">
        ZeroHour • Powered by SHUNYA • PES UNIVERSITY
      </footer>
    </>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <>
      <header className="site-nav">
        <Link to="/" className="brand">
          <img src={logo} alt="Shunya" className="brand-logo" />
          ZERO<span>HOUR</span> <small>admin</small>
        </Link>
        <nav>
          <NavLink to="/admin" end>Evaluate</NavLink>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/leaderboard">Leaderboard</NavLink>
          <NavLink to="/admin/setup">Setup</NavLink>
          <button className="link" onClick={handleLogout}>Log out</button>
        </nav>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}
