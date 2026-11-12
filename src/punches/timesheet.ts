import { addDays, localDate, weekday, zonedInstant } from '@/common/time';

/**
 * Cálculo do espelho de ponto.
 *
 * Regras:
 * - Marcações não têm tipo: em cada jornada, a ordem cronológica alterna entrada/saída
 *   (1ª entrada, 2ª saída, 3ª entrada...). Intervalos são os espaços entre os pares.
 * - Uma nova jornada começa quando, esperando uma entrada, o espaço desde a última saída
 *   é >= MAX_BREAK_MINUTES; ou quando, esperando uma saída, o espaço desde a última
 *   entrada passa de MAX_WORK_PERIOD_MINUTES (a entrada anterior fica sem saída).
 * - A jornada pertence à data local (APP_TIMEZONE) da sua primeira marcação, então
 *   jornadas que atravessam a meia-noite contam inteiras no dia em que começaram.
 * - Jornadas com número ímpar de marcações ficam "incomplete": nenhum horário é
 *   inventado, só os pares completos contam como trabalhados, e extra/falta não é
 *   calculado até que a marcação faltante seja corrigida.
 * - Cada dia usa a jornada vigente naquela data (histórico): mudar a jornada não altera
 *   o cálculo dos dias anteriores.
 * - A jornada tem carga SEMANAL. Cada dia de trabalho prevê a sua parte (carga ÷ dias
 *   de trabalho), mas o saldo dos dias de trabalho fecha por semana (segunda a domingo):
 *   trabalhado nesses dias − previsto da semana, lançado como extra ou falta no último
 *   dia de trabalho da semana, depois que ele passou. Assim sair mais cedo num dia e
 *   mais tarde no outro não gera saldo.
 * - Dia de falta (sem marcação) não entra no previsto da semana: já conta como falta.
 * - Feriado ou abono (atestado, férias, afastamento) num dia de trabalho: tira a parte
 *   do dia do previsto da semana, sem falta; o que for trabalhado nele conta como extra.
 * - Dia que não é de trabalho (ex.: sábado e domingo de escala): tudo é extra, no dia.
 * - Folga de banco (abono COMPENSATION) num dia de trabalho: também não gera falta, mas
 *   consome do banco de horas a parte do dia (compensatedMinutes).
 * - Alertas (CLT) só são avaliados em jornadas completas: intervalo intrajornada
 *   menor que o mínimo (art. 71), mais de 10h num dia de trabalho ou mais de 2h num dia
 *   de folga (art. 59) e menos de 11h de descanso desde a jornada anterior (art. 66).
 */

export const MAX_WORK_PERIOD_MINUTES = 14 * 60;
export const MAX_BREAK_MINUTES = 6 * 60;
export const MAX_DAILY_OVERTIME_MINUTES = 2 * 60;
/** Limite de um dia de trabalho na compensação semanal (CLT art. 59, §2º). */
export const MAX_WORKDAY_MINUTES = 10 * 60;
export const MIN_REST_BETWEEN_SHIFTS_MINUTES = 11 * 60;

export interface PunchInput {
  id: string;
  timestamp: Date;
  /** Só repassado para a tela: não entra no cálculo. */
  locationStatus?: 'INSIDE' | 'OUTSIDE' | 'IMPRECISE' | 'UNAVAILABLE' | null;
  /** Batida feita sem internet (horário do aparelho). */
  offline?: boolean;
}

export interface ScheduleInput {
  startTime: string;
  /** Carga semanal; a parte de cada dia de trabalho é weeklyMinutes / workDays.length. */
  weeklyMinutes: number;
  workDays: number[];
  lateToleranceMinutes: number;
  /** Diferença semanal (extra ou falta) até este limite é ignorada. */
  overtimeToleranceMinutes: number;
}

/** Parte da carga semanal que cabe a um dia de trabalho (sem arredondar). */
export const dailyShare = (schedule: ScheduleInput) =>
  schedule.weeklyMinutes / schedule.workDays.length;

/** Jornada vigente a partir de uma data (null = sem jornada). */
export interface ScheduleSegment {
  from: string;
  schedule: ScheduleInput | null;
}

export interface WorkPeriod {
  start: Date;
  /** null quando a saída não foi marcada. */
  end: Date | null;
  minutes: number;
}

export type OvertimeRate = 50 | 100;

