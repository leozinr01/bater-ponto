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

export interface TimesheetDay {
  date: string;
  weekday: number;
  scheduled: boolean;
  status: DayStatus;
  punches: { id: string; timestamp: string; localTime: string }[];
  periods: { start: string; end: string | null; minutes: number }[];
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
}

export interface TimesheetTotals {
  workedMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
  incompleteDays: number;
  absentDays: number;
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
