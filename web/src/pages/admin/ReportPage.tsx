import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Balance } from '../../components/timesheet';
import { Alert, Button, Card, cn, EmptyState, Loading, PageHeader, Pagination } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { currentMonth, formatDate, formatMinutes, monthRange } from '../../lib/format';
import { useReport } from '../../lib/queries';
import type { Paginated, ReportItem } from '../../lib/types';
import { MonthNav } from '../TimesheetPage';

/** Busca todas as páginas do relatório e baixa como CSV (abre no Excel). */
async function exportCsv(from: string, to: string) {
  const items: ReportItem[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Paginated<ReportItem>>('/punches/report', { query: { from, to, page, pageSize: 100 } });
    items.push(...res.data);
    if (page >= res.meta.totalPages) break;
  }
  const header = ['Funcionário', 'Trabalhado', 'Previsto', 'Horas extras', 'Falta de horas', 'Atrasos', 'Faltas (dias)', 'Dias incompletos'];
  const rows = items.map(({ employee, totals: t }) => [
    employee.name,
    formatMinutes(t.workedMinutes),
    formatMinutes(t.expectedMinutes),
    formatMinutes(t.overtimeMinutes),
    formatMinutes(t.deficitMinutes),
    formatMinutes(t.lateMinutes),
    t.absentDays,
    t.incompleteDays,
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-ponto_${from}_${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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

  return (
    <>
      <PageHeader
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
            <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
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
        <Card className={cn('overflow-hidden', report.isFetching && 'opacity-70')}>
          {report.data.data.length === 0 ? (
            <EmptyState>Nenhum funcionário cadastrado.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Funcionário</th>
                    <th className="px-4 py-3 text-right">Trabalhado</th>
                    <th className="px-4 py-3 text-right">Previsto</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-right">Atrasos</th>
                    <th className="px-4 py-3 text-right">Faltas</th>
                    <th className="px-4 py-3 text-right">Incompletos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.data.data.map(({ employee, totals: t }) => (
                    <tr key={employee.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{employee.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(t.workedMinutes)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">
                        {formatMinutes(t.expectedMinutes)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Balance overtime={t.overtimeMinutes} deficit={t.deficitMinutes} />
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums', !!t.lateMinutes && 'text-amber-600')}>
                        {t.lateMinutes ? formatMinutes(t.lateMinutes) : '–'}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums', t.absentDays > 0 && 'font-medium text-red-600')}>
                        {t.absentDays}
                      </td>
                      <td
                        className={cn('px-4 py-3 text-right tabular-nums', t.incompleteDays > 0 && 'font-medium text-amber-600')}
                      >
                        {t.incompleteDays}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/espelho?funcionario=${employee.id}${month === currentMonth() ? '' : `&mes=${month}`}`}
                          className="text-sm font-medium whitespace-nowrap text-indigo-600 hover:text-indigo-700"
                        >
                          Ver espelho →
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
      )}
      <p className="mt-3 text-xs text-slate-400">
        Saldo = horas extras − falta de horas. Dias incompletos não entram no saldo até serem corrigidos.
      </p>
    </>
  );
}
