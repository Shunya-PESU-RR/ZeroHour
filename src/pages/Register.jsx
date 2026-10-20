import { useState } from 'react';
import { registerTeam } from '../lib/api';

export default function Register() {
  const [form, setForm] = useState({ teamName: '', college: '', email: '', m1: '', m2: '', m3: '', m4: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function submit(e) {
    e.preventDefault();
    const members = [form.m1, form.m2, form.m3, form.m4].map((m) => m.trim()).filter(Boolean);
    if (!form.teamName.trim() || !form.email.trim() || members.length === 0) {
      setError('Team name, contact email and at least one member are required.');
      return;
    }
    const res = registerTeam({ teamName: form.teamName.trim(), college: form.college.trim(), email: form.email.trim(), members });
    if (!res.ok) { setError(res.error); return; }
    setError(''); setDone(true);
  }

  if (done) {
    return (
      <main className="page"><section className="panel">
        <h2>You're registered</h2>
        <p>Thanks, {form.teamName}. The organizers will contact {form.email} if your team is shortlisted.</p>
      </section></main>
    );
  }

  return (
    <main className="page">
      <form className="panel" onSubmit={submit}>
        <h2>Register your team</h2>
        <label className="field">Team name<input value={form.teamName} onChange={set('teamName')} /></label>
        <label className="field">College / organization<input value={form.college} onChange={set('college')} /></label>
        <label className="field">Contact email<input type="email" value={form.email} onChange={set('email')} /></label>
        <label className="field">Member 1 (required)<input value={form.m1} onChange={set('m1')} /></label>
        <label className="field">Member 2<input value={form.m2} onChange={set('m2')} /></label>
        <label className="field">Member 3<input value={form.m3} onChange={set('m3')} /></label>
        <label className="field">Member 4<input value={form.m4} onChange={set('m4')} /></label>
        {error && <p className="err">{error}</p>}
        <button className="primary" type="submit">Register</button>
      </form>
    </main>
  );
}
