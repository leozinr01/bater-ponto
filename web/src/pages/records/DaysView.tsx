import { CalendarCheck, ChevronRight, HeartPulse, PiggyBank, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { AbsenceModal, AbsencesCard } from '../../components/absences';
import { AddPunchModal, EditPunchModal } from '../../components/corrections';
import { PeriodPairs, type PunchRef } from '../../components/DayPeriods';
import { DayLocationAlert } from '../../components/location';
import { alertLabels, Balance, DayAlerts, DayStatusBadge } from '../../components/timesheet';
import { Alert, Badge, Button, Card, cn, EmptyState, Loading, Segmented } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { addDays, formatDate, formatMinutes, monthRange, timeOf, today, WEEKDAYS } from '../../lib/format';
import { useHourBank, useTimesheet } from '../../lib/queries';
import type { Timesheet, TimesheetDay } from '../../lib/types';

type Filter = 'all' | 'pending' | 'absent' | 'alerts';

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

const isOff = (d: TimesheetDay) => !d.scheduled && !d.holiday && !d.absence && d.punches.length === 0;

/** Resumo no cabeçalho da semana: trabalhado × previsto e o saldo, ou "em andamento". */
function WeekSummary({ days, todayDate }: { days: TimesheetDay[]; todayDate: string }) {
  const close = days.find((d) => d.week)?.week;
  if (!close) {
    if (!days.some((d) => d.scheduled || d.status === 'absent')) return null;
    const sunday = addDays(days[0].date, (7 - days[0].weekday) % 7);
    if (sunday < todayDate) {
      // Semana que termina no mês seguinte: o saldo sai no espelho de lá
      return <span className="text-slate-500 normal-case">Saldo no espelho do mês seguinte</span>;
    }
    const worked = days.filter((d) => d.scheduled).reduce((sum, d) => sum + d.workedMinutes, 0);
    return (
      <span className="text-slate-500 normal-case">
        Em andamento · <span className="tabular-nums">{formatMinutes(worked)}</span> trabalhadas
      </span>
    );
  }
  const balance = close.workedMinutes - close.expectedMinutes;
  return (
    <span className="text-slate-400 normal-case tabular-nums">
      {formatMinutes(close.workedMinutes)} de {formatMinutes(close.expectedMinutes)}
      {close.pending ? (
        <span className="ml-2 text-amber-300">saldo pendente</span>
      ) : (
        <span
          className={cn(
            'ml-2 font-semibold',
            balance > 0 ? 'text-emerald-300' : balance < 0 ? 'text-red-300' : 'text-slate-300',
          )}
        >
          {balance > 0 ? '+' : ''}
          {formatMinutes(balance)}
        </span>
      )}
    </span>
  );
}

function SummaryItem({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 flex-1 px-3 py-4 sm:px-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white tabular-nums sm:text-2xl">{value}</p>
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
  onExcuse,
}: {
  day: TimesheetDay;
  isToday: boolean;
  canCorrect: boolean;
  onEdit: (p: PunchRef) => void;
  onAdd: () => void;
  onExcuse: () => void;
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

      <div className="min-w-0 flex-1 space-y-2">
        {day.periods.length > 0 && <PeriodPairs day={day} onEdit={canCorrect ? onEdit : undefined} />}
        {/* Situação, alertas e ações ficam abaixo dos horários */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 empty:hidden">
          {day.holiday && day.punches.length > 0 && (
            <span title={day.holiday}>
              <Badge tone="brand">Feriado</Badge>
            </span>
          )}
          <DayAlerts alerts={day.alerts} />
          <DayLocationAlert day={day} />
          {showStatus && (
            <span className="flex items-center gap-2">
              <DayStatusBadge day={day} />
              {day.absence && !day.punches.length ? (
                <span className="max-w-56 truncate text-[11px] text-slate-400" title={day.absence.reason}>
                  {day.absence.reason}
                </span>
              ) : (
                day.holiday && !day.punches.length && <span className="text-[11px] text-slate-400">{day.holiday}</span>
              )}
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
          {canCorrect && day.status === 'absent' && (
            <button
              type="button"
              onClick={onExcuse}
              title="Lançar atestado, férias ou abono"
              className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-sky-300 opacity-70 ring-1 ring-sky-400/25 ring-inset transition hover:bg-sky-500/10 group-hover:opacity-100"
            >
              <HeartPulse className="size-3.5" />
              Abonar
            </button>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-bold text-white tabular-nums">
          {day.punches.length ? formatMinutes(day.workedMinutes) : <span className="text-slate-600">–</span>}
        </p>
        {Boolean(day.overtimeMinutes || day.deficitMinutes) && (
          <p className="text-xs font-medium tabular-nums" title={day.week ? 'Saldo da semana inteira' : undefined}>
            {day.week && <span className="mr-1 font-normal text-slate-500">semana</span>}
            <Balance overtime={day.overtimeMinutes} deficit={day.deficitMinutes} />
          </p>
        )}
      </div>
    </li>
  );
}

/** Tabela do espelho de ponto no formato impresso (Ctrl+P), estilizada no CSS @media print. */
function PrintTable({ days }: { days: TimesheetDay[] }) {
  const periods = (d: TimesheetDay) => {
    const times = d.punches.map((p) => timeOf(p.localTime));
    const [entry, breakOut, breakIn, exit] =
      times.length <= 2 ? [times[0], undefined, undefined, times[1]] : times;
    return { entry: entry ?? '–', breakOut: breakOut ?? '–', breakIn: breakIn ?? '–', exit: exit ?? '–', extra: times.slice(4) };
  };
  const statusText = (d: TimesheetDay) => {
    if (d.holiday) return `Feriado: ${d.holiday}`;
    if (d.absence) return d.absence.reason;
    if (d.status === 'absent') return 'Falta';
    if (d.status === 'incomplete') return 'Incompleto';
    if (d.status === 'in_progress') return 'Em andamento';
    if (d.status === 'complete' && d.punches.length === 0) return d.scheduled ? '–' : 'Folga';
    return 'Completo';
  };
  const extra = (d: TimesheetDay) =>
    d.overtimeMinutes ? `${formatMinutes(d.overtimeMinutes)} (${d.overtimeRate}%)` : '–';
  const neg = (d: TimesheetDay) => (d.deficitMinutes ? formatMinutes(d.deficitMinutes) : '–');
  const late = (d: TimesheetDay) => (d.lateMinutes ? formatMinutes(d.lateMinutes) : '–');
  const balance = (d: TimesheetDay) => {
    if (d.overtimeMinutes === null && d.deficitMinutes === null) return '–';
    const b = (d.overtimeMinutes ?? 0) - (d.deficitMinutes ?? 0);
    return `${b > 0 ? '+' : ''}${formatMinutes(b)}`;
  };
  return (
    <table className="print-timesheet hidden print:table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Dia</th>
          <th>Entrada</th>
          <th>Saída intv.</th>
          <th>Volta intv.</th>
          <th>Saída</th>
          <th className="num">Trabalhado</th>
          <th className="num">Hora extra</th>
          <th className="num">Negativo</th>
          <th className="num">Atraso</th>
          <th className="num">Saldo</th>
          <th>Situação</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => {
          const p = periods(d);
          const weekend = d.weekday === 0 || d.weekday === 6;
          return (
            <tr key={d.date} className={weekend ? 'weekend' : undefined}>
              <td className="num">{formatDate(d.date, false)}</td>
              <td>{WEEKDAYS[d.weekday]}</td>
              <td className="num">{p.entry}</td>
              <td className="num">{p.breakOut}</td>
              <td className="num">{p.breakIn}</td>
              <td className="num">{p.exit}</td>
              <td className="num">{d.punches.length ? formatMinutes(d.workedMinutes) : '–'}</td>
              <td className="num">{extra(d)}</td>
              <td className="num">{neg(d)}</td>
              <td className="num">{late(d)}</td>
              <td className="num">{balance(d)}</td>
              <td>
                {statusText(d)}
                {d.week &&
                  ` · Fechamento da semana: ${formatMinutes(d.week.workedMinutes)} de ${formatMinutes(d.week.expectedMinutes)}`}
                {d.alerts.length > 0 && ` · ${d.alerts.map((a) => alertLabels[a].label).join(', ')}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Resumo e assinaturas no modo impressão. */
function PrintFooter({ totals }: { totals: Timesheet['totals'] }) {
  const row = (label: string, value: string | number | null | undefined) => (
    <>
      <dt>{label}</dt>
      <dd className="num">{typeof value === 'number' ? value : formatMinutes(value as number | null | undefined)}</dd>
    </>
  );
  return (
    <>
      <div className="print-summary hidden print:block">
        <h2>Resumo do período</h2>
        <dl>
          {row('Horas trabalhadas', totals.workedMinutes)}
          {row('Hora extra 50%', totals.overtime50Minutes)}
          {row('Horas previstas', totals.expectedMinutes)}
          {row('Hora extra 100%', totals.overtime100Minutes)}
          {row('Horas negativas', totals.deficitMinutes)}
          {row('Atrasos', totals.lateMinutes)}
          {row('Faltas (dias)', totals.absentDays)}
          {row('Dias incompletos', totals.incompleteDays)}
        </dl>
      </div>
      <div className="print-signatures hidden print:grid">
        <div>Assinatura do funcionário</div>
        <div />
        <div>Assinatura do responsável</div>
      </div>
    </>
  );
}

export function DaysView({ employeeId, month }: { employeeId: string; month: string }) {
  const { user, isAdmin } = useAuth();
  const { from, to } = monthRange(month);
  const sheet = useTimesheet({ employeeId: employeeId || undefined, from, to });
  const bank = useHourBank({ employeeId: employeeId || undefined });
  const data = sheet.data;
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<PunchRef | null>(null);
  const [excusing, setExcusing] = useState<string | null>(null);

  if (sheet.isPending) return <Loading rows={10} />;
  if (sheet.isError) return <Alert>{errorMessage(sheet.error)}</Alert>;
  if (!data) return null;

  const canCorrect = isAdmin && data.employee.id !== user?.id;
  const todayDate = today(data.timezone);
  const totals = data.totals;
  const matches = (d: TimesheetDay) =>
    filter === 'pending'
      ? d.status === 'incomplete'
      : filter === 'absent'
        ? d.status === 'absent'
        : filter === 'alerts'
          ? d.alerts.length > 0
          : !isOff(d);
  // Semanas da mais recente para a mais antiga; dentro da semana, o dia mais recente primeiro
  const weeks = groupByWeek(data.days)
    .map((week) => ({ all: week, visible: week.filter(matches).reverse() }))
    .filter((w) => w.visible.length > 0)
    .reverse();

  return (
    <div className={cn('space-y-6 transition-opacity', sheet.isFetching && 'opacity-60')}>
      {/* Cabeçalho só da impressão (Ctrl+P): o documento oficial se chama espelho de ponto */}
      <div className="print-header hidden print:block">
        <h1>Espelho de ponto</h1>
        <div className="print-meta">
          <div><b>Funcionário:</b> {data.employee.name}</div>
          <div><b>Período:</b> {formatDate(from)} a {formatDate(to)}</div>
          <div>
            <b>Jornada:</b>{' '}
            {data.schedule ? `${data.schedule.name} (início ${data.schedule.startTime})` : 'Não definida'}
          </div>
          <div><b>Fuso horário:</b> {data.timezone}</div>
        </div>
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
        {bank.data && (
          <Link
            to={`/banco-de-horas${employeeId ? `?funcionario=${employeeId}` : ''}`}
            className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.02] hover:text-white"
          >
            <PiggyBank className="size-4 text-slate-500" />
            Banco de horas hoje:
            <span
              className={cn(
                'font-semibold tabular-nums',
                bank.data.totals.balanceMinutes > 0
                  ? 'text-emerald-300'
                  : bank.data.totals.balanceMinutes < 0
                    ? 'text-red-300'
                    : 'text-slate-300',
              )}
            >
              {bank.data.totals.balanceMinutes > 0 ? '+' : ''}
              {formatMinutes(bank.data.totals.balanceMinutes)}
            </span>
            <ChevronRight className="ml-auto size-4" />
          </Link>
        )}
        {!data.schedule && (
          <p className="border-t border-white/[0.06] px-5 py-2.5 text-xs text-amber-300">
            Sem jornada definida: saldo, atrasos e faltas não são calculados.
          </p>
        )}
      </Card>

      <AbsencesCard employeeId={employeeId || undefined} from={from} to={to} canManage={canCorrect} />

      {/* Lista de dias, agrupada por semana */}
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Dias</h2>
            {canCorrect && (
              <Button size="sm" variant="secondary" icon={HeartPulse} onClick={() => setExcusing(todayDate)}>
                Lançar abono
              </Button>
            )}
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'pending', label: `Pendências${totals.incompleteDays ? ` · ${totals.incompleteDays}` : ''}` },
              { value: 'absent', label: `Faltas${totals.absentDays ? ` · ${totals.absentDays}` : ''}` },
              { value: 'alerts', label: `Alertas${totals.alertDays ? ` · ${totals.alertDays}` : ''}` },
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
                  : filter === 'alerts'
                    ? 'Nenhum alerta de intervalo, horas extras ou descanso no mês.'
                    : 'Nenhum dia de trabalho neste mês ainda.'}
            </EmptyState>
          </Card>
        ) : (
          <div className="space-y-4">
            {weeks.map(({ all, visible }) => (
              <Card key={all[0].date} className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-white/[0.06] px-4 py-2.5 text-xs font-medium sm:px-5">
                  <span className="tracking-wide text-slate-400 uppercase">
                    {weekLabel(all[0].date, all[all.length - 1].date)}
                  </span>
                  <WeekSummary days={all} todayDate={todayDate} />
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
                      onExcuse={() => setExcusing(day.date)}
                    />
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PrintTable days={data.days} />
      <PrintFooter totals={data.totals} />

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
      {excusing && (
        <AbsenceModal
          key={excusing}
          employeeId={data.employee.id}
          employeeName={data.employee.name}
          defaultDate={excusing}
          onClose={() => setExcusing(null)}
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
