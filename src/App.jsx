import { AdminLayout, PublicLayout } from './components/Layouts';
import EvaluationForm from './components/evaluation/EvaluationForm';
import Landing from './pages/Landing';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Setup from './pages/Setup';
import Splash from './components/Splash';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import './styles.css';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import TeamLogin from './pages/TeamLogin';
import TeamDashboard from './pages/TeamDashboard';

function AdminGuard() {
  const { user, isOrganizer, loading } = useAuth();

  if (loading) {
    return <main className="page"><section className="panel">Checking access...</section></main>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isOrganizer) {
    return <Navigate to="/mentor-access" replace />;
  }

    return <AdminLayout><Outlet /></AdminLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Splash />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/team-login" element={<TeamLogin />} />
            <Route path="/team/dashboard" element={<TeamDashboard />} />
          </Route>

          <Route path="/admin" element={<AdminGuard />}>
            <Route index element={<EvaluationForm />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="setup" element={<Setup />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