/** Domingo e feriado: 100%. Sábado e dias úteis: 50% (mínimo da CF art. 7º, XVI). */
export function overtimeRateOf(
  date: string,
  holiday: string | null,
): OvertimeRate {
  return holiday || weekday(date) === 0 ? 100 : 50;
}

export type DayStatus = 'complete' | 'incomplete' | 'in_progress' | 'absent';

/**
 * short_break: intervalo menor que 1h (jornada > 6h) ou 15 min (jornada > 4h);
 * overtime_limit: mais de 2h extras; short_rest: menos de 11h desde a jornada anterior.
 */
export type DayAlert = 'short_break' | 'overtime_limit' | 'short_rest';

export type AbsenceType =
  | 'MEDICAL'
  | 'VACATION'
  | 'LEAVE'
  | 'ALLOWANCE'
  | 'COMPENSATION';

export interface DayAbsence {
  type: AbsenceType;
  reason: string;
}

/** Fechamento da semana, no último dia de trabalho dela. */
export interface WeekClose {
  /** Segunda e domingo da semana. */
  from: string;
  to: string;
  /** Previsto da semana: carga menos feriados, abonos e faltas. */
  expectedMinutes: number;
  /** Trabalhado nos dias de trabalho da semana. */
  workedMinutes: number;
  /** Há dia incompleto na semana: o saldo só sai depois da correção. */
  pending: boolean;
}

export interface TimesheetDay {
  date: string;
  weekday: number;
  /** Dia de trabalho pela jornada (falso em feriados e dias abonados). */
  scheduled: boolean;
  /** Nome do feriado, quando a data é feriado. */
  holiday: string | null;
  /** Abono que cobre a data. */
  absence: DayAbsence | null;
  status: DayStatus;
  punches: PunchInput[];
  periods: WorkPeriod[];
  workedMinutes: number;
  breakMinutes: number;
  /** Parte do dia na carga semanal; null quando o funcionário não tem jornada configurada. */
  expectedMinutes: number | null;
  lateMinutes: number | null;
  /**
   * Num dia de trabalho, só o último da semana tem saldo: o da semana inteira (`week`).
   * Nos demais dias de trabalho é 0. Em dia de folga, feriado ou abono, é o trabalhado.
   */
  overtimeMinutes: number | null;
  /** Adicional da hora extra do dia: 100% em domingos e feriados, 50% nos demais. */
  overtimeRate: OvertimeRate;
  deficitMinutes: number | null;
  /** Carga do dia consumida do banco de horas por folga de banco. */
  compensatedMinutes: number;
  /** Presente no dia que fecha a semana. */
  week: WeekClose | null;
  alerts: DayAlert[];
}

export interface TimesheetTotals {
  workedMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  /** Horas extras separadas pelo adicional (somam overtimeMinutes). */
  overtime50Minutes: number | null;
  overtime100Minutes: number | null;
  deficitMinutes: number | null;
  compensatedMinutes: number;
  incompleteDays: number;
  absentDays: number;
  /** Dias de trabalho cobertos por abono, atestado, férias ou afastamento. */
  excusedDays: number;
  /** Dias com pelo menos um alerta. */
  alertDays: number;
}

/** Segunda-feira da semana da data. */
export const weekStart = (date: string) =>
  addDays(date, -((weekday(date) + 6) % 7));

/**
 * Marcações, feriados e abonos devem cobrir desde weekStart(from): o fechamento de uma
 * semana que começou antes do período precisa dos dias anteriores a ele.
 */
export interface BuildTimesheetInput {
  punches: PunchInput[];
  /** Jornada atual: usada quando não há histórico. */
  schedule: ScheduleInput | null;
  /** Histórico em ordem cronológica; cada dia usa o último trecho iniciado até ele. */
  scheduleHistory?: ScheduleSegment[];
  timezone: string;
  /** Período inclusivo, datas locais YYYY-MM-DD. */
  from: string;
  to: string;
  now: Date;
  /** Data local a partir da qual faltas são consideradas (ex: data de cadastro). */
  employeeSince: string;
  /** Feriados por data local (YYYY-MM-DD -> nome). */
  holidays?: Map<string, string>;
  /** Abonos por data local. */
  absences?: Map<string, DayAbsence>;
}

