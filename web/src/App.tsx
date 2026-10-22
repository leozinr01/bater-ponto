import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './lib/auth';
import { AccountPage } from './pages/AccountPage';
import { ClockPage } from './pages/ClockPage';
import { HistoryPage } from './pages/HistoryPage';
import { LoginPage } from './pages/LoginPage';
import { TimesheetPage } from './pages/TimesheetPage';
import { EmployeesPage } from './pages/admin/EmployeesPage';
import { ReportPage } from './pages/admin/ReportPage';
import { SchedulesPage } from './pages/admin/SchedulesPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<ClockPage />} />
        <Route path="espelho" element={<TimesheetPage />} />
        <Route path="historico" element={<HistoryPage />} />
        <Route path="conta" element={<AccountPage />} />
        <Route
          path="admin/*"
          element={
            <RequireAdmin>
              <Routes>
                <Route path="relatorio" element={<ReportPage />} />
                <Route path="funcionarios" element={<EmployeesPage />} />
                <Route path="jornadas" element={<SchedulesPage />} />
                <Route path="*" element={<Navigate to="relatorio" replace />} />
              </Routes>
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
