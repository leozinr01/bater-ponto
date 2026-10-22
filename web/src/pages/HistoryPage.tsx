import { useState } from 'react';
import { EmployeePicker } from '../components/EmployeePicker';
import { Alert, Badge, Card, cn, EmptyState, Field, Input, Loading, PageHeader, Pagination } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { currentMonth, dateOf, formatDate, formatDateTime, monthRange, timeOf, WEEKDAYS } from '../lib/format';
import { usePunches } from '../lib/queries';

export function HistoryPage() {
  const { isAdmin } = useAuth();
  const initial = monthRange(currentMonth());
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [includeVoided, setIncludeVoided] = useState(true);
  const [page, setPage] = useState(1);

  const punches = usePunches({
    employeeId: employeeId || undefined,
    from: from || undefined,
    to: to || undefined,
    includeVoided,
    page,
    pageSize: 50,
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Histórico de marcações"
        description="Todas as marcações, inclusive as incluídas e desconsideradas por correção."
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        {isAdmin && (
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Funcionário</span>
            <EmployeePicker value={employeeId} onChange={reset(setEmployeeId)} />
          </div>
        )}
        <Field label="De">
          {(id) => <Input id={id} type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />}
        </Field>
        <Field label="Até">
          {(id) => <Input id={id} type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />}
        </Field>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300 accent-indigo-600"
            checked={includeVoided}
            onChange={(e) => reset(setIncludeVoided)(e.target.checked)}
          />
          Mostrar desconsideradas
        </label>
      </Card>

      {punches.isPending ? (
        <Loading />
      ) : punches.isError ? (
        <Alert>{errorMessage(punches.error)}</Alert>
      ) : (
        <Card className={cn('overflow-hidden', punches.isFetching && 'opacity-70')}>
          {punches.data.data.length === 0 ? (
            <EmptyState>Nenhuma marcação no período.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {punches.data.data.map((p) => {
                    const date = dateOf(p.localTime);
                    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
                    return (
                      <tr key={p.id} className={cn(p.voided && 'text-slate-400')}>
                        <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                          {formatDate(date)} <span className="text-slate-400">{WEEKDAYS[weekday]}</span>
                        </td>
                        <td className={cn('px-4 py-2.5 font-medium tabular-nums', p.voided && 'line-through')}>
                          {timeOf(p.localTime)}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.source === 'ADMIN' ? (
                            <Badge tone="indigo">{p.replacesId ? 'Correção (troca)' : 'Correção (inclusão)'}</Badge>
                          ) : (
                            <Badge>Registro</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.voided ? <Badge tone="red">Desconsiderada</Badge> : <Badge tone="green">Válida</Badge>}
                        </td>
                        <td className="max-w-md px-4 py-2.5 text-xs text-slate-500">
                          {p.reason && <p>Motivo: {p.reason}</p>}
                          {p.voided && (
                            <p>
                              Desconsiderada em {p.voidedAt && formatDateTime(p.voidedAt)}: {p.voidReason}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={punches.data.meta.page}
            totalPages={punches.data.meta.totalPages}
            total={punches.data.meta.total}
            onChange={setPage}
          />
        </Card>
      )}
    </>
  );
}
