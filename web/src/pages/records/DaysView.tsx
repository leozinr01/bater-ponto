import { CalendarCheck, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AddPunchModal, EditPunchModal } from '../../components/corrections';
import { PeriodPairs, type PunchRef } from '../../components/DayPeriods';
import { Balance, DayStatusBadge } from '../../components/timesheet';
import { Alert, Card, cn, EmptyState, Loading, Segmented } from '../../components/ui';
import { WeekStrip } from '../../components/WeekStrip';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { currentMonth, formatDate, formatMinutes, monthRange, timeOf, today, WEEKDAYS } from '../../lib/format';
import { useTimesheet } from '../../lib/queries';
import type { TimesheetDay } from '../../lib/types';

type Filter = 'all' | 'pending' | 'absent';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "20 – 26 out" */
function weekLabel(first: string, last: string) {
  const m = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];
  const d = (s: string) => Number(s.slice(8));
  return m(first) === m(last) ? `${d(first)} – ${d(last)} ${m(last)}` : `${d(first)} ${m(first)} – ${d(last)} ${m(last)}`;
}

/** Agrupa os dias (em ordem) em semanas de segunda a domingo. */
function groupByWeek(days: TimesheetDay[]) {
  const weeks: TimesheetDay[][] = [];
  for (const day of days) {
    const current = weeks.at(-1);
    if (current && day.weekday !== 1) current.push(day);
    else weeks.push([day]);
  }
  return weeks;
}

const isOff = (d: TimesheetDay) => !d.scheduled && d.punches.length === 0;

function SummaryItem({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex-1 px-5 py-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 tabular-nums">{hint}</p>}
    </div>
  );
}

