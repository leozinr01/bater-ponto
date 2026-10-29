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
  /** null = inclusão do admin ou marcação anterior à geolocalização. */
  location: PunchLocation | null;
}

/** INSIDE = no local; OUTSIDE = fora de todos os locais; UNAVAILABLE = sem localização. */
export type LocationStatus = 'INSIDE' | 'OUTSIDE' | 'UNAVAILABLE';

export interface PunchLocation {
  /** null = nenhum local de trabalho cadastrado na hora da marcação. */
  status: LocationStatus | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  /** Local mais próximo na hora da marcação. */
  workplaceName: string | null;
  distanceMeters: number | null;
}

export interface Workplace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
  updatedAt: string | null;
}

export type WorkplaceInput = Pick<Workplace, 'name' | 'latitude' | 'longitude' | 'radiusMeters'>;

export interface RegisteredPunch extends Punch {
  interpretedAs: 'entrada' | 'saída';
}

export type DayStatus = 'complete' | 'incomplete' | 'in_progress' | 'absent';

/** Alertas da CLT: intervalo curto (art. 71), mais de 2h extras (art. 59), descanso < 11h (art. 66). */
export type DayAlert = 'short_break' | 'overtime_limit' | 'short_rest';

/** MEDICAL = atestado; VACATION = férias; LEAVE = afastamento; ALLOWANCE = abono. */
export type AbsenceType = 'MEDICAL' | 'VACATION' | 'LEAVE' | 'ALLOWANCE' | 'COMPENSATION';

export interface TimesheetDay {
  date: string;
  weekday: number;
  scheduled: boolean;
  holiday: string | null;
  absence: { type: AbsenceType; reason: string } | null;
  status: DayStatus;
  punches: { id: string; timestamp: string; localTime: string; locationStatus: LocationStatus | null }[];
  periods: { start: string; end: string | null; minutes: number }[];
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
  compensatedMinutes: number;
  alerts: DayAlert[];
}

export interface TimesheetTotals {
  workedMinutes: number;
  expectedMinutes: number | null;
  lateMinutes: number | null;
  overtimeMinutes: number | null;
  deficitMinutes: number | null;
  compensatedMinutes: number;
  incompleteDays: number;
  absentDays: number;
  excusedDays: number;
  alertDays: number;
  /** Marcações feitas fora dos locais de trabalho. */
  outsideLocationPunches: number;
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
  /** Saldo do banco de horas acumulado até o fim do período. */
  hourBankMinutes: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  createdAt: string;
}

export type PresenceStatus = 'working' | 'on_break' | 'finished' | 'late' | 'not_started' | 'day_off' | 'away';

export interface TodayEmployee {
  employee: { id: string; name: string };
  scheduleName: string | null;
  expectedStart: string | null;
  expectedMinutes: number | null;
  status: PresenceStatus;
  absenceType: AbsenceType | null;
  firstPunch: string | null;
  lastPunch: string | null;
  /** Início do período em aberto: o tempo corrido soma a workedMinutes. */
  workingSince: string | null;
  workedMinutes: number;
  lateMinutes: number | null;
  /** Marcações de hoje fora dos locais de trabalho. */
  outsideLocationPunches: number;
  /** Marcações de hoje sem localização. */
  noLocationPunches: number;
}

export interface TodayOverview {
  date: string;
  timezone: string;
  now: string;
  holiday: string | null;
  counts: Record<PresenceStatus, number>;
  employees: TodayEmployee[];
}

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  reason: string;
  createdAt: string;
  createdById: string;
  createdByName: string | null;
  canceled: boolean;
  canceledAt: string | null;
  canceledById: string | null;
}

export interface HourBankMovement {
  overtimeMinutes: number;
  deficitMinutes: number;
  compensatedMinutes: number;
  adjustmentMinutes: number;
  balanceMinutes: number;
}

export interface HourBankEntry {
  id: string;
  employeeId: string;
  date: string;
  minutes: number;
  reason: string;
  createdAt: string;
  createdById: string;
  createdByName: string | null;
  canceled: boolean;
  canceledAt: string | null;
}

export interface HourBank {
  employee: { id: string; name: string };
  since: string;
  until: string;
  totals: HourBankMovement;
  pendingDays: number;
  months: (HourBankMovement & { month: string; accumulatedMinutes: number; pendingDays: number })[];
  entries: HourBankEntry[];
}
