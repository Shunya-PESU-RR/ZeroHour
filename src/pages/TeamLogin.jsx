import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout, Button } from '../components/ui/SharedUI';

export default function TeamLogin() {
  const { signInTeam } = useAuth();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      await signInTeam(teamName, accessCode);
      setAccessCode('');
      navigate('/team/dashboard', { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }
  return <AuthLayout title="Team Login" description="Use your registered team name and access code to enter your workspace."
    onSubmit={handleSubmit} footer={<Link className="access-link" to="/">← ZeroHour homepage</Link>}>
    <label className="field">Team name<input type="text" value={teamName} onChange={event => setTeamName(event.target.value)} placeholder="Enter your registered team name" autoComplete="username" required /></label>
    <label className="field">Team access code<input type="password" value={accessCode} onChange={event => setAccessCode(event.target.value)} placeholder="Enter your access code" autoComplete="current-password" required /></label>
    {error && <p className="err" role="alert">{error}</p>}
    <Button type="submit" disabled={loading}>{loading ? 'Verifying team ownership…' : 'Enter Team Workspace'}<span aria-hidden="true">↗</span></Button>
  </AuthLayout>;
}
