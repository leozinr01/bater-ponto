import { ClipboardList, FileSpreadsheet, FileText, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmployeePicker } from '../components/EmployeePicker';
import { ExportMenu, pdfCsvOptions, type ExportOption } from '../components/ExportMenu';
import { MonthNav } from '../components/MonthNav';
import { useToast } from '../components/toast';
import { Card, cn, EmptyState, PageHeader } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { type ExportFormat, exportTable } from '../lib/export';
import { currentMonth, monthRange } from '../lib/format';
import { useTimesheet } from '../lib/queries';
import { buildTimesheetExport, exportAllTimesheets } from '../lib/timesheet-export';
import { DaysView } from './records/DaysView';
import { PunchesView } from './records/PunchesView';

type Tab = 'dias' | 'marcacoes';
type RecordsExport = ExportFormat | 'pdf-todos' | 'csv-todos';

/** O admin exporta a folha do funcionário escolhido ou a de todos os funcionários num arquivo só. */
const adminExportOptions: ExportOption<RecordsExport>[] = [
  { value: 'pdf', label: 'PDF deste funcionário', hint: 'Folha de ponto do mês', icon: FileText },
  { value: 'csv', label: 'CSV deste funcionário', hint: 'Para abrir no Excel', icon: FileSpreadsheet },
  { value: 'pdf-todos', label: 'PDF de todos', hint: 'Uma folha por funcionário', icon: FileText },
  { value: 'csv-todos', label: 'CSV de todos', hint: 'Um bloco por funcionário', icon: FileSpreadsheet },
];

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
  // O admin não bate ponto: vê a folha de um funcionário (o seletor já escolhe o primeiro)
  const ready = !isAdmin || !!employeeId;
  // Mesma consulta da aba "Por dia": vem do cache, sem buscar de novo
  const sheet = useTimesheet({ employeeId: employeeId || undefined, from, to }, ready);
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  const onExport = async (choice: RecordsExport) => {
    setExporting(true);
    try {
      if (choice === 'pdf-todos' || choice === 'csv-todos') {
        await exportAllTimesheets(from, to, choice === 'pdf-todos' ? 'pdf' : 'csv');
      } else if (sheet.data) {
        await exportTable(choice, buildTimesheetExport(sheet.data, from, to));
      }
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
        description={
          isAdmin ? 'Folha de ponto de cada funcionário, dia a dia.' : 'Suas horas do mês, dia a dia, e cada marcação feita.'
        }
        actions={
          <>
            {isAdmin && <EmployeePicker value={employeeId} onChange={(id) => setParam('funcionario', id)} />}
            <MonthNav month={month} onChange={(m) => setParam('mes', m === currentMonth() ? '' : m)} />
            {tab === 'dias' &&
              (isAdmin ? (
                <ExportMenu<RecordsExport> onExport={onExport} options={adminExportOptions} loading={exporting} />
              ) : (
                <ExportMenu onExport={onExport} options={pdfCsvOptions} loading={exporting} disabled={!sheet.data} />
              ))}
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

      {!ready ? (
        <Card>
          <EmptyState icon={Users}>Escolha um funcionário no seletor acima para ver a folha de ponto.</EmptyState>
        </Card>
      ) : tab === 'dias' ? (
        <DaysView employeeId={employeeId} month={month} />
      ) : (
        // A chave zera a paginação ao trocar de mês ou de funcionário
        <PunchesView key={`${employeeId}-${month}`} employeeId={employeeId} month={month} />
      )}
    </>
  );
}