/** Marcações valem com precisão de minuto: os segundos são desconsiderados. */
const minutesBetween = (a: Date, b: Date) =>
  Math.floor(b.getTime() / 60000) - Math.floor(a.getTime() / 60000);

export function groupIntoShifts(punches: PunchInput[]): PunchInput[][] {
  const sorted = [...punches].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const shifts: PunchInput[][] = [];

  for (const punch of sorted) {
    const current = shifts.at(-1);
    if (!current) {
      shifts.push([punch]);
      continue;
    }

    const gap = minutesBetween(current.at(-1)!.timestamp, punch.timestamp);
    const expectingExit = current.length % 2 === 1;
    const sameShift = expectingExit
      ? gap <= MAX_WORK_PERIOD_MINUTES
      : gap < MAX_BREAK_MINUTES;

    if (sameShift) current.push(punch);
    else shifts.push([punch]);
  }

  return shifts;
}

function toPeriods(shift: PunchInput[]): WorkPeriod[] {
  const periods: WorkPeriod[] = [];
  for (let i = 0; i < shift.length; i += 2) {
    const start = shift[i].timestamp;
    const end = shift[i + 1]?.timestamp ?? null;
    periods.push({ start, end, minutes: end ? minutesBetween(start, end) : 0 });
  }
  return periods;
}

/** Atraso em relação ao início previsto mais próximo (cobre chegadas após a meia-noite). */
function rawLateMinutes(
  firstPunch: Date,
  date: string,
  startTime: string,
  tz: string,
): number {
  const expectedStart = [-1, 0, 1]
    .map((offset) => zonedInstant(addDays(date, offset), startTime, tz))
    .reduce((best, candidate) =>
      Math.abs(candidate.getTime() - firstPunch.getTime()) <
      Math.abs(best.getTime() - firstPunch.getTime())
        ? candidate
        : best,
    );
  return Math.max(0, minutesBetween(expectedStart, firstPunch));
}

/** Jornada vigente na data. */
export function scheduleAt(
  input: Pick<BuildTimesheetInput, 'schedule' | 'scheduleHistory'>,
  date: string,
): ScheduleInput | null {
  const history = input.scheduleHistory;
  if (!history?.length) return input.schedule;
  let current = history[0];
  for (const segment of history) {
    if (segment.from > date) break;
    current = segment;
  }
  return current.schedule;
}

function isWorkDay(schedule: ScheduleInput | null, date: string) {
  return !!schedule && schedule.workDays.includes(weekday(date));
}

function dayAlerts(
  day: Pick<
    TimesheetDay,
    'workedMinutes' | 'breakMinutes' | 'overtimeMinutes' | 'scheduled'
  >,
  restBeforeMinutes: number | null,
): DayAlert[] {
  const alerts: DayAlert[] = [];
  const minBreak =
    day.workedMinutes > 6 * 60 ? 60 : day.workedMinutes > 4 * 60 ? 15 : 0;
  if (day.breakMinutes < minBreak) alerts.push('short_break');
  const overLimit = day.scheduled
    ? day.workedMinutes > MAX_WORKDAY_MINUTES
    : (day.overtimeMinutes ?? 0) > MAX_DAILY_OVERTIME_MINUTES;
  if (overLimit) alerts.push('overtime_limit');
  if (
    restBeforeMinutes !== null &&
    restBeforeMinutes < MIN_REST_BETWEEN_SHIFTS_MINUTES
  ) {
    alerts.push('short_rest');
  }
  return alerts;
}

/** Carga consumida do banco quando a data é folga de banco num dia de trabalho. */
function compensatedMinutes(
  schedule: ScheduleInput | null,
  date: string,
  holiday: string | null,
  absence: DayAbsence | null,
) {
  return absence?.type === 'COMPENSATION' &&
    !holiday &&
    isWorkDay(schedule, date)
    ? Math.round(dailyShare(schedule!))
    : 0;
}