/** Uma linha da lista: data, pares de horário, horas e saldo. */
function DayRow({
  day,
  isToday,
  canCorrect,
  onEdit,
  onAdd,
}: {
  day: TimesheetDay;
  isToday: boolean;
  canCorrect: boolean;
  onEdit: (p: PunchRef) => void;
  onAdd: () => void;
}) {
  const showStatus = day.status !== 'complete' || day.punches.length === 0;
  return (
    <li
      className={cn(
        'group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5',
        isToday && 'bg-brand-500/[0.06]',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
          isToday ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' : 'bg-ink-800 text-white ring-1 ring-white/[0.08]',
        )}
      >
        <span className="text-base font-bold">{day.date.slice(8)}</span>
        <span className={cn('mt-0.5 text-[10px] uppercase', isToday ? 'text-brand-100' : 'text-slate-500')}>
          {WEEKDAYS[day.weekday]}
        </span>
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        {day.periods.length > 0 && <PeriodPairs day={day} onEdit={canCorrect ? onEdit : undefined} />}
        {showStatus && (
          <span className="flex items-center gap-2">
            <DayStatusBadge day={day} />
            {day.lateMinutes ? <span className="text-[11px] text-amber-300">Atraso {formatMinutes(day.lateMinutes)}</span> : null}
          </span>
        )}
        {!showStatus && day.lateMinutes ? (
          <span className="text-[11px] text-amber-300">Atraso {formatMinutes(day.lateMinutes)}</span>
        ) : null}
        {canCorrect && (
          <button
            type="button"
            onClick={onAdd}
            title="Incluir marcação"
            aria-label={`Incluir marcação em ${formatDate(day.date)}`}
            className="flex size-7 items-center justify-center rounded-lg text-slate-500 opacity-60 ring-1 ring-white/10 ring-inset transition hover:bg-brand-500/15 hover:text-brand-200 hover:ring-brand-400/40 group-hover:opacity-100"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-bold text-white tabular-nums">
          {day.punches.length ? formatMinutes(day.workedMinutes) : <span className="text-slate-600">–</span>}
        </p>
        {Boolean(day.overtimeMinutes || day.deficitMinutes) && (
          <p className="text-xs font-medium tabular-nums">
            <Balance overtime={day.overtimeMinutes} deficit={day.deficitMinutes} />
          </p>
        )}
      </div>
    </li>
  );
}

/** Tabela no formato do espelho de ponto, só para impressão. */
function PrintTable({ days }: { days: TimesheetDay[] }) {
  return (
    <table className="hidden w-full text-sm print:table">
      <thead>
        <tr className="border-b text-left">
          <th className="py-1">Dia</th>
          <th className="py-1">Marcações</th>
          <th className="py-1 text-right">Trabalhado</th>
          <th className="py-1 text-right">Intervalo</th>
          <th className="py-1 text-right">Atraso</th>
          <th className="py-1 text-right">Saldo</th>
          <th className="py-1">Situação</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className="border-b">
            <td className="py-1">
              {formatDate(d.date, false)} {WEEKDAYS[d.weekday]}
            </td>
            <td className="py-1 tabular-nums">{d.punches.map((p) => timeOf(p.localTime)).join('  ')}</td>
            <td className="py-1 text-right tabular-nums">{d.punches.length ? formatMinutes(d.workedMinutes) : '–'}</td>
            <td className="py-1 text-right tabular-nums">{d.breakMinutes ? formatMinutes(d.breakMinutes) : '–'}</td>
            <td className="py-1 text-right tabular-nums">{d.lateMinutes ? formatMinutes(d.lateMinutes) : '–'}</td>
            <td className="py-1 text-right tabular-nums">
              <Balance overtime={d.overtimeMinutes} deficit={d.deficitMinutes} />
            </td>
            <td className="py-1">
              <DayStatusBadge day={d} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DaysView({ employeeId, month }: { employeeId: string; month: string }) {
  const { user, isAdmin } = useAuth();
  const { from, to } = monthRange(month);
  const sheet = useTimesheet({ employeeId: employeeId || undefined, from, to });
  const data = sheet.data;
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<PunchRef | null>(null);

  if (sheet.isPending) return <Loading rows={10} />;
  if (sheet.isError) return <Alert>{errorMessage(sheet.error)}</Alert>;
  if (!data) return null;

  const canCorrect = isAdmin && data.employee.id !== user?.id;
  const todayDate = today(data.timezone);
  const totals = data.totals;
  const matches = (d: TimesheetDay) =>
    filter === 'pending' ? d.status === 'incomplete' : filter === 'absent' ? d.status === 'absent' : !isOff(d);
  // Semanas da mais recente para a mais antiga; dentro da semana, o dia mais recente primeiro
  const weeks = groupByWeek(data.days)
    .map((week) => ({ all: week, visible: week.filter(matches).reverse() }))
    .filter((w) => w.visible.length > 0)
    .reverse();

  return (
    <div className={cn('space-y-6 transition-opacity', sheet.isFetching && 'opacity-60')}>
      {/* Cabeçalho só da impressão: o documento oficial se chama espelho de ponto */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Espelho de ponto</h1>
        <p>
          {data.employee.name} · {formatDate(from)} a {formatDate(to)} · fuso {data.timezone}
        </p>
      </div>

      {/* Resumo do mês */}
      <Card className="print:hidden">
        <div className="flex divide-x divide-white/[0.06]">
          <SummaryItem
            label="Trabalhado"
            value={formatMinutes(totals.workedMinutes)}
            hint={totals.expectedMinutes !== null ? `de ${formatMinutes(totals.expectedMinutes)} previstas` : undefined}
          />
          <SummaryItem label="Saldo" value={<Balance overtime={totals.overtimeMinutes} deficit={totals.deficitMinutes} />} />
          <SummaryItem
            label="Atrasos"
            value={<span className={totals.lateMinutes ? 'text-amber-300' : ''}>{formatMinutes(totals.lateMinutes)}</span>}
          />
        </div>
        {!data.schedule && (
          <p className="border-t border-white/[0.06] px-5 py-2.5 text-xs text-amber-300">
            Sem jornada definida: saldo, atrasos e faltas não são calculados.
          </p>
        )}
      </Card>

      {month === currentMonth() && (
        <div className="print:hidden">
          <WeekStrip days={data.days} todayDate={todayDate} />
        </div>
      )}

      {/* Lista de dias, agrupada por semana */}
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Dias</h2>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'pending', label: `Pendências${totals.incompleteDays ? ` · ${totals.incompleteDays}` : ''}` },
              { value: 'absent', label: `Faltas${totals.absentDays ? ` · ${totals.absentDays}` : ''}` },
            ]}
          />
        </div>

        {weeks.length === 0 ? (
          <Card>
            <EmptyState icon={CalendarCheck}>
              {filter === 'pending'
                ? 'Nenhum dia com marcação faltando. Tudo certo!'
                : filter === 'absent'
                  ? 'Nenhuma falta no mês.'
                  : 'Nenhum dia de trabalho neste mês ainda.'}
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-4">
            {weeks.map(({ all, visible }) => {
              const worked = all.reduce((acc, d) => acc + d.workedMinutes, 0);
              const overtime = all.reduce((acc, d) => acc + (d.overtimeMinutes ?? 0), 0);
              const deficit = all.reduce((acc, d) => acc + (d.deficitMinutes ?? 0), 0);
              return (
                <Card key={all[0].date} className="overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
                    <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                      {weekLabel(all[0].date, all[all.length - 1].date)}
                    </p>
                    <p className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                      <span>
                        <span className="font-semibold text-slate-200">{formatMinutes(worked)}</span> trabalhadas
                      </span>
                      {data.schedule && (overtime || deficit) ? (
                        <span className="font-medium">
                          <Balance overtime={overtime} deficit={deficit} />
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <ul className="divide-y divide-white/[0.04]">
                    {visible.map((day) => (
                      <DayRow
                        key={day.date}
                        day={day}
                        isToday={day.date === todayDate}
                        canCorrect={canCorrect}
                        onEdit={setEditing}
                        onAdd={() => setAdding(day.date)}
                      />
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PrintTable days={data.days} />

      {adding && (
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
      {editing && (
        <EditPunchModal
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          punch={editing}
          employeeName={data.employee.name}
          timezone={data.timezone}
        />
      )}
    </div>
  );
}
