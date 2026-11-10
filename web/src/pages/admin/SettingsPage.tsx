import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../components/ui';

const tabs = [
  { to: 'jornadas', label: 'Jornadas' },
  { to: 'feriados', label: 'Feriados' },
  { to: 'locais', label: 'Locais' },
];

/** Cadastros usados no cálculo (jornadas, feriados e locais), agrupados em abas para enxugar o menu. */
export function SettingsPage() {
  return (
    <>
      <p className="mb-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase print:hidden">Configurações</p>
      <nav
        aria-label="Configurações"
        className="mb-6 flex gap-6 overflow-x-auto border-b border-white/[0.06] whitespace-nowrap [scrollbar-width:none] print:hidden"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
                isActive ? 'border-brand-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
