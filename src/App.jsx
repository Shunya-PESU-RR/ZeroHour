import { useState } from 'react';
import EvaluationForm from './components/evaluation/EvaluationForm';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import { useData, selectMentors } from './lib/api';
import './styles.css';

export default function App() {
  const mentors = useData(selectMentors);
  const [view, setView] = useState('evaluate');
  const [mentorId, setMentorId] = useState('m1'); // Replace with real login (Srujan)

  return (
    <div className="app">
      <header>
        <h1>ZeroHour Ops</h1>
        <nav>
          <button className={view === 'evaluate' ? 'active' : ''} onClick={() => setView('evaluate')}>Evaluate</button>
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
          <button className={view === 'leaderboard' ? 'active' : ''} onClick={() => setView('leaderboard')}>Leaderboard</button>
        </nav>
        {view === 'evaluate' && (
          <select value={mentorId} onChange={(e) => setMentorId(e.target.value)} aria-label="Signed-in mentor">
            {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </header>
      <main>
        {view === 'evaluate' && <EvaluationForm mentorId={mentorId} />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'leaderboard' && <Leaderboard />}
      </main>
    </div>
  );
}
