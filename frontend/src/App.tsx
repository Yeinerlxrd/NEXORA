import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { DailyPage } from './pages/DailyPage';
import { FriendsPage } from './pages/FriendsPage';
import { GamingPage } from './pages/GamingPage';
import { GroupsPage } from './pages/GroupsPage';
import { LoginPage } from './pages/LoginPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PendingModulePage } from './pages/PendingModulePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TasksPage } from './pages/TasksPage';
import { getCurrentUser } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const [, setSessionRevision] = useState(0);

  useEffect(() => {
    const handleSessionExpired = () => setSessionRevision(revision => revision + 1);
    window.addEventListener('nexora:session-expired', handleSessionExpired);
    return () => window.removeEventListener('nexora:session-expired', handleSessionExpired);
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="workspace" element={<Navigate to="/projects" replace />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="daily" element={<DailyPage />} />
        <Route path="social" element={<FriendsPage />} />
        <Route path="gaming" element={<GamingPage />} />
        <Route path="discord" element={<PendingModulePage module="Discord" />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
