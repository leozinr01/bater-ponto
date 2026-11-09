import { ArrowRight, CalendarX, ChartColumn, FileSpreadsheet, FileText, Hourglass, Timer, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Balance } from '../../components/timesheet';
import {
  Alert,
  Avatar,
  Card,
  cn,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  Stat,
  table,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { currentMonth, formatDate, formatMinutes, monthRange } from '../../lib/format';
import { useReport } from '../../lib/queries';
import { timesheetSection } from '../../lib/timesheet-export';
import type { Paginated, ReportItem, Timesheet } from '../../lib/types';
import { ExportMenu, type ExportOption } from '../../components/ExportMenu';
import { MonthNav } from '../../components/MonthNav';
import { exportTable, type ExportFormat } from '../../lib/export';

type ReportExport = ExportFormat | 'pdf-dias' | 'csv-dias';

const reportExportOptions: ExportOption<ReportExport>[] = [
  { value: 'pdf', label: 'Resumo em PDF', hint: 'Totais por funcionário', icon: FileText },
  { value: 'csv', label: 'Resumo em CSV', hint: 'Totais por funcionário, para o Excel', icon: FileSpreadsheet },
  { value: 'pdf-dias', label: 'Detalhado por dia em PDF', hint: 'Entrada, saída e hora extra de cada dia', icon: FileText },
  { value: 'csv-dias', label: 'Detalhado por dia em CSV', hint: 'Um bloco por funcionário, para o Excel', icon: FileSpreadsheet },
];

/** Todos os funcionários do relatório (todas as páginas). */
async function fetchReportItems(from: string, to: string) {
  const items: ReportItem[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Paginated<ReportItem>>('/punches/report', { query: { from, to, page, pageSize: 100 } });
    items.push(...res.data);
    if (page >= res.meta.totalPages) break;
  }
  return items;
}

/** Resumo por funcionário, com uma linha de total no fim. */
async function exportSummary(from: string, to: string, format: ExportFormat) {
  const items = await fetchReportItems(from, to);
  const head = [
    'Funcionário',
    'Trabalhado',
    'Previsto',
    'Hora extra 50%',
    'Hora extra 100%',
    'Horas negativas',
    'Atrasos',
    'Faltas (dias)',
    'Dias incompletos',
    'Dias abonados',
    'Dias com alerta (CLT)',
    'Marcações fora do local',
    'Banco de horas (acumulado)',
  ];
  const total = (pick: (t: ReportItem['totals']) => number | null) =>
    items.reduce((acc, i) => acc + (pick(i.totals) ?? 0), 0);
  const rows = items.map(({ employee, totals: t, hourBankMinutes }) => [
    employee.name,
    formatMinutes(t.workedMinutes),
    formatMinutes(t.expectedMinutes),
    formatMinutes(t.overtime50Minutes),
    formatMinutes(t.overtime100Minutes),
    formatMinutes(t.deficitMinutes),
    formatMinutes(t.lateMinutes),
    t.absentDays,
    t.incompleteDays,
    t.excusedDays,
    t.alertDays,
    t.outsideLocationPunches,
    formatMinutes(hourBankMinutes),
  ]);
  await exportTable(format, {
    filename: `relatorio-ponto_${from}_${to}`,
    title: 'Relatório do período',
    subtitle: `${formatDate(from)} a ${formatDate(to)} · ${items.length} funcionário(s)`,
    sections: [
      {
        head,
        rows,
        summary: [
          ['Horas trabalhadas', formatMinutes(total((t) => t.workedMinutes))],
          ['Hora extra 50%', formatMinutes(total((t) => t.overtime50Minutes))],
          ['Hora extra 100%', formatMinutes(total((t) => t.overtime100Minutes))],
          ['Horas negativas', formatMinutes(total((t) => t.deficitMinutes))],
          ['Atrasos', formatMinutes(total((t) => t.lateMinutes))],
          ['Faltas (dias)', total((t) => t.absentDays)],
        ],
      },
    ],
  });
}

/** Espelho de cada funcionário (data, entrada, intervalo, saída, hora extra) com o resumo de cada um. */
async function exportByDay(from: string, to: string, format: ExportFormat) {
  const items = await fetchReportItems(from, to);
  const sections = [];
  for (const { employee } of items) {
    const sheet = await api<Timesheet>('/punches/timesheet', { query: { employeeId: employee.id, from, to } });
    sections.push(timesheetSection(sheet, employee.name));
  }
  await exportTable(format, {
    filename: `relatorio-ponto-por-dia_${from}_${to}`,
    title: 'Relatório do período · detalhado por dia',
    subtitle: `${formatDate(from)} a ${formatDate(to)} · ${items.length} funcionário(s)`,
    sections,
  });
}

function exportReport(from: string, to: string, choice: ReportExport) {
  if (choice === 'pdf-dias') return exportByDay(from, to, 'pdf');
  if (choice === 'csv-dias') return exportByDay(from, to, 'csv');
  return exportSummary(from, to, choice);
}

const sum = (items: ReportItem[], pick: (i: ReportItem) => number | null) =>
  items.reduce((acc, i) => acc + (pick(i) ?? 0), 0);

export function ReportPage() {
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const { from, to } = monthRange(month);
  const report = useReport({ from, to, page });

  const onExport = async (choice: ReportExport) => {
    setExporting(true);
    setExportError('');
    try {
      await exportReport(from, to, choice);
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const items = report.data?.data ?? [];
  // Os totais gerais só fazem sentido quando todos os funcionários cabem numa página
  const allInOnePage = report.data?.meta.totalPages === 1;

  return (
    <>
      <PageHeader
        icon={ChartColumn}
        title="Relatório do período"
        description={`Totais por funcionário de ${formatDate(from)} a ${formatDate(to)}.`}
        actions={
          <>
            <MonthNav
              month={month}
              onChange={(m) => {
                setMonth(m);
                setPage(1);
              }}
            />
            <ExportMenu onExport={onExport} options={reportExportOptions} loading={exporting} />
          </>
        }
      />

      {exportError && (
        <div className="mb-4">
          <Alert>{exportError}</Alert>
        </div>
      )}

      {report.isPending ? (
        <Loading />
      ) : report.isError ? (
        <Alert>{errorMessage(report.error)}</Alert>
      ) : (
        <div className={cn('space-y-6 transition-opacity', report.isFetching && 'opacity-60')}>
          {allInOnePage && items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Horas trabalhadas"
                icon={Timer}
                tone="brand"
                value={formatMinutes(sum(items, (i) => i.totals.workedMinutes))}
                hint={`${items.length} funcionário(s)`}
              />
              <Stat
                label="Saldo da equipe"
                icon={Hourglass}
                tone="brand"
                value={
                  <Balance
                    overtime={sum(items, (i) => i.totals.overtimeMinutes)}
                    deficit={sum(items, (i) => i.totals.deficitMinutes)}
                  />
                }
              />
              <Stat
                label="Faltas"
                icon={CalendarX}
                value={sum(items, (i) => i.totals.absentDays)}
                tone={sum(items, (i) => i.totals.absentDays) ? 'red' : undefined}
                hint="dias, somando todos"
              />
              <Stat
                label="Dias incompletos"
                icon={TriangleAlert}
                value={sum(items, (i) => i.totals.incompleteDays)}
                tone={sum(items, (i) => i.totals.incompleteDays) ? 'amber' : undefined}
                hint="precisam de correção"
              />
            </div>
          )}

          <Card className="overflow-hidden">
            {items.length === 0 ? (
              <EmptyState icon={ChartColumn}>Nenhum funcionário cadastrado.</EmptyState>
            ) : (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead className={table.thead}>
                    <tr>
                      <th className={table.th}>Funcionário</th>
                      <th className={cn(table.th, 'text-right')}>Trabalhado</th>
                      <th className={cn(table.th, 'text-right')}>Previsto</th>
                      <th className={cn(table.th, 'text-right')}>Saldo</th>
                      <th
                        className={cn(table.th, 'text-right whitespace-nowrap')}
                        title="Horas extras com adicional de 50% (dias úteis e sábado) e de 100% (domingo e feriado)"
                      >
                        Extra 50% / 100%
                      </th>
                      <th className={cn(table.th, 'text-right')} title="Saldo do banco de horas acumulado até o fim do período">
                        Banco
                      </th>
                      <th className={cn(table.th, 'text-right')}>Atrasos</th>
                      <th className={cn(table.th, 'text-right')}>Faltas</th>
                      <th
                        className={cn(table.th, 'text-right')}
                        title="Dias de trabalho com atestado, férias, afastamento ou abono"
                      >
                        Abonados
                      </th>
                      <th className={cn(table.th, 'text-right')}>Incompletos</th>
                      <th
                        className={cn(table.th, 'text-right')}
                        title="Dias com intervalo curto, mais de 2h extras ou menos de 11h de descanso"
                      >
                        Alertas
                      </th>
                      <th className={cn(table.th, 'text-right')} title="Marcações feitas fora dos locais de trabalho">
                        Fora do local
                      </th>
                      <th className={table.th} />
                    </tr>
                  </thead>
                  <tbody className={table.tbody}>
                    {items.map(({ employee, totals: t, hourBankMinutes }) => (
                      <tr key={employee.id} className={cn(table.tr, 'group')}>
                        <td className={table.td}>
                          <div className="flex items-center gap-3">
                            <Avatar name={employee.name} size="sm" />
                            <span className="font-medium text-white">{employee.name}</span>
                          </div>
                        </td>
                        <td className={cn(table.td, 'text-right font-medium text-slate-200 tabular-nums')}>
                          {formatMinutes(t.workedMinutes)}
                        </td>
                        <td className={cn(table.td, 'text-right text-slate-500 tabular-nums')}>
                          {formatMinutes(t.expectedMinutes)}
                        </td>
                        <td className={cn(table.td, 'text-right font-medium tabular-nums')}>
                          <Balance overtime={t.overtimeMinutes} deficit={t.deficitMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right whitespace-nowrap text-slate-300 tabular-nums')}>
                          {t.overtime50Minutes || t.overtime100Minutes ? (
                            <>
                              {formatMinutes(t.overtime50Minutes)} / {formatMinutes(t.overtime100Minutes)}
                            </>
                          ) : (
                            <span className="text-slate-600">–</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right font-semibold tabular-nums')}>
                          <Link
                            to={`/banco-de-horas?funcionario=${employee.id}`}
                            className={cn(
                              'rounded px-1 hover:underline',
                              hourBankMinutes > 0 ? 'text-emerald-300' : hourBankMinutes < 0 ? 'text-red-300' : 'text-slate-400',
                            )}
                          >
                            {hourBankMinutes > 0 ? '+' : ''}
                            {formatMinutes(hourBankMinutes)}
                          </Link>
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.lateMinutes ? (
                            <span className="text-amber-300">{formatMinutes(t.lateMinutes)}</span>
                          ) : (
                            <span className="text-slate-600">–</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.absentDays > 0 ? (
                            <span className="font-semibold text-red-300">{t.absentDays}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.excusedDays > 0 ? (
                            <span className="font-semibold text-sky-300">{t.excusedDays}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.incompleteDays > 0 ? (
                            <span className="font-semibold text-amber-300">{t.incompleteDays}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.alertDays > 0 ? (
                            <span className="font-semibold text-amber-300">{t.alertDays}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right tabular-nums')}>
                          {t.outsideLocationPunches > 0 ? (
                            <span className="font-semibold text-red-300">{t.outsideLocationPunches}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right')}>
                          <Link
                            to={`/registros?funcionario=${employee.id}${month === currentMonth() ? '' : `&mes=${month}`}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-brand-300 transition-colors hover:bg-brand-500/10 hover:text-brand-200"
                          >
                            Registros <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={report.data.meta.page}
              totalPages={report.data.meta.totalPages}
              total={report.data.meta.total}
              onChange={setPage}
            />
          </Card>
          <p className="text-xs text-slate-500">
            Saldo = horas extras − falta de horas. Dias incompletos só entram no saldo depois de corrigidos. Alertas = dias
            com intervalo abaixo do mínimo, mais de 2h extras ou menos de 11h de descanso entre jornadas (CLT). Fora do
            local = marcações longe de todos os locais de trabalho.
          </p>
        </div>
      )}
    </>
  );
}
