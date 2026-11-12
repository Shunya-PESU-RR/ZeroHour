import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { AuthLayout, Button } from '../components/ui/SharedUI';
import { roleHome } from '../context/routePolicy';

export default function AdminLogin({ mentorAccess = false }) {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setError(''); setSubmitting(true);
    try {
      const verified = await signIn(email, password);
      setPassword('');
      navigate(roleHome(verified.role), { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { setSubmitting(false); }
  }
  return <AuthLayout title={mentorAccess ? 'Mentor login' : 'Admin login'}
    description={`Sign in with your authorized ${mentorAccess ? 'mentor' : 'organizer'} account.`} onSubmit={submit}
    footer={<>{!mentorAccess && <Link className="access-link" to="/mentor-access">Mentor sign-in</Link>}<Link className="access-link" to="/">← ZeroHour homepage</Link></>}>
    <label className="field">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label>
    <label className="field">Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label>
    {error && <p className="err" role="alert">{error}</p>}
    <Button type="submit" disabled={submitting}>{submitting ? 'Verifying access…' : 'Log in'}<span aria-hidden="true">↗</span></Button>
  </AuthLayout>;
}
