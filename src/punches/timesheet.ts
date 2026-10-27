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
 * - Feriado num dia de trabalho: não há horas previstas nem falta; o que for trabalhado
 *   conta como extra.
 * - Alertas (CLT) só são avaliados em jornadas completas: intervalo intrajornada
 *   menor que o mínimo (art. 71), mais de 2h extras no dia (art. 59) e menos de 11h
 *   de descanso desde a jornada anterior (art. 66).
 */

export const MAX_WORK_PERIOD_MINUTES = 14 * 60;
export const MAX_BREAK_MINUTES = 6 * 60;
export const MAX_DAILY_OVERTIME_MINUTES = 2 * 60;
export const MIN_REST_BETWEEN_SHIFTS_MINUTES = 11 * 60;

export interface PunchInput {
  id: string;
  timestamp: Date;
}

export interface ScheduleInput {
  startTime: string;
  dailyMinutes: number;
  workDays: number[];
  lateToleranceMinutes: number;
  overtimeToleranceMinutes: number;
}

export interface WorkPeriod {
  start: Date;
  /** null quando a saída não foi marcada. */
  end: Date | null;
  minutes: number;
}

export type DayStatus = 'complete' | 'incomplete' | 'in_progress' | 'absent';

/**
 * short_break: intervalo menor que 1h (jornada > 6h) ou 15 min (jornada > 4h);
 * overtime_limit: mais de 2h extras; short_rest: menos de 11h desde a jornada anterior.
 */
export type DayAlert = 'short_break' | 'overtime_limit' | 'short_rest';

export interface TimesheetDay {
  date: string;
  weekday: number;
  /** Dia de trabalho pela jornada (falso em feriados). */
  scheduled: boolean;
  /** Nome do feriado, quando a data é feriado. */
  holiday: string | null;
  status: DayStatus;
  punches: PunchInput[];
  periods: WorkPeriod[];
  workedMinutes: number;
  breakMinutes: number;
  /** null quando o funcionário não tem jornada configurada. */
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
  alerts: DayAlert[];
}

export interface TimesheetTotals {
  workedMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
  incompleteDays: number;
  absentDays: number;
  /** Dias com pelo menos um alerta. */
  alertDays: number;
}

export interface BuildTimesheetInput {
  punches: PunchInput[];
  schedule: ScheduleInput | null;
  timezone: string;
  /** Período inclusivo, datas locais YYYY-MM-DD. */
  from: string;
  to: string;
  now: Date;
  /** Data local a partir da qual faltas são consideradas (ex: data de cadastro). */
  employeeSince: string;
  /** Feriados por data local (YYYY-MM-DD -> nome). */
  holidays?: Map<string, string>;
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

function isWorkDay(schedule: ScheduleInput | null, date: string) {
  return !!schedule && schedule.workDays.includes(weekday(date));
}

function dayAlerts(
  day: Pick<TimesheetDay, 'workedMinutes' | 'breakMinutes' | 'overtimeMinutes'>,
  restBeforeMinutes: number | null,
): DayAlert[] {
  const alerts: DayAlert[] = [];
  const minBreak =
    day.workedMinutes > 6 * 60 ? 60 : day.workedMinutes > 4 * 60 ? 15 : 0;
  if (day.breakMinutes < minBreak) alerts.push('short_break');
  if ((day.overtimeMinutes ?? 0) > MAX_DAILY_OVERTIME_MINUTES) {
    alerts.push('overtime_limit');
  }
  if (
    restBeforeMinutes !== null &&
    restBeforeMinutes < MIN_REST_BETWEEN_SHIFTS_MINUTES
  ) {
    alerts.push('short_rest');
  }
  return alerts;
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
  const scheduled = isWorkDay(schedule, date) && !holiday;
  const expectedMinutes = schedule
    ? scheduled
      ? schedule.dailyMinutes
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

  let overtimeMinutes: number | null = null;
  let deficitMinutes: number | null = null;
  if (schedule && expectedMinutes !== null && status === 'complete') {
    const balance = workedMinutes - expectedMinutes;
    const relevant = Math.abs(balance) > schedule.overtimeToleranceMinutes;
    overtimeMinutes = relevant ? Math.max(0, balance) : 0;
    deficitMinutes = relevant ? Math.max(0, -balance) : 0;
  }

  return {
    date,
    weekday: weekday(date),
    scheduled,
    holiday,
    status,
    punches,
    periods,
    workedMinutes,
    breakMinutes,
    expectedMinutes,
    lateMinutes,
    overtimeMinutes,
    deficitMinutes,
    alerts:
      status === 'complete'
        ? dayAlerts(
            { workedMinutes, breakMinutes, overtimeMinutes },
            restBeforeMinutes,
          )
        : [],
  };
}

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export function buildTimesheet(input: BuildTimesheetInput): {
  days: TimesheetDay[];
  totals: TimesheetTotals;
} {
  const { punches, schedule, timezone, from, to, now, employeeSince } = input;
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

  const days: TimesheetDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const shifts = shiftsByDate.get(date);
    if (shifts) {
      days.push(
        buildDay(date, shifts, schedule, input, restBefore.get(date) ?? null),
      );
      continue;
    }

    const holiday = input.holidays?.get(date) ?? null;
    const workDay = isWorkDay(schedule, date);
    if (holiday && workDay) {
      days.push({
        date,
        weekday: weekday(date),
        scheduled: false,
        holiday,
        status: 'complete',
        punches: [],
        periods: [],
        workedMinutes: 0,
        breakMinutes: 0,
        expectedMinutes: 0,
        lateMinutes: null,
        overtimeMinutes: null,
        deficitMinutes: null,
        alerts: [],
      });
    } else if (workDay && date >= employeeSince && date < today) {
      days.push({
        date,
        weekday: weekday(date),
        scheduled: true,
        holiday: null,
        status: 'absent',
        punches: [],
        periods: [],
        workedMinutes: 0,
        breakMinutes: 0,
        expectedMinutes: schedule!.dailyMinutes,
        lateMinutes: null,
        overtimeMinutes: null,
        deficitMinutes: null,
        alerts: [],
      });
    }
  }

  return {
    days,
    totals: {
      workedMinutes: days.reduce((sum, d) => sum + d.workedMinutes, 0),
      expectedMinutes: sumOrNull(days.map((d) => d.expectedMinutes)),
      lateMinutes: sumOrNull(days.map((d) => d.lateMinutes)),
      overtimeMinutes: sumOrNull(days.map((d) => d.overtimeMinutes)),
      deficitMinutes: sumOrNull(days.map((d) => d.deficitMinutes)),
      incompleteDays: days.filter((d) => d.status === 'incomplete').length,
      absentDays: days.filter((d) => d.status === 'absent').length,
      alertDays: days.filter((d) => d.alerts.length > 0).length,
    },
  };
}
