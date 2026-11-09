import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmployeePicker } from '../components/EmployeePicker';
import { ExportMenu } from '../components/ExportMenu';
import { MonthNav } from '../components/MonthNav';
import { useToast } from '../components/toast';
import { cn, PageHeader } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { exportTable, type ExportFormat } from '../lib/export';
import { currentMonth, formatDate, monthRange } from '../lib/format';
import { useTimesheet } from '../lib/queries';
import { fileSlug, timesheetSection } from '../lib/timesheet-export';
import type { Timesheet } from '../lib/types';
import { DaysView } from './records/DaysView';
import { PunchesView } from './records/PunchesView';

type Tab = 'dias' | 'marcacoes';

/** Espelho de ponto do mês em PDF ou CSV: uma linha por dia e o resumo no fim. */
function exportTimesheet(format: ExportFormat, sheet: Timesheet, from: string, to: string) {
  return exportTable(format, {
    filename: `espelho-ponto_${fileSlug(sheet.employee.name)}_${from.slice(0, 7)}`,
    title: `Espelho de ponto · ${sheet.employee.name}`,
    subtitle: `${formatDate(from)} a ${formatDate(to)} · fuso ${sheet.timezone}`,
    sections: [timesheetSection(sheet)],
  });
}

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
  const { from, to } = monthRange(month);
  // Mesma consulta da aba "Por dia": vem do cache, sem buscar de novo
  const sheet = useTimesheet({ employeeId: employeeId || undefined, from, to });
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const onExport = async (format: ExportFormat) => {
    if (!sheet.data) return;
    setExporting(true);
    try {
      await exportTimesheet(format, sheet.data, from, to);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

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
            {tab === 'dias' && <ExportMenu onExport={onExport} loading={exporting} disabled={!sheet.data} />}
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
