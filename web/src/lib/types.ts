export type Role = 'EMPLOYEE' | 'ADMIN';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  workScheduleId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface WorkSchedule {
  id: string;
  name: string;
  startTime: string;
  dailyMinutes: number;
  workDays: number[];
  lateToleranceMinutes: number;
  overtimeToleranceMinutes: number;
  createdAt: string;
  updatedAt: string | null;
}

export type WorkScheduleInput = Omit<
  WorkSchedule,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface Punch {
  id: string;
  employeeId: string;
  timestamp: string;
  /** Horário no fuso da empresa, ex: 2026-10-20T08:00:00-03:00 */
  localTime: string;
  source: 'EMPLOYEE' | 'ADMIN';
  reason: string | null;
  createdById: string | null;
  replacesId: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidedById: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface RegisteredPunch extends Punch {
  interpretedAs: 'entrada' | 'saída';
}

export type DayStatus = 'complete' | 'incomplete' | 'in_progress' | 'absent';

/** Alertas da CLT: intervalo curto (art. 71), mais de 2h extras (art. 59), descanso < 11h (art. 66). */
export type DayAlert = 'short_break' | 'overtime_limit' | 'short_rest';

export interface TimesheetDay {
  date: string;
  weekday: number;
  scheduled: boolean;
  holiday: string | null;
  status: DayStatus;
  punches: { id: string; timestamp: string; localTime: string }[];
  periods: { start: string; end: string | null; minutes: number }[];
  workedMinutes: number;
  breakMinutes: number;
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
  alertDays: number;
}

export interface Timesheet {
  employee: { id: string; name: string };
  timezone: string;
  from: string;
  to: string;
  schedule: WorkSchedule | null;
  days: TimesheetDay[];
  totals: TimesheetTotals;
}

export interface ReportItem {
  employee: { id: string; name: string };
  totals: TimesheetTotals;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export type PresenceStatus = 'working' | 'on_break' | 'finished' | 'late' | 'not_started' | 'day_off';

export interface TodayEmployee {
  employee: { id: string; name: string };
  scheduleName: string | null;
  expectedStart: string | null;
  expectedMinutes: number | null;
  status: PresenceStatus;
  firstPunch: string | null;
  lastPunch: string | null;
  /** Início do período em aberto: o tempo corrido soma a workedMinutes. */
  workingSince: string | null;
  workedMinutes: number;
  lateMinutes: number | null;
}

export interface TodayOverview {
  date: string;
  timezone: string;
  now: string;
  holiday: string | null;
  counts: Record<PresenceStatus, number>;
  employees: TodayEmployee[];
}
