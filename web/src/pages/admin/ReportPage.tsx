import { ArrowRight, CalendarX, ChartColumn, Download, Hourglass, Timer, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Balance } from '../../components/timesheet';
import {
  Alert,
  Avatar,
  Button,
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
import type { Paginated, ReportItem } from '../../lib/types';
import { MonthNav } from '../../components/MonthNav';

/** Busca todas as páginas do relatório e baixa como CSV (abre no Excel). */
async function exportCsv(from: string, to: string) {
  const items: ReportItem[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Paginated<ReportItem>>('/punches/report', { query: { from, to, page, pageSize: 100 } });
    items.push(...res.data);
    if (page >= res.meta.totalPages) break;
  }
  const header = [
    'Funcionário',
    'Trabalhado',
    'Previsto',
    'Horas extras',
    'Falta de horas',
    'Atrasos',
    'Faltas (dias)',
    'Dias incompletos',
    'Dias com alerta (CLT)',
  ];
  const rows = items.map(({ employee, totals: t }) => [
    employee.name,
    formatMinutes(t.workedMinutes),
    formatMinutes(t.expectedMinutes),
    formatMinutes(t.overtimeMinutes),
    formatMinutes(t.deficitMinutes),
    formatMinutes(t.lateMinutes),
    t.absentDays,
    t.incompleteDays,
    t.alertDays,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-ponto_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

  const onExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await exportCsv(from, to);
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
            <Button variant="secondary" icon={Download} onClick={onExport} loading={exporting}>
              Exportar CSV
            </Button>
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
                      <th className={cn(table.th, 'text-right')}>Atrasos</th>
                      <th className={cn(table.th, 'text-right')}>Faltas</th>
                      <th className={cn(table.th, 'text-right')}>Incompletos</th>
                      <th
                        className={cn(table.th, 'text-right')}
                        title="Dias com intervalo curto, mais de 2h extras ou menos de 11h de descanso"
                      >
                        Alertas
                      </th>
                      <th className={table.th} />
                    </tr>
                  </thead>
                  <tbody className={table.tbody}>
                    {items.map(({ employee, totals: t }) => (
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
            com intervalo abaixo do mínimo, mais de 2h extras ou menos de 11h de descanso entre jornadas (CLT).
          </p>
        </div>
      )}
    </>
  );
}
