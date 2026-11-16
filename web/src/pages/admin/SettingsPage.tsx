import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../components/ui';

const tabs = [
  { to: 'funcionarios', label: 'Funcionários' },
  { to: 'relatorio', label: 'Relatório' },
  { to: 'jornadas', label: 'Jornadas' },
  { to: 'feriados', label: 'Feriados' },
  { to: 'locais', label: 'Locais' },
];

/** Funcionários, relatório e cadastros do cálculo, agrupados em abas para enxugar o menu. */
export function SettingsPage() {
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // No celular as abas não cabem e a tela é recriada a cada troca: rola a barra até a aba aberta
  useEffect(() => {
    const bar = nav.current;
    const active = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !active) return;
    bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <>
      <p className="mb-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase print:hidden">Configurações</p>
      <nav
        ref={nav}
        aria-label="Configurações"
        className="relative mb-6 flex gap-5 overflow-x-auto border-b border-white/[0.06] whitespace-nowrap [scrollbar-width:none] sm:gap-6 print:hidden"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors',
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
