import { useState } from 'react';
import { requestMentorAccess } from '../lib/api';

export default function MentorAccess() {
  const [form, setForm] = useState({ teamName: '', email: '', note: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function submit(e) {
    e.preventDefault();
    if (!form.teamName.trim() || !form.email.trim()) { setError('Team name and email are required.'); return; }
    requestMentorAccess({ teamName: form.teamName.trim(), email: form.email.trim(), note: form.note.trim() });
    setError(''); setDone(true);
  }

  if (done) {
    return (
      <main className="page"><section className="panel">
        <h2>Request sent</h2>
        <p>The organizers will review it and get back to {form.email}.</p>
      </section></main>
    );
  }

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Request mentor access</h2>
        <p className="muted">For shortlisted teams. Use the team name you registered with.</p>
        <label className="field">Team name<input value={form.teamName} onChange={set('teamName')} /></label>
        <label className="field">Contact email<input type="email" value={form.email} onChange={set('email')} /></label>
        <label className="field">Note (optional)<textarea rows="3" value={form.note} onChange={set('note')} /></label>
        {error && <p className="err">{error}</p>}
        <button className="primary" type="submit">Send request</button>
      </form>
    </main>
  );
}
