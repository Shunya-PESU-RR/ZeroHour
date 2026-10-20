
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { teamSupabase } from '../lib/supabase';

export default function TeamLogin() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      // Create an isolated anonymous session for team access.
      const { error: authError } =
        await teamSupabase.auth.signInAnonymously();

      if (authError) throw authError;

      const { data, error: loginError } = await teamSupabase.rpc(
        'login_team',
        {
          p_team_name: teamName.trim(),
          p_access_code: accessCode,
        }
      );

      if (loginError) throw loginError;

      if (!data || data.length === 0) {
        await teamSupabase.auth.signOut();
        setError('Invalid team name or access code.');
        return;
      }

      setAccessCode('');
      navigate('/team/dashboard', { replace: true });
    } catch (err) {
        console.error('Team login failed:', err);
        setError(err.message || 'Unknown login error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <section
        className="panel"
        style={{ maxWidth: 460, margin: '60px auto' }}
      >
        <p className="eyebrow">SHUNYA · ZEROHOUR</p>
        <h1>Team Login</h1>
        <p>Access your team workspace and track your progress.</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="teamName">Team name</label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Enter your registered team name"
            autoComplete="username"
            required
          />

          <label htmlFor="accessCode">Team access code</label>
          <input
            id="accessCode"
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter your access code"
            autoComplete="current-password"
            required
          />

          {error && <p role="alert">{error}</p>}

          <button
            className="btn primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 16 }}
          >
            {loading ? 'Verifying...' : 'Enter Team Workspace'}
          </button>
        </form>

        <p style={{ marginTop: 20 }}>
        </p>
        <Link to="/">← Back to home</Link>
      </section>
    </main>
  );
}
