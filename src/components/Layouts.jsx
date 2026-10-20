import { Link, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { adminLogout, isAdmin } from '../lib/api';
import logo from '../assets/shunya-logo.svg';

export function PublicLayout() {
  return (
    <>
      <header className="site-nav">
        <Link to="/" className="brand"><img src={logo} alt="Shunya" className="brand-logo" />ZERO<span>HOUR</span></Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/register">Register</NavLink>
          <NavLink to="/mentor-access">Mentor access</NavLink>
          <NavLink to="/admin/login">Admin</NavLink>
        </nav>
      </header>
      <Outlet />
      <footer className="footer">ZeroHour - a SHUNYA event. Mathematics &bull; Logic &bull; Exploration</footer>
    </>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  if (!isAdmin()) return <Navigate to="/admin/login" replace />;
  return (
    <>
      <header className="site-nav">
        <Link to="/" className="brand"><img src={logo} alt="Shunya" className="brand-logo" />ZERO<span>HOUR</span> <small>admin</small></Link>
        <nav>
          <NavLink to="/admin" end>Evaluate</NavLink>
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/leaderboard">Leaderboard</NavLink>
          <NavLink to="/admin/setup">Setup</NavLink>
          <button className="link" onClick={() => { adminLogout(); navigate('/'); }}>Log out</button>
        </nav>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}
