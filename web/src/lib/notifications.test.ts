import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminNotifications, ownNotifications } from './notifications';
import type { Timesheet, TimesheetDay, TodayOverview } from './types';

// Terça, 10/11/2026, 08:30 em Brasília
const NOW = new Date('2026-11-10T08:30:00-03:00');

const schedule = {
  id: 's1',
  name: 'Comercial',
  startTime: '08:00',
  dailyMinutes: 480,
  workDays: [1, 2, 3, 4, 5],
  lateToleranceMinutes: 10,
  overtimeToleranceMinutes: 10,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: null,
};

const day = (values: Partial<TimesheetDay> & { date: string }): TimesheetDay => ({
  weekday: new Date(`${values.date}T12:00:00Z`).getUTCDay(),
  scheduled: true,
  holiday: null,
  absence: null,
  status: 'complete',
  punches: [],
  periods: [],
  workedMinutes: 0,
  breakMinutes: 0,
  expectedMinutes: 480,
  lateMinutes: 0,
  overtimeMinutes: 0,
  overtimeRate: 50,
  deficitMinutes: 0,
  compensatedMinutes: 0,
  alerts: [],
  ...values,
});

const sheet = (days: TimesheetDay[]): Timesheet =>
  ({
    employee: { id: 'u1', name: 'Ana' },
    timezone: 'America/Sao_Paulo',
    from: '2026-11-01',
    to: '2026-11-10',
    schedule,
    days,
    totals: {} as Timesheet['totals'],
  }) as Timesheet;

const ids = (list: { id: string }[]) => list.map((n) => n.id);

describe('ownNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('avisa a entrada depois do horário, enquanto não bateu', () => {
    expect(ids(ownNotifications(sheet([]), NOW, 0))).toEqual(['entrada-2026-11-10']);
    // Antes do horário, nada
    expect(ownNotifications(sheet([]), new Date('2026-11-10T07:59:00-03:00'), 0)).toEqual([]);
    // Já bateu
    const punched = day({
      date: '2026-11-10',
      status: 'in_progress',
      punches: [{ id: 'p', timestamp: '', localTime: '2026-11-10T08:05:00-03:00', locationStatus: null, offline: false }],
      periods: [{ start: '2026-11-10T08:05:00-03:00', end: null, minutes: 0 }],
    });
    expect(ids(ownNotifications(sheet([punched]), NOW, 0))).not.toContain('entrada-2026-11-10');
  });

  it('não avisa a entrada em feriado nem com batida guardada offline', () => {
    const holiday = day({ date: '2026-11-10', holiday: 'Feriado', scheduled: false });
    expect(ownNotifications(sheet([holiday]), NOW, 0)).toEqual([]);
    expect(ids(ownNotifications(sheet([]), NOW, 1))).toEqual(['offline-1']);
  });

  it('avisa a saída quando a carga do dia foi cumprida', () => {
    const working = day({
      date: '2026-11-10',
      status: 'in_progress',
      workedMinutes: 240,
      punches: [{ id: 'p', timestamp: '', localTime: '', locationStatus: null, offline: false }],
      periods: [{ start: '2026-11-10T13:00:00-03:00', end: null, minutes: 0 }],
    });
    expect(ids(ownNotifications(sheet([working]), new Date('2026-11-10T16:59:00-03:00'), 0))).toEqual([]);
    expect(ids(ownNotifications(sheet([working]), new Date('2026-11-10T17:00:00-03:00'), 0))).toEqual([
      'saida-2026-11-10',
    ]);
  });

  it('lista dias incompletos e faltas recentes (faltas de mais de 7 dias ficam de fora)', () => {
    const list = ownNotifications(
      sheet([
        day({ date: '2026-11-02', status: 'absent' }),
        day({ date: '2026-11-05', status: 'incomplete' }),
        day({ date: '2026-11-06', status: 'absent' }),
        day({ date: '2026-11-10', status: 'in_progress', punches: [{ id: 'p', timestamp: '', localTime: '', locationStatus: null, offline: false }] }),
      ]),
      NOW,
      0,
    );
    expect(ids(list)).toEqual(['falta-2026-11-06', 'incompleto-2026-11-05']);
  });
});

describe('adminNotifications', () => {
  it('conta atrasados e batidas fora do local', () => {
    const overview = {
      date: '2026-11-10',
      employees: [
        { employee: { id: 'a', name: 'Ana Souza' }, status: 'late', outsideLocationPunches: 0 },
        { employee: { id: 'b', name: 'Bruno Lima' }, status: 'working', outsideLocationPunches: 2 },
        { employee: { id: 'c', name: 'Carla' }, status: 'working', outsideLocationPunches: 0 },
      ],
    } as unknown as TodayOverview;
    const list = adminNotifications(overview);
    expect(list.map((n) => n.title)).toEqual(['1 funcionário atrasado', '2 batidas fora do local']);
    expect(list[0].text).toBe('Ana');
  });
});
