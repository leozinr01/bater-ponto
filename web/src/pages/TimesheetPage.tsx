import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AddPunchModal, EditPunchModal } from '../components/corrections';
import { EmployeePicker } from '../components/EmployeePicker';
import { Balance, DayStatusBadge } from '../components/timesheet';
import { Alert, Button, Card, cn, Loading, PageHeader, Stat } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  currentMonth,
  formatDate,
  formatDuration,
  formatMinutes,
  formatMonth,
  monthRange,
  shiftMonth,
  timeOf,
  WEEKDAYS,
} from '../lib/format';
import { useTimesheet } from '../lib/queries';

export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrent = month >= currentMonth();
  return (
    <div className="flex items-center gap-1">
      <Button variant="secondary" size="sm" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Mês anterior">
        ‹
      </Button>
      <span className="min-w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrent}
        aria-label="Próximo mês"
      >
        ›
      </Button>
    </div>
  );
}

export function TimesheetPage() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const month = params.get('mes') ?? currentMonth();
  const employeeId = (isAdmin && params.get('funcionario')) || '';

  const setParam = (key: string, value: string) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  const { from, to } = monthRange(month);
  const sheet = useTimesheet({ employeeId: employeeId || undefined, from, to });
  const data = sheet.data;

  const canCorrect = isAdmin && !!data && data.employee.id !== user?.id;
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; localTime: string } | null>(null);

  const totals = data?.totals;

  return (
    <>
      <PageHeader
        title="Espelho de ponto"
        description={data ? `${data.employee.name} · ${formatDate(from)} a ${formatDate(to)}` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {isAdmin && <EmployeePicker value={employeeId} onChange={(id) => setParam('funcionario', id)} />}
            <MonthNav month={month} onChange={(m) => setParam('mes', m === currentMonth() ? '' : m)} />
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        }
      />

      {sheet.isPending ? (
        <Loading />
      ) : sheet.isError ? (
        <Alert>{errorMessage(sheet.error)}</Alert>
      ) : (
        data &&
        totals && (
          <div className={cn('space-y-6', sheet.isFetching && 'opacity-70 transition-opacity')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Trabalhado" value={formatMinutes(totals.workedMinutes)} />
              <Stat label="Previsto" value={formatMinutes(totals.expectedMinutes)} />
              <Stat label="Saldo" value={<Balance overtime={totals.overtimeMinutes} deficit={totals.deficitMinutes} />} />
              <Stat label="Atrasos" value={formatMinutes(totals.lateMinutes)} tone={totals.lateMinutes ? 'amber' : undefined} />
              <Stat label="Faltas" value={totals.absentDays} tone={totals.absentDays ? 'red' : undefined} hint="dias" />
              <Stat
                label="Incompletos"
                value={totals.incompleteDays}
                tone={totals.incompleteDays ? 'amber' : undefined}
                hint="dias"
              />
            </div>

            {data.schedule ? (
              <p className="text-sm text-slate-500">
                Jornada <span className="font-medium text-slate-700">{data.schedule.name}</span>:{' '}
                {formatDuration(data.schedule.dailyMinutes)}/dia, entrada às {data.schedule.startTime},{' '}
                {data.schedule.workDays
                  .slice()
                  .sort()
                  .map((d) => WEEKDAYS[d])
                  .join(', ')}
                . Tolerâncias: {data.schedule.lateToleranceMinutes} min de atraso,{' '}
                {data.schedule.overtimeToleranceMinutes} min de saldo diário.
              </p>
            ) : (
              <Alert tone="warning">
                Sem jornada definida: as horas trabalhadas são calculadas, mas atraso, extra e falta não.
                {isAdmin && ' Defina uma jornada em Funcionários.'}
              </Alert>
            )}

            {totals.incompleteDays > 0 && (
              <Alert tone="warning">
                Há {totals.incompleteDays} dia(s) com marcação faltando. O saldo desses dias só é calculado após a
                correção.
                {canCorrect && ' Clique em “+” no dia para incluir a marcação.'}
              </Alert>
            )}

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">Dia</th>
                      <th className="px-4 py-3">Marcações</th>
                      <th className="px-4 py-3 text-right">Trabalhado</th>
                      <th className="px-4 py-3 text-right">Intervalo</th>
                      <th className="px-4 py-3 text-right">Atraso</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.days.map((day) => {
                      const off = !day.scheduled && day.punches.length === 0;
                      const entries = new Set(day.periods.map((period) => period.start));
                      return (
                        <tr
                          key={day.date}
                          className={cn(
                            off && 'bg-slate-50/60 text-slate-400',
                            day.status === 'absent' && 'bg-red-50/40',
                            day.status === 'incomplete' && 'bg-amber-50/40',
                          )}
                        >
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <span className="font-medium tabular-nums">{formatDate(day.date, false)}</span>{' '}
                            <span className="text-slate-500">{WEEKDAYS[day.weekday]}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              {day.punches.map((p) => {
                                const isEntry = entries.has(p.localTime);
                                const chip = cn(
                                  'rounded-md px-1.5 py-0.5 tabular-nums ring-1 ring-inset',
                                  isEntry
                                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                    : 'bg-slate-100 text-slate-700 ring-slate-200',
                                );
                                const label = `${isEntry ? 'Entrada' : 'Saída'} ${timeOf(p.localTime)}`;
                                return canCorrect ? (
                                  <button
                                    key={p.id}
                                    type="button"
                                    title={`${label} — clique para corrigir`}
                                    onClick={() => setEditing(p)}
                                    className={cn(chip, 'hover:ring-indigo-400')}
                                  >
                                    {timeOf(p.localTime)}
                                  </button>
                                ) : (
                                  <span key={p.id} title={label} className={chip}>
                                    {timeOf(p.localTime)}
                                  </span>
                                );
                              })}
                              {canCorrect && (
                                <button
                                  type="button"
                                  onClick={() => setAdding(day.date)}
                                  title="Incluir marcação"
                                  className="rounded-md px-1.5 py-0.5 text-slate-400 ring-1 ring-slate-200 ring-inset hover:text-indigo-600 hover:ring-indigo-400 print:hidden"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {day.punches.length ? formatMinutes(day.workedMinutes) : '–'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                            {day.breakMinutes ? formatMinutes(day.breakMinutes) : '–'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {day.lateMinutes ? (
                              <span className="text-amber-600">{formatMinutes(day.lateMinutes)}</span>
                            ) : (
                              '–'
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <Balance overtime={day.overtimeMinutes} deficit={day.deficitMinutes} />
                          </td>
                          <td className="px-4 py-2.5">
                            <DayStatusBadge day={day} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-xs text-slate-400">
              Horários no fuso {data.timezone}. Marcações em verde são entradas. Uma jornada que passa da meia-noite
              conta no dia em que começou.
            </p>
          </div>
        )
      )}

      {data && adding && (
        <AddPunchModal
          key={adding}
          open
          onClose={() => setAdding(null)}
          employeeId={data.employee.id}
          employeeName={data.employee.name}
          defaultDate={adding}
          timezone={data.timezone}
        />
      )}
      {data && editing && (
        <EditPunchModal
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          punch={editing}
          employeeName={data.employee.name}
          timezone={data.timezone}
        />
      )}
    </>
  );
}
