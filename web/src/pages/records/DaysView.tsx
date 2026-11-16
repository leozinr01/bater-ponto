import { CalendarCheck, ChevronRight, HeartPulse, PiggyBank, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { AbsenceModal, AbsencesCard } from '../../components/absences';
import { AddPunchModal, EditPunchModal } from '../../components/corrections';
import { DailyHoursChart } from '../../components/DailyHoursChart';
import { PeriodPairs, type PunchRef } from '../../components/DayPeriods';
import { DayLocationAlert } from '../../components/location';
import { alertLabels, DayAlerts, DayStatusBadge } from '../../components/timesheet';
import { Alert, Badge, Button, Card, cn, EmptyState, Loading, Segmented } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  addDays,
  formatDate,
  formatMinutes,
  formatSigned,
  monthRange,
  timeOf,
  today,
  WEEKDAYS,
} from '../../lib/format';
import { useHourBank, useTimesheet } from '../../lib/queries';
import { balanceText, dailyBars, dayBalance, punchColumns } from '../../lib/timesheet-cells';
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

const signedTone = (minutes: number | null | undefined) =>
  !minutes ? 'text-slate-400' : minutes > 0 ? 'text-emerald-300' : 'text-red-300';

/** Saldo com sinal: + extra em verde, - falta em vermelho. */
function Signed({ minutes, className }: { minutes: number | null | undefined; className?: string }) {
  if (minutes === null || minutes === undefined) return <span className="text-slate-600">–</span>;
  return <span className={cn('tabular-nums', signedTone(minutes), className)}>{formatSigned(minutes)}</span>;
}

/** Resumo na faixa da semana: trabalhado × previsto e o saldo, ou "em andamento". */
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
  return (
    <span className="text-slate-400 normal-case tabular-nums">
      {formatMinutes(close.workedMinutes)} de {formatMinutes(close.expectedMinutes)}
      {close.pending ? (
        <span className="ml-2 text-amber-300">saldo pendente</span>
      ) : (
        <Signed minutes={close.workedMinutes - close.expectedMinutes} className="ml-2 font-semibold" />
      )}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="truncate text-[11px] text-slate-500 tabular-nums">{hint}</p>}
    </div>
  );
}

/** Horário que, para o admin, abre a correção da marcação. */
function TimeCell({ punch, onEdit }: { punch: PunchRef | null; onEdit?: (p: PunchRef) => void }) {
  if (!punch) return <span className="text-slate-600">–</span>;
  const time = timeOf(punch.localTime);
  return onEdit ? (
    <button
      type="button"
      onClick={() => onEdit(punch)}
      title="Clique para corrigir"
      className="-mx-1 rounded-md px-1 font-medium text-slate-100 tabular-nums transition hover:bg-white/5 hover:ring-1 hover:ring-brand-400/50"
    >
      {time}
    </button>
  ) : (
    <span className="font-medium text-slate-100 tabular-nums">{time}</span>
  );
}

const Now = () => (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-300">
    <span className="size-1.5 animate-pulse rounded-full bg-brand-400" />
    agora
  </span>
);

/** Situação só quando foge do normal: falta, pendência, feriado, abono, atraso e alertas. */
function DayStatus({ day }: { day: TimesheetDay }) {
  const unusual = day.status !== 'complete' || day.punches.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5 empty:hidden">
      {unusual && <DayStatusBadge day={day} />}
      {day.holiday && day.punches.length > 0 && (
        <span title={day.holiday}>
          <Badge tone="brand">Feriado</Badge>
        </span>
      )}
      {(day.absence || day.holiday) && !day.punches.length && (
        <span className="max-w-44 truncate text-[11px] text-slate-400" title={day.absence?.reason ?? day.holiday ?? ''}>
          {day.absence?.reason ?? day.holiday}
        </span>
      )}
      {day.lateMinutes ? (
        <span className="text-[11px] font-medium text-amber-300">Atraso {formatMinutes(day.lateMinutes)}</span>
      ) : null}
      <DayAlerts alerts={day.alerts} />
      <DayLocationAlert day={day} />
    </div>
  );
}

/** Ações do admin na linha: incluir marcação e, na falta, abonar. */
function RowActions({ day, onAdd, onExcuse }: { day: TimesheetDay; onAdd: () => void; onExcuse: () => void }) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
      {day.status === 'absent' && (
        <button
          type="button"
          onClick={onExcuse}
          title="Lançar atestado, férias ou abono"
          className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-sky-300 ring-1 ring-sky-400/25 ring-inset transition hover:bg-sky-500/10"
        >
          <HeartPulse className="size-3.5" />
          Abonar
        </button>
      )}
      <button
        type="button"
        onClick={onAdd}
        title="Incluir marcação"
        aria-label={`Incluir marcação em ${formatDate(day.date)}`}
        className="flex size-7 items-center justify-center rounded-lg text-slate-500 ring-1 ring-white/10 ring-inset transition hover:bg-brand-500/15 hover:text-brand-200 hover:ring-brand-400/40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/** Saldo da linha; no último dia de trabalho da semana, é o saldo da semana inteira. */
