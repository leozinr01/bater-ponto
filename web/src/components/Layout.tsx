import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { cn } from './ui';

const employeeLinks = [
  { to: '/', label: 'Bater ponto', end: true },
  { to: '/espelho', label: 'Espelho' },
  { to: '/historico', label: 'Histórico' },
];

const adminLinks = [
  { to: '/admin/relatorio', label: 'Relatório' },
  { to: '/admin/funcionarios', label: 'Funcionários' },
  { to: '/admin/jornadas', label: 'Jornadas' },
];

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold text-slate-900">
      <svg viewBox="0 0 24 24" className="size-6 text-indigo-600" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      Ponto
    </span>
  );
}

export function Layout() {
  const { user, isAdmin, logout } = useAuth();

  const nav = (
    <>
      {employeeLinks.map((l) => (
        <NavItem key={l.to} {...l} />
      ))}
      {isAdmin && (
        <>
          <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />
          {adminLinks.map((l) => (
            <NavItem key={l.to} {...l} />
          ))}
        </>
      )}
    </>
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">{nav}</nav>
          <div className="ml-auto flex items-center gap-1">
            <NavLink
              to="/conta"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100',
                  isActive && 'bg-slate-100',
                )
              }
              title="Minha conta"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {user?.name
                  .split(' ')
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()}
              </span>
              <span className="hidden max-w-40 truncate text-slate-700 sm:inline">{user?.name}</span>
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {nav}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
