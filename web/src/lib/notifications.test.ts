import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminNotifications, ownNotifications } from './notifications';
import type { Timesheet, TimesheetDay, TodayOverview } from './types';

// Terça, 10/11/2026, 08:30 em Brasília
const NOW = new Date('2026-11-10T08:30:00-03:00');

const schedule = {
  id: 's1',
  name: 'Comercial',
  startTime: '08:00',
  weeklyMinutes: 2400,
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
  week: null,
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

// Os testes de cada regra ignoram as confirmações de batida (informativas), testadas à parte
const ids = (list: { id: string; quiet?: boolean }[]) => list.filter((n) => !n.quiet).map((n) => n.id);

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
    // Id por dia: guardar mais uma batida offline não faz o aviso já lido voltar como novo
    expect(ids(ownNotifications(sheet([]), NOW, 1))).toEqual(['offline-2026-11-10']);
    expect(ids(ownNotifications(sheet([]), NOW, 2))).toEqual(['offline-2026-11-10']);
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

describe('confirmação de batida', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const punch = (id: string, localTime: string, offline = false) => ({
    id,
    timestamp: localTime,
    localTime,
    locationStatus: null,
    offline,
  });

  it('avisa cada entrada e saída de hoje e de ontem, sem som nem alerta de entrada', () => {
    const list = ownNotifications(
      sheet([
        day({ date: '2026-11-08', punches: [punch('velha', '2026-11-08T08:00:00-03:00')] }),
        day({
          date: '2026-11-09',
          punches: [punch('e1', '2026-11-09T08:00:00-03:00'), punch('s1', '2026-11-09T17:00:00-03:00')],
        }),
        day({ date: '2026-11-10', punches: [punch('e2', '2026-11-10T08:02:00-03:00', true)] }),
      ]),
      NOW,
      0,
    ).filter((n) => n.id.startsWith('batida-'));

    // Mais recente primeiro; a de anteontem não entra
    expect(list.map((n) => [n.id, n.title])).toEqual([
      ['batida-e2', 'Entrada registrada'],
      ['batida-s1', 'Saída registrada'],
      ['batida-e1', 'Entrada registrada'],
    ]);
    expect(list.every((n) => n.quiet)).toBe(true);
    expect(list[0].text).toBe(
      'Sua batida de entrada das 08:02 de 10/11 foi registrada (feita sem internet, com o horário do celular).',
    );
  });
});

describe('adminNotifications', () => {
  it('um aviso por pessoa atrasada ou com batida fora do local, com id estável', () => {
    const overview = {
      date: '2026-11-10',
      employees: [
        {
          employee: { id: 'a', name: 'Ana Souza' },
          status: 'late',
          expectedStart: '08:00',
          outsideLocationPunches: 0,
          outsideLocationTimes: [],
        },
        {
          employee: { id: 'b', name: 'Bruno Lima' },
          status: 'working',
          expectedStart: '08:00',
          outsideLocationPunches: 2,
          outsideLocationTimes: ['08:02', '12:01'],
        },
        {
          employee: { id: 'c', name: 'Carla' },
          status: 'working',
          expectedStart: '08:00',
          outsideLocationPunches: 0,
          outsideLocationTimes: [],
        },
      ],
    } as unknown as TodayOverview;
    const list = adminNotifications(overview);
    expect(list.map((n) => [n.id, n.title])).toEqual([
      ['atraso-2026-11-10-a', 'Ana está atrasado(a)'],
      ['fora-2026-11-10-b-2', 'Batida fora do local: Bruno'],
    ]);
    expect(list[1].text).toContain('às 08:02, 12:01');

    // Outra pessoa se atrasando não muda o aviso da Ana: o que ela já leu continua lido
    const later = adminNotifications({
      ...overview,
      employees: overview.employees.map((e) => (e.employee.id === 'c' ? { ...e, status: 'late' } : e)),
    } as TodayOverview);
    expect(later.map((n) => n.id)).toContain('atraso-2026-11-10-a');
    expect(later.map((n) => n.id)).toContain('atraso-2026-11-10-c');
  });

  it('avisa cada batida offline, que tem o horário informado pelo celular', () => {
    const overview = {
      date: '2026-11-10',
      employees: [],
      offlinePunches: [
        {
          id: 'p1',
          employee: { id: 'a', name: 'Ana Souza' },
          localTime: '2026-11-10T08:00:00-03:00',
          receivedAt: '2026-11-10T10:05:00-03:00',
        },
      ],
    } as unknown as TodayOverview;
    const [notice] = adminNotifications(overview);
    expect(notice).toMatchObject({
      id: 'batida-offline-p1',
      title: 'Batida offline de Ana',
      to: '/registros?funcionario=a&mes=2026-11',
    });
    expect(notice.text).toContain('às 08:00 (recebida às 10:05)');
  });
});