function RowBalance({ day }: { day: TimesheetDay }) {
  const balance = dayBalance(day);
  if (!balance && !(day.week && balance === 0)) return <span className="text-slate-600">–</span>;
  return (
    <span className="inline-flex items-baseline gap-1" title={day.week ? 'Saldo da semana inteira' : undefined}>
      <Signed minutes={balance} className="font-semibold" />
      {day.week && <span className="text-[10px] font-normal text-slate-500">semana</span>}
    </span>
  );
}

interface RowProps {
  day: TimesheetDay;
  isToday: boolean;
  canCorrect: boolean;
  onEdit: (p: PunchRef) => void;
  onAdd: () => void;
  onExcuse: () => void;
}

const DateLabel = ({ day, isToday }: { day: TimesheetDay; isToday: boolean }) => (
  <span className="flex items-baseline gap-2">
    <span className={cn('w-7 text-[11px] font-medium uppercase', isToday ? 'text-brand-300' : 'text-slate-500')}>
      {WEEKDAYS[day.weekday]}
    </span>
    <span className={cn('font-semibold tabular-nums', isToday ? 'text-brand-200' : 'text-white')}>
      {formatDate(day.date, false)}
    </span>
  </span>
);

/** Linha da folha no computador: uma coluna para cada informação. */
function SheetRow({ day, isToday, canCorrect, onEdit, onAdd, onExcuse }: RowProps) {
  const cols = punchColumns(day);
  const edit = canCorrect ? onEdit : undefined;
  const open = day.status === 'in_progress';
  const weekend = day.weekday === 0 || day.weekday === 6;
  return (
    <tr
      className={cn(
        'group border-t border-white/[0.04] transition-colors hover:bg-white/[0.02]',
        isToday ? 'bg-brand-500/[0.07]' : weekend && 'bg-white/[0.015]',
      )}
    >
      <td className="py-2.5 pr-3 pl-5 whitespace-nowrap">
        <DateLabel day={day} isToday={isToday} />
      </td>
      <td className="px-3 py-2.5">
        <TimeCell punch={cols.entry} onEdit={edit} />
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
        {cols.breakOut ? (
          <>
            <TimeCell punch={cols.breakOut} onEdit={edit} />
            <span className="mx-1">–</span>
            {cols.breakIn ? <TimeCell punch={cols.breakIn} onEdit={edit} /> : <Now />}
          </>
        ) : (
          <span className="text-slate-600">–</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {cols.exit ? (
          <TimeCell punch={cols.exit} onEdit={edit} />
        ) : open ? (
          <Now />
        ) : (
          <span className="text-slate-600">–</span>
        )}
        {cols.others.length > 0 && (
          <span className="ml-2 inline-flex gap-1.5 text-xs text-slate-400" title="Marcações além da quarta">
            {cols.others.map((p) => (
              <TimeCell key={p.id} punch={p} onEdit={edit} />
            ))}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right font-semibold text-white tabular-nums">
        {day.punches.length ? formatMinutes(day.workedMinutes) : <span className="font-normal text-slate-600">–</span>}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <RowBalance day={day} />
      </td>
      <td className="px-3 py-2.5">
        <DayStatus day={day} />
      </td>
      {canCorrect && (
        <td className="py-2.5 pr-4 pl-2">
          <RowActions day={day} onAdd={onAdd} onExcuse={onExcuse} />
        </td>
      )}
    </tr>
  );
}

/** Linha da folha no celular: horários lado a lado, horas e saldo à direita. */
function SheetItem({ day, isToday, canCorrect, onEdit, onAdd, onExcuse }: RowProps) {
  return (
    <li className={cn('group flex items-start gap-3 px-4 py-3', isToday && 'bg-brand-500/[0.07]')}>
      <span
        className={cn(
          'flex size-10 shrink-0 flex-col items-center justify-center rounded-xl leading-none',
          isToday ? 'bg-brand-500 text-white' : 'bg-ink-800 text-white ring-1 ring-white/[0.08]',
        )}
      >
        <span className="text-sm font-bold">{day.date.slice(8)}</span>
        <span className={cn('mt-0.5 text-[9px] uppercase', isToday ? 'text-brand-100' : 'text-slate-500')}>
          {WEEKDAYS[day.weekday]}
        </span>
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {day.periods.length > 0 && <PeriodPairs day={day} onEdit={canCorrect ? onEdit : undefined} inline />}
        <DayStatus day={day} />
        {canCorrect && (
          <div className="flex">
            <RowActions day={day} onAdd={onAdd} onExcuse={onExcuse} />
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-bold text-white tabular-nums">
          {day.punches.length ? formatMinutes(day.workedMinutes) : <span className="text-slate-600">–</span>}
        </p>
        <p className="text-xs">
          <RowBalance day={day} />
        </p>
      </div>
    </li>
  );
}

/** Tabela do espelho de ponto no formato impresso (Ctrl+P), estilizada no CSS @media print. */
function PrintTable({ days }: { days: TimesheetDay[] }) {
  const time = (p: { localTime: string } | null) => (p ? timeOf(p.localTime) : '–');
  const statusText = (d: TimesheetDay) => {
    if (d.holiday) return `Feriado: ${d.holiday}`;
    if (d.absence) return d.absence.reason;
    if (d.status === 'absent') return 'Falta';
    if (d.status === 'incomplete') return 'Incompleto';
    if (d.status === 'in_progress') return 'Em andamento';
    if (d.status === 'complete' && d.punches.length === 0) return d.scheduled ? '–' : 'Folga';
    return 'Completo';
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
          const c = punchColumns(d);
          const weekend = d.weekday === 0 || d.weekday === 6;
          return (
            <tr key={d.date} className={weekend ? 'weekend' : undefined}>
              <td className="num">{formatDate(d.date, false)}</td>
              <td>{WEEKDAYS[d.weekday]}</td>
              <td className="num">{time(c.entry)}</td>
              <td className="num">{time(c.breakOut)}</td>
              <td className="num">{time(c.breakIn)}</td>
              <td className="num">{time(c.exit)}</td>
              <td className="num">{d.punches.length ? formatMinutes(d.workedMinutes) : '–'}</td>
              <td className="num positive">
                {d.overtimeMinutes ? `${formatSigned(d.overtimeMinutes)} (${d.overtimeRate}%)` : '–'}
              </td>
              <td className="num negative">{d.deficitMinutes ? formatSigned(-d.deficitMinutes) : '–'}</td>
              <td className="num">{d.lateMinutes ? formatMinutes(d.lateMinutes) : '–'}</td>
              <td className="num">{balanceText(d, formatSigned)}</td>
              <td>
                {statusText(d)}
                {d.week &&
                  ` · Semana: ${formatMinutes(d.week.workedMinutes)} de ${formatMinutes(d.week.expectedMinutes)}`}
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
  const balance =
    totals.overtimeMinutes === null && totals.deficitMinutes === null
      ? null
      : (totals.overtimeMinutes ?? 0) - (totals.deficitMinutes ?? 0);
  const row = (label: string, value: string | number) => (
    <>
      <dt>{label}</dt>
      <dd className="num">{value}</dd>
    </>
  );
  return (
    <>
      <div className="print-summary hidden print:block">
        <h2>Resumo do período</h2>
        <dl>
          {row('Horas trabalhadas', formatMinutes(totals.workedMinutes))}
          {row('Horas previstas', formatMinutes(totals.expectedMinutes))}
          {row('Hora extra 50%', totals.overtime50Minutes ? formatSigned(totals.overtime50Minutes) : '0:00')}
          {row('Hora extra 100%', totals.overtime100Minutes ? formatSigned(totals.overtime100Minutes) : '0:00')}
          {row('Horas negativas', totals.deficitMinutes ? formatSigned(-totals.deficitMinutes) : '0:00')}
          {row('Saldo do período', formatSigned(balance))}
          {row('Atrasos', formatMinutes(totals.lateMinutes))}
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
  const balance =
    totals.overtimeMinutes === null && totals.deficitMinutes === null
      ? null
      : (totals.overtimeMinutes ?? 0) - (totals.deficitMinutes ?? 0);
  const matches = (d: TimesheetDay) =>
    filter === 'pending'
      ? d.status === 'incomplete'
      : filter === 'absent'
        ? d.status === 'absent'
        : filter === 'alerts'
          ? d.alerts.length > 0
          : !isOff(d);
  // Ordem da folha de ponto: do primeiro ao último dia, separados por semana
  const weeks = groupByWeek(data.days)
    .map((week) => ({ all: week, visible: week.filter(matches) }))
    .filter((w) => w.visible.length > 0);

  const rowProps = (day: TimesheetDay): RowProps => ({
    day,
    isToday: day.date === todayDate,
    canCorrect,
    onEdit: setEditing,
    onAdd: () => setAdding(day.date),
    onExcuse: () => setExcusing(day.date),
  });

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

      {/* Resumo do mês e gráfico de horas por dia */}
      <Card className="overflow-hidden print:hidden">
        {/* As divisórias são o fundo aparecendo entre os quadros (gap-px), em 2 ou 5 colunas */}
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-5 [&>*]:bg-ink-850 [&>*:last-child]:max-sm:col-span-2">
          <Stat
            label="Trabalhado"
            value={formatMinutes(totals.workedMinutes)}
            hint={totals.expectedMinutes !== null ? `de ${formatMinutes(totals.expectedMinutes)} previstas` : undefined}
          />
          <Stat label="Saldo do mês" value={<Signed minutes={balance} />} />
          <Stat
            label="Hora extra"
            value={<Signed minutes={totals.overtimeMinutes} />}
            hint={
              totals.overtime100Minutes
                ? `${formatMinutes(totals.overtime50Minutes)} a 50% · ${formatMinutes(totals.overtime100Minutes)} a 100%`
                : undefined
            }
          />
          <Stat
            label="Horas negativas"
            value={<Signed minutes={totals.deficitMinutes === null ? null : -totals.deficitMinutes} />}
          />
          <Stat
            label="Atrasos"
            value={<span className={totals.lateMinutes ? 'text-amber-300' : ''}>{formatMinutes(totals.lateMinutes)}</span>}
            hint={totals.absentDays ? `${totals.absentDays} falta${totals.absentDays > 1 ? 's' : ''}` : undefined}
          />
        </div>
        {data.schedule && (
          <div className="border-t border-white/[0.06] px-4 pt-4 pb-3 sm:px-5">
            <p className="mb-3 text-xs font-medium text-slate-400">Horas por dia</p>
            <DailyHoursChart bars={dailyBars(data)} todayDate={todayDate} />
          </div>
        )}
        {bank.data && (
          <Link
            to={`/banco-de-horas${employeeId ? `?funcionario=${employeeId}` : ''}`}
            className="flex items-center gap-2 border-t border-white/[0.06] px-5 py-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.02] hover:text-white"
          >
            <PiggyBank className="size-4 text-slate-500" />
            Banco de horas hoje:
            <Signed minutes={bank.data.totals.balanceMinutes} className="font-semibold" />
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

      {/* Folha de ponto do mês */}
      <div className="print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Folha de ponto</h2>
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
          <Card className="overflow-hidden">
            {/* Computador: tabela */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  <th className="py-3 pr-3 pl-5 font-medium">Data</th>
                  <th className="px-3 py-3 font-medium">Entrada</th>
                  <th className="px-3 py-3 font-medium">Intervalo</th>
                  <th className="px-3 py-3 font-medium">Saída</th>
                  <th className="px-3 py-3 text-right font-medium">Trabalhado</th>
                  <th className="px-3 py-3 text-right font-medium">Saldo</th>
                  <th className="px-3 py-3 font-medium">Situação</th>
                  {canCorrect && <th className="w-24 py-3 pr-4 pl-2" />}
                </tr>
              </thead>
              {weeks.map(({ all, visible }) => (
                <tbody key={all[0].date}>
                  <tr className="border-t border-white/[0.06] bg-white/[0.025]">
                    <td colSpan={canCorrect ? 8 : 7} className="px-5 py-2 text-[11px] font-medium">
                      <div className="flex flex-wrap items-center justify-between gap-x-3">
                        <span className="tracking-wide text-slate-400 uppercase">
                          Semana {weekLabel(all[0].date, all[all.length - 1].date)}
                        </span>
                        <WeekSummary days={all} todayDate={todayDate} />
                      </div>
                    </td>
                  </tr>
                  {visible.map((day) => (
                    <SheetRow key={day.date} {...rowProps(day)} />
                  ))}
                </tbody>
              ))}
              <tfoot>
                <tr className="border-t border-white/10 bg-white/[0.03] text-sm">
                  <td colSpan={4} className="py-3 pr-3 pl-5 font-semibold text-slate-300">
                    Total do mês
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-white tabular-nums">
                    {formatMinutes(totals.workedMinutes)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Signed minutes={balance} className="font-bold" />
                  </td>
                  <td colSpan={canCorrect ? 2 : 1} />
                </tr>
              </tfoot>
            </table>

            {/* Celular: linhas compactas */}
            <div className="md:hidden">
              {weeks.map(({ all, visible }) => (
                <div key={all[0].date}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-white/[0.06] bg-white/[0.025] px-4 py-2 text-[11px] font-medium">
                    <span className="tracking-wide text-slate-400 uppercase">
                      {weekLabel(all[0].date, all[all.length - 1].date)}
                    </span>
                    <WeekSummary days={all} todayDate={todayDate} />
                  </div>
                  <ul className="divide-y divide-white/[0.04]">
                    {visible.map((day) => (
                      <SheetItem key={day.date} {...rowProps(day)} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
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