function buildDay(
  date: string,
  shifts: PunchInput[][],
  schedule: ScheduleInput | null,
  input: BuildTimesheetInput,
  restBeforeMinutes: number | null,
): TimesheetDay {
  const { timezone, now } = input;
  const holiday = input.holidays?.get(date) ?? null;
  const absence = input.absences?.get(date) ?? null;
  const scheduled = isWorkDay(schedule, date) && !holiday && !absence;
  const expectedMinutes = schedule
    ? scheduled
      ? Math.round(dailyShare(schedule))
      : 0
    : null;

  const punches = shifts.flat();
  const periods = shifts.flatMap(toPeriods);
  const workedMinutes = periods.reduce((sum, p) => sum + p.minutes, 0);

  let breakMinutes = 0;
  for (let i = 0; i + 1 < periods.length; i++) {
    const end = periods[i].end;
    if (end) breakMinutes += minutesBetween(end, periods[i + 1].start);
  }

  const openShifts = shifts.filter((s) => s.length % 2 === 1);
  const lastShift = shifts.at(-1)!;
  const lastIsOpenAndRecent =
    lastShift.length % 2 === 1 &&
    minutesBetween(lastShift.at(-1)!.timestamp, now) <= MAX_WORK_PERIOD_MINUTES;

  let status: DayStatus = 'complete';
  if (openShifts.length === 1 && lastIsOpenAndRecent) status = 'in_progress';
  else if (openShifts.length > 0) status = 'incomplete';

  let lateMinutes: number | null = null;
  if (schedule) {
    const raw = scheduled
      ? rawLateMinutes(punches[0].timestamp, date, schedule.startTime, timezone)
      : 0;
    lateMinutes = raw > schedule.lateToleranceMinutes ? raw : 0;
  }

  // Dia de trabalho: o saldo sai no fechamento da semana. Fora dele, tudo é extra.
  let overtimeMinutes: number | null = null;
  let deficitMinutes: number | null = null;
  if (schedule && status === 'complete') {
    const extra =
      !scheduled && workedMinutes > schedule.overtimeToleranceMinutes;
    overtimeMinutes = extra ? workedMinutes : 0;
    deficitMinutes = 0;
  }

  return {
    date,
    weekday: weekday(date),
    scheduled,
    holiday,
    absence,
    status,
    punches,
    periods,
    workedMinutes,
    breakMinutes,
    expectedMinutes,
    lateMinutes,
    overtimeMinutes,
    overtimeRate: overtimeRateOf(date, holiday),
    deficitMinutes,
    compensatedMinutes: compensatedMinutes(schedule, date, holiday, absence),
    week: null,
    alerts:
      status === 'complete'
        ? dayAlerts(
            { workedMinutes, breakMinutes, overtimeMinutes, scheduled },
            restBeforeMinutes,
          )
        : [],
  };
}

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

/**
 * Lança o saldo de cada semana no último dia de trabalho dela, depois que ele passou.
 * Previsto: a parte de cada dia de trabalho (desde o cadastro) que não é feriado, abono
 * nem falta. Trabalhado: o que foi feito nesses dias.
 */
function closeWeeks(
  days: TimesheetDay[],
  input: BuildTimesheetInput,
  today: string,
) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  if (!first || !last) return;

  for (
    let monday = weekStart(first);
    monday <= last;
    monday = addDays(monday, 7)
  ) {
    let expected = 0;
    let worked = 0;
    let pending = false;
    let close: string | null = null;

    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      const schedule = scheduleAt(input, date);
      if (
        !isWorkDay(schedule, date) ||
        input.holidays?.has(date) ||
        input.absences?.has(date) ||
        date < input.employeeSince
      ) {
        continue;
      }
      close = date;
      const day = byDate.get(date);
      if (day?.status === 'absent') continue;
      expected += dailyShare(schedule!);
      worked += day?.workedMinutes ?? 0;
      if (day?.status === 'incomplete' || day?.status === 'in_progress') {
        pending = true;
      }
    }

    const day = close && close < today ? byDate.get(close) : undefined;
    if (!day) continue;

    const expectedMinutes = Math.round(expected);
    day.week = {
      from: monday,
      to: addDays(monday, 6),
      expectedMinutes,
      workedMinutes: worked,
      pending,
    };
    if (pending) {
      day.overtimeMinutes = null;
      day.deficitMinutes = null;
      continue;
    }
    const balance = worked - expectedMinutes;
    const relevant =
      Math.abs(balance) > scheduleAt(input, close!)!.overtimeToleranceMinutes;
    day.overtimeMinutes = relevant ? Math.max(0, balance) : 0;
    day.deficitMinutes = relevant ? Math.max(0, -balance) : 0;
    day.overtimeRate = 50;
  }
}

