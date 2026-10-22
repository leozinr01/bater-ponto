import { ClipboardList, Printer } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmployeePicker } from '../components/EmployeePicker';
import { MonthNav } from '../components/MonthNav';
import { Button, cn, PageHeader } from '../components/ui';
import { useAuth } from '../lib/auth';
import { currentMonth } from '../lib/format';
import { DaysView } from './records/DaysView';
import { PunchesView } from './records/PunchesView';

type Tab = 'dias' | 'marcacoes';

/**
 * Registros do mês em duas visões: por dia (o espelho de ponto) e cada marcação
 * individual (com correções). Mês, funcionário e aba ficam na URL.
 */
export function RecordsPage() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = params.get('mes') ?? currentMonth();
  const employeeId = (isAdmin && params.get('funcionario')) || '';
  const tab: Tab = params.get('aba') === 'marcacoes' ? 'marcacoes' : 'dias';

  const setParam = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader
        icon={ClipboardList}
        title="Registros"
        description="Suas horas do mês, dia a dia, e cada marcação feita."
        actions={
          <>
            {isAdmin && <EmployeePicker value={employeeId} onChange={(id) => setParam('funcionario', id)} />}
            <MonthNav month={month} onChange={(m) => setParam('mes', m === currentMonth() ? '' : m)} />
            {tab === 'dias' && (
              <Button variant="secondary" icon={Printer} onClick={() => window.print()} title="Imprimir espelho de ponto">
                Imprimir
              </Button>
            )}
          </>
        }
      />

      <div role="tablist" className="mb-6 flex gap-6 border-b border-white/[0.06] print:hidden">
        {(
          [
            ['dias', 'Por dia'],
            ['marcacoes', 'Marcações'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setParam('aba', value === 'dias' ? '' : value)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
              tab === value ? 'border-brand-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'dias' ? (
        <DaysView employeeId={employeeId} month={month} />
      ) : (
        // A chave zera a paginação ao trocar de mês ou de funcionário
        <PunchesView key={`${employeeId}-${month}`} employeeId={employeeId} month={month} />
      )}
    </>
  );
}
