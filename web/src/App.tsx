import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout, Logo } from './components/Layout';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { AccountPage } from './pages/AccountPage';
import { ClockPage } from './pages/ClockPage';
import { HourBankPage } from './pages/HourBankPage';
import { LoginPage } from './pages/LoginPage';
import { RecordsPage } from './pages/RecordsPage';
import { EmployeesPage } from './pages/admin/EmployeesPage';
import { HolidaysPage } from './pages/admin/HolidaysPage';
import { ReportPage } from './pages/admin/ReportPage';
import { SchedulesPage } from './pages/admin/SchedulesPage';
import { TodayPage } from './pages/admin/TodayPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-ink-950">
        <Logo size="lg" />
        <Spinner className="size-5 text-brand-400" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

/** Endereços antigos (espelho, histórico) levam para Registros, mantendo os filtros. */
function RedirectToRecords({ tab }: { tab?: string }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (tab) params.set('aba', tab);
  const qs = params.toString();
  return <Navigate to={`/registros${qs ? `?${qs}` : ''}`} replace />;
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
        <Route path="registros" element={<RecordsPage />} />
        <Route path="banco-de-horas" element={<HourBankPage />} />
        <Route path="espelho" element={<RedirectToRecords />} />
        <Route path="historico" element={<RedirectToRecords tab="marcacoes" />} />
        <Route path="conta" element={<AccountPage />} />
        <Route
          path="admin/*"
          element={
            <RequireAdmin>
              <Routes>
                <Route path="hoje" element={<TodayPage />} />
                <Route path="relatorio" element={<ReportPage />} />
                <Route path="funcionarios" element={<EmployeesPage />} />
                <Route path="jornadas" element={<SchedulesPage />} />
                <Route path="feriados" element={<HolidaysPage />} />
                <Route path="*" element={<Navigate to="hoje" replace />} />
              </Routes>
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
