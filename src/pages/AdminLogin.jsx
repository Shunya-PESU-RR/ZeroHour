
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function AdminLogin() {
  const { user, isOrganizer, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <main className="page"><section className="panel">Loading...</section></main>;
  }

  if (user && isOrganizer) {
    return <Navigate to="/admin" replace />;
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await signIn(email.trim(), password);
      // AuthContext updates after sign-in; check the organizer role below.
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Admin login</h2>
        <p className="muted">Sign in with your authorized organizer account.</p>

        <label className="field">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="err" role="alert">{error}</p>}

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Log in'}
        </button>
      </form>
    </main>
  );
}
