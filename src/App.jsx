import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout, PublicLayout } from './components/Layouts';
import EvaluationForm from './components/evaluation/EvaluationForm';
import Landing from './pages/Landing';
import Register from './pages/Register';
import MentorAccess from './pages/MentorAccess';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Setup from './pages/Setup';
import Splash from './components/Splash';
import './styles.css';

export default function App() {
  return (
    <BrowserRouter>
      <Splash />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/mentor-access" element={<MentorAccess />} />
          <Route path="/admin/login" element={<AdminLogin />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<EvaluationForm />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="setup" element={<Setup />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