export function buildTimesheet(input: BuildTimesheetInput): {
  days: TimesheetDay[];
  totals: TimesheetTotals;
} {
  const { punches, timezone, from, to, now, employeeSince } = input;
  const today = localDate(now, timezone);

  const shiftsByDate = new Map<string, PunchInput[][]>();
  /** Descanso antes da primeira jornada de cada data (só quando a anterior foi fechada). */
  const restBefore = new Map<string, number>();
  let previous: PunchInput[] | undefined;
  for (const shift of groupIntoShifts(punches)) {
    const date = localDate(shift[0].timestamp, timezone);
    if (!shiftsByDate.has(date) && previous && previous.length % 2 === 0) {
      restBefore.set(
        date,
        minutesBetween(previous.at(-1)!.timestamp, shift[0].timestamp),
      );
    }
    shiftsByDate.set(date, [...(shiftsByDate.get(date) ?? []), shift]);
    previous = shift;
  }

  // Calcula desde a segunda da primeira semana: o fechamento dela usa dias anteriores a `from`
  const all: TimesheetDay[] = [];
  for (let date = weekStart(from); date <= to; date = addDays(date, 1)) {
    const shifts = shiftsByDate.get(date);
    if (shifts) {
      all.push(
        buildDay(
          date,
          shifts,
          scheduleAt(input, date),
          input,
          restBefore.get(date) ?? null,
        ),
      );
      continue;
    }

    const schedule = scheduleAt(input, date);

    const holiday = input.holidays?.get(date) ?? null;
    const absence = input.absences?.get(date) ?? null;
    const workDay = isWorkDay(schedule, date);
    if ((holiday || absence) && workDay) {
      all.push({
        date,
        weekday: weekday(date),
        scheduled: false,
        holiday,
        absence,
        status: 'complete',
        punches: [],
        periods: [],
        workedMinutes: 0,
        breakMinutes: 0,
        expectedMinutes: 0,
        lateMinutes: null,
        overtimeMinutes: null,
        overtimeRate: overtimeRateOf(date, holiday),
        deficitMinutes: null,
        compensatedMinutes: compensatedMinutes(
          schedule,
          date,
          holiday,
          absence,
        ),
        week: null,
        alerts: [],
      });
    } else if (workDay && date >= employeeSince && date < today) {
      all.push({
        date,
        weekday: weekday(date),
        scheduled: true,
        holiday: null,
        absence: null,
        status: 'absent',
        punches: [],
        periods: [],
        workedMinutes: 0,
        breakMinutes: 0,
        expectedMinutes: Math.round(dailyShare(schedule!)),
        lateMinutes: null,
        overtimeMinutes: null,
        overtimeRate: overtimeRateOf(date, holiday),
        deficitMinutes: null,
        compensatedMinutes: 0,
        week: null,
        alerts: [],
      });
    }
  }

  closeWeeks(all, input, today);
  const days = all.filter((d) => d.date >= from);

  return {
    days,
    totals: {
      workedMinutes: days.reduce((sum, d) => sum + d.workedMinutes, 0),
      expectedMinutes: sumOrNull(days.map((d) => d.expectedMinutes)),
      lateMinutes: sumOrNull(days.map((d) => d.lateMinutes)),
      overtimeMinutes: sumOrNull(days.map((d) => d.overtimeMinutes)),
      overtime50Minutes: sumOrNull(
        days.map((d) =>
          d.overtimeMinutes === null
            ? null
            : d.overtimeRate === 50
              ? d.overtimeMinutes
              : 0,
        ),
      ),
      overtime100Minutes: sumOrNull(
        days.map((d) =>
          d.overtimeMinutes === null
            ? null
            : d.overtimeRate === 100
              ? d.overtimeMinutes
              : 0,
        ),
      ),
      deficitMinutes: sumOrNull(days.map((d) => d.deficitMinutes)),
      compensatedMinutes: days.reduce(
        (sum, d) => sum + d.compensatedMinutes,
        0,
      ),
      incompleteDays: days.filter((d) => d.status === 'incomplete').length,
      absentDays: days.filter((d) => d.status === 'absent').length,
      excusedDays: days.filter(
        (d) =>
          d.absence &&
          !d.holiday &&
          isWorkDay(scheduleAt(input, d.date), d.date),
      ).length,
      alertDays: days.filter((d) => d.alerts.length > 0).length,
    },
  };
}
