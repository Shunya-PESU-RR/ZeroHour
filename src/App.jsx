import { useLayoutEffect } from 'react';
import { AdminLayout, PublicLayout } from './components/Layouts';
import EvaluationForm from './components/evaluation/EvaluationForm';
import Landing from './pages/Landing';
import AboutShunya from './pages/AboutShunya';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Setup from './pages/Setup';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import './styles.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import TeamLogin from './pages/TeamLogin';
import TeamDashboard from './pages/TeamDashboard';
import { startRealtime } from './lib/api';
import SessionRoutes from './components/SessionRoutes';

function StaffWorkspace({ organizer }) {
  const { mentorId, role, user } = useAuth();
  useLayoutEffect(() => startRealtime(mentorId, role), [mentorId, role]);
  return <AdminLayout key={user.id} organizer={organizer} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SessionRoutes />}>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<AboutShunya />} />
          <Route element={<PublicLayout />}>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/mentor-access" element={<AdminLogin mentorAccess />} />
            <Route path="/team-login" element={<TeamLogin />} />
            <Route path="/team/dashboard" element={<TeamDashboard />} />
          </Route>

          <Route path="/admin" element={<StaffWorkspace organizer />}>
            <Route index element={<EvaluationForm />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="setup" element={<Setup />} />
          </Route>

          <Route path="/mentor" element={<StaffWorkspace />}>
            <Route index element={<Dashboard mentorWorkspace />} />
            <Route path="evaluate" element={<EvaluationForm />} />
            <Route path="leaderboard" element={<Leaderboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
