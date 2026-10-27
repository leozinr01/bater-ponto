import { ScheduleInput, ScheduleSegment } from '@/punches/timesheet';
import { Prisma, ScheduleHistory, WorkSchedule } from '@prisma/client';

/** Data da linha base: vale para todo o passado até a primeira mudança. */
export const HISTORY_BASELINE = '1970-01-01';

type Db = Prisma.TransactionClient;
export type ScheduleValues = Pick<
  WorkSchedule,
  | 'id'
  | 'startTime'
  | 'dailyMinutes'
  | 'workDays'
  | 'lateToleranceMinutes'
  | 'overtimeToleranceMinutes'
> | null;

const snapshot = (schedule: ScheduleValues) => ({
  workScheduleId: schedule?.id ?? null,
  startTime: schedule?.startTime ?? null,
  dailyMinutes: schedule?.dailyMinutes ?? null,
  workDays: schedule?.workDays ?? [],
  lateToleranceMinutes: schedule?.lateToleranceMinutes ?? null,
  overtimeToleranceMinutes: schedule?.overtimeToleranceMinutes ?? null,
});

/** Os campos que entram no cálculo mudaram? (o nome não importa) */
export function scheduleValuesChanged(a: ScheduleValues, b: ScheduleValues) {
  return JSON.stringify(snapshot(a)) !== JSON.stringify(snapshot(b));
}

/**
 * Registra que, a partir de `effectiveFrom`, o funcionário usa `next`. Se ainda não
 * houver histórico, grava antes `previous` como linha base, para os dias anteriores
 * continuarem com a jornada da época. Mais de uma mudança no mesmo dia: vale a última.
 */
export async function recordSchedule(
  db: Db,
  userId: string,
  previous: ScheduleValues,
  next: ScheduleValues,
  effectiveFrom: string,
) {
  if ((await db.scheduleHistory.count({ where: { userId } })) === 0) {
    await db.scheduleHistory.create({
      data: { userId, effectiveFrom: HISTORY_BASELINE, ...snapshot(previous) },
    });
  }
  await db.scheduleHistory.upsert({
    where: { userId_effectiveFrom: { userId, effectiveFrom } },
    create: { userId, effectiveFrom, ...snapshot(next) },
    update: snapshot(next),
  });
}

/** Linha base de um funcionário recém-cadastrado. */
export function baselineRow(userId: string, schedule: ScheduleValues) {
  return { userId, effectiveFrom: HISTORY_BASELINE, ...snapshot(schedule) };
}

function toScheduleInput(row: ScheduleHistory): ScheduleInput | null {
  if (row.startTime === null || row.dailyMinutes === null) return null;
  return {
    startTime: row.startTime,
    dailyMinutes: row.dailyMinutes,
    workDays: row.workDays,
    lateToleranceMinutes: row.lateToleranceMinutes ?? 0,
    overtimeToleranceMinutes: row.overtimeToleranceMinutes ?? 0,
  };
}

/** Histórico por funcionário, em ordem cronológica, no formato do cálculo do espelho. */
export async function loadScheduleHistory(
  db: Db,
  userIds: string[],
): Promise<Map<string, ScheduleSegment[]>> {
  const rows = await db.scheduleHistory.findMany({
    where: { userId: { in: userIds } },
    orderBy: { effectiveFrom: 'asc' },
  });
  const result = new Map<string, ScheduleSegment[]>();
  for (const row of rows) {
    result.set(row.userId, [
      ...(result.get(row.userId) ?? []),
      { from: row.effectiveFrom, schedule: toScheduleInput(row) },
    ]);
  }
  return result;
}
