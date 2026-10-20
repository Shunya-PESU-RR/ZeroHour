
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamSupabase } from '../lib/supabase';

export default function TeamDashboard() {
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadTeam() {
      const { data, error: sessionError } =
        await teamSupabase.rpc('get_my_team');

      if (!active) return;

      if (sessionError) {
        setError('Could not load your team. Please try again.');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        await teamSupabase.auth.signOut();
        if (active) navigate('/team-login', { replace: true });
        return;
      }

      setTeam(data[0]);
      setLoading(false);
    }

    loadTeam();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogout() {
    await teamSupabase.auth.signOut();
    navigate('/team-login', { replace: true });
  }

  if (loading) {
    return <main className="page"><section className="panel">Loading team workspace...</section></main>;
  }

  if (error) {
    return (
      <main className="page">
        <section className="panel">
          <p role="alert">{error}</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!team) return null;

  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">ZEROHOUR · TEAM WORKSPACE</p>
        <h1>Welcome, {team.team_name}!</h1>
        <p>You're signed in to your team workspace.</p>
        <p><strong>Table number:</strong> {team.table_number}</p>
        <button className="btn" onClick={handleLogout}>
          Log out
        </button>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Event clock</h2>
        <p>Event timing hasn't been configured yet.</p>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Round progress</h2>
        <p>Round details will appear here once the event schedule is configured.</p>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Mentor assistance</h2>
        <p>Mentor requests will be available here in the next step.</p>
      </section>
    </main>
  );
}
