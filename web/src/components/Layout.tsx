import {
  CalendarClock,
  ChartColumn,
  ClipboardList,
  Fingerprint,
  LayoutGrid,
  LogOut,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { InstallApp } from './PwaPrompts';
import { Avatar, cn } from './ui';

export const APP_NAME = 'Sistema de Ponto';
export const COMPANY = 'TAI Project';

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const employeeLinks: NavEntry[] = [
  { to: '/', label: 'Bater ponto', icon: Fingerprint, end: true },
  { to: '/registros', label: 'Registros', icon: ClipboardList },
];

const adminLinks: NavEntry[] = [
  { to: '/admin/relatorio', label: 'Relatório', icon: ChartColumn },
  { to: '/admin/funcionarios', label: 'Funcionários', icon: Users },
  { to: '/admin/jornadas', label: 'Jornadas', icon: CalendarClock },
];

/** Marca: monograma TAI + nome do sistema. */
export function Logo({ light = true, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 font-black tracking-tighter text-white shadow-lg shadow-brand-700/30',
          size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm',
        )}
      >
        TAI
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cn('font-semibold', size === 'lg' ? 'text-lg' : 'text-sm', light ? 'text-white' : 'text-slate-900')}>
          {APP_NAME}
        </span>
        <span className={cn('text-xs font-medium', light ? 'text-brand-300' : 'text-brand-600')}>{COMPANY}</span>
      </span>
    </span>
  );
}

function NavItem({ to, label, icon: IconCmp, end }: NavEntry) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <IconCmp
            className={cn('size-[18px]', isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300')}
          />
          {label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="flex h-full flex-col border-r border-white/[0.06] bg-ink-950 bg-[radial-gradient(ellipse_at_top_left,rgba(59,109,255,0.18),transparent_55%)]">
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-8">
        <Logo />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Meu ponto</p>
          {employeeLinks.map((l) => (
            <NavItem key={l.to} {...l} />
          ))}
        </div>
        {isAdmin && (
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Administração</p>
            {adminLinks.map((l) => (
              <NavItem key={l.to} {...l} />
            ))}
          </div>
        )}
      </nav>

      <div className="px-3 pb-2">
        <InstallApp variant="button" />
      </div>

      <div className="border-t border-white/10 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center gap-1">
          <NavLink
            to="/conta"
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5',
                isActive && 'bg-white/10',
              )
            }
            title="Minha conta"
          >
            <Avatar name={user?.name ?? ''} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{user?.name}</span>
              <span className="block text-xs text-slate-400">{isAdmin ? 'Administrador' : 'Funcionário'}</span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={logout}
            title="Sair"
            aria-label="Sair"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Aba da barra inferior do celular. */
function TabItem({ to, label, icon: IconCmp, end }: NavEntry) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors',
          isActive ? 'text-white' : 'text-slate-500 active:text-slate-300',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
              isActive && 'bg-brand-500/20',
            )}
          >
            <IconCmp className={cn('size-5', isActive && 'text-brand-300')} />
          </span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const inAdmin = location.pathname.startsWith('/admin');

  // Fecha o menu do celular ao navegar
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_80%_50%_at_60%_-10%,rgba(59,109,255,0.10),transparent)] bg-fixed print:bg-none">
      {/* Menu fixo no desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">
        <Sidebar />
      </aside>

      {/* Menu completo no celular (admin): abre pela aba "Gestão" */}
      <div className={cn('fixed inset-0 z-40 lg:hidden print:hidden', !open && 'pointer-events-none')}>
        <div
          className={cn('absolute inset-0 bg-ink-950/60 backdrop-blur-sm transition-opacity', open ? 'opacity-100' : 'opacity-0')}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 w-72 shadow-2xl transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-[calc(env(safe-area-inset-top)+1.25rem)] right-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </aside>
      </div>

      <div className="lg:pl-64">
        {/* Topo do celular: só a marca (a navegação fica embaixo, como num app) */}
        <header className="sticky top-0 z-20 flex items-center border-b border-white/[0.06] bg-ink-950/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:hidden print:hidden">
          <div className="flex h-14 items-center">
            <Logo />
          </div>
        </header>
        <main
          className="max-w-[1440px] animate-fade-in px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6 lg:px-8 lg:py-8"
          key={location.pathname}
        >
          <Outlet />
        </main>
      </div>

      {/* Barra de abas do celular */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/[0.06] bg-ink-950/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden print:hidden">
        <TabItem to="/" label="Ponto" icon={Fingerprint} end />
        <TabItem to="/registros" label="Registros" icon={ClipboardList} />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-medium transition-colors',
              inAdmin ? 'text-white' : 'text-slate-500 active:text-slate-300',
            )}
          >
            <span className={cn('flex h-8 w-14 items-center justify-center rounded-full', inAdmin && 'bg-brand-500/20')}>
              <LayoutGrid className={cn('size-5', inAdmin && 'text-brand-300')} />
            </span>
            Gestão
          </button>
        )}
        <TabItem to="/conta" label="Conta" icon={UserRound} />
      </nav>
    </div>
  );
}
