import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { adminLogin, isAdmin } from '../lib/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  if (isAdmin()) return <Navigate to="/admin" replace />;

  function submit(e) {
    e.preventDefault();
    if (adminLogin(user.trim(), pass)) navigate('/admin');
    else setError('Wrong username or password.');
  }

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Admin login</h2>
        <label className="field">Username<input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" /></label>
        <label className="field">Password<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /></label>
        {error && <p className="err">{error}</p>}
        <button className="primary" type="submit">Log in</button>
      </form>
    </main>
  );
}
