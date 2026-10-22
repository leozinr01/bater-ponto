import { buildTimesheet, groupIntoShifts, ScheduleInput } from './timesheet';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão

let seq = 0;
/** Marcação a partir de horário local de Brasília. */
const p = (local: string) => ({
  id: String(++seq),
  timestamp: new Date(`${local}:00-03:00`),
});

const schedule: ScheduleInput = {
  startTime: '08:00',
  dailyMinutes: 480,
  workDays: [1, 2, 3, 4, 5],
  lateToleranceMinutes: 10,
  overtimeToleranceMinutes: 10,
};

const build = (
  punches: ReturnType<typeof p>[],
  opts: Partial<Parameters<typeof buildTimesheet>[0]> = {},
) =>
  buildTimesheet({
    punches,
    schedule,
    timezone: TZ,
    from: '2026-10-19',
    to: '2026-10-19',
    now: new Date('2026-10-30T12:00:00-03:00'),
    employeeSince: '2026-01-01',
    ...opts,
  });

describe('buildTimesheet', () => {
  it('soma todos os pares de marcações do dia, não só a primeira entrada e a última saída', () => {
    const { days } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T13:00'),
      p('2026-10-19T15:00'),
      p('2026-10-19T15:30'),
      p('2026-10-19T17:30'),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: '2026-10-19',
      status: 'complete',
      workedMinutes: 8 * 60,
      breakMinutes: 90,
      expectedMinutes: 480,
      lateMinutes: 0,
      overtimeMinutes: 0,
      deficitMinutes: 0,
    });
    expect(days[0].periods).toHaveLength(3);
  });

  it('ordena marcações fora de ordem antes de calcular', () => {
    const { days } = build([
      p('2026-10-19T17:00'),
      p('2026-10-19T08:00'),
      p('2026-10-19T13:00'),
      p('2026-10-19T12:00'),
    ]);
    expect(days[0].workedMinutes).toBe(8 * 60);
  });

  it('conta a jornada que atravessa a meia-noite inteira no dia em que começou', () => {
    const night = { ...schedule, startTime: '22:00', dailyMinutes: 420 };
    const { days, totals } = build(
      [
        p('2026-10-19T22:00'),
        p('2026-10-20T02:00'),
        p('2026-10-20T03:00'),
        p('2026-10-20T06:00'),
      ],
      { schedule: night, from: '2026-10-19', to: '2026-10-20' },
    );

    const monday = days.find((d) => d.date === '2026-10-19')!;
    expect(monday).toMatchObject({
      status: 'complete',
      workedMinutes: 7 * 60,
      breakMinutes: 60,
      lateMinutes: 0,
      overtimeMinutes: 0,
    });
    // terça não teve início de jornada: é falta, sem horas atribuídas
    const tuesday = days.find((d) => d.date === '2026-10-20')!;
    expect(tuesday.status).toBe('absent');
    expect(totals.workedMinutes).toBe(7 * 60);
  });

  it('usa o fuso configurado para definir o dia (23:30 em Brasília = dia seguinte em UTC)', () => {
    const { days } = build([p('2026-10-19T19:00'), p('2026-10-19T23:30')], {
      schedule: null,
    });
    expect(days[0].date).toBe('2026-10-19');
    expect(days[0].workedMinutes).toBe(270);
  });

  it('não inventa a saída faltante: dia incompleto sem extra/falta', () => {
    const { days, totals } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T13:00'),
    ]);

    expect(days[0]).toMatchObject({
      status: 'incomplete',
      workedMinutes: 240,
      overtimeMinutes: null,
      deficitMinutes: null,
    });
    expect(days[0].periods.at(-1)).toMatchObject({ end: null, minutes: 0 });
    expect(totals.incompleteDays).toBe(1);
  });

  it('esquecer a saída não faz a entrada do dia seguinte virar saída', () => {
    const { days } = build(
      [
        p('2026-10-19T08:00'),
        p('2026-10-19T12:00'),
        p('2026-10-19T13:00'),
        p('2026-10-20T08:00'),
        p('2026-10-20T17:00'),
      ],
      { from: '2026-10-19', to: '2026-10-20' },
    );

    expect(days[0]).toMatchObject({ date: '2026-10-19', status: 'incomplete' });
    expect(days[1]).toMatchObject({
      date: '2026-10-20',
      status: 'complete',
      workedMinutes: 540,
      overtimeMinutes: 60,
    });
  });

  it('marca como em andamento a jornada aberta de hoje', () => {
    const { days, totals } = build([p('2026-10-19T08:00')], {
      now: new Date('2026-10-19T10:00:00-03:00'),
    });
    expect(days[0].status).toBe('in_progress');
    expect(totals.incompleteDays).toBe(0);
  });

  describe('atraso', () => {
    it('ignora atraso dentro da tolerância', () => {
      const { days } = build([p('2026-10-19T08:10'), p('2026-10-19T17:10')]);
      expect(days[0].lateMinutes).toBe(0);
    });

    it('computa o atraso inteiro quando passa da tolerância', () => {
      const { days } = build([p('2026-10-19T08:25'), p('2026-10-19T16:25')]);
      expect(days[0].lateMinutes).toBe(25);
    });

    it('respeita a tolerância configurada', () => {
      const { days } = build([p('2026-10-19T08:25'), p('2026-10-19T16:25')], {
        schedule: { ...schedule, lateToleranceMinutes: 30 },
      });
      expect(days[0].lateMinutes).toBe(0);
    });

    it('chegada após a meia-noite numa jornada noturna conta como atraso', () => {
      const night = {
        ...schedule,
        startTime: '23:30',
        workDays: [0, 1, 2, 3, 4, 5, 6],
      };
      const { days } = build([p('2026-10-20T00:10'), p('2026-10-20T07:00')], {
        schedule: night,
        from: '2026-10-20',
        to: '2026-10-20',
      });
      expect(days[0].lateMinutes).toBe(40);
    });
  });

  describe('horas extras e faltas', () => {
    it('calcula horas extras acima da jornada', () => {
      const { days } = build([
        p('2026-10-19T08:00'),
        p('2026-10-19T12:00'),
        p('2026-10-19T13:00'),
        p('2026-10-19T19:30'),
      ]);
      expect(days[0]).toMatchObject({
        overtimeMinutes: 150,
        deficitMinutes: 0,
      });
    });

    it('calcula horas faltantes abaixo da jornada', () => {
      const { days } = build([p('2026-10-19T08:00'), p('2026-10-19T14:00')]);
      expect(days[0]).toMatchObject({
        overtimeMinutes: 0,
        deficitMinutes: 120,
      });
    });

    it('ignora diferenças dentro da tolerância e respeita a configuração', () => {
      const punches = [p('2026-10-19T08:00'), p('2026-10-19T16:08')];
      expect(build(punches).days[0].overtimeMinutes).toBe(0);
      expect(
        build(punches, {
          schedule: { ...schedule, overtimeToleranceMinutes: 5 },
        }).days[0].overtimeMinutes,
      ).toBe(8);
    });

    it('a jornada diária configurada muda o resultado', () => {
      const punches = [p('2026-10-19T08:00'), p('2026-10-19T16:00')];
      const sixHours = { ...schedule, dailyMinutes: 360 };
      expect(
        build(punches, { schedule: sixHours }).days[0].overtimeMinutes,
      ).toBe(120);
    });

    it('trabalho em dia de folga é todo hora extra, sem atraso', () => {
      // 2026-10-18 é domingo
      const { days } = build([p('2026-10-18T10:00'), p('2026-10-18T14:00')], {
        from: '2026-10-18',
        to: '2026-10-18',
      });
      expect(days[0]).toMatchObject({
        scheduled: false,
        expectedMinutes: 0,
        lateMinutes: 0,
        overtimeMinutes: 240,
      });
    });

    it('sem jornada configurada não calcula extra, falta nem atraso', () => {
      const { days, totals } = build(
        [p('2026-10-19T08:00'), p('2026-10-19T20:00')],
        { schedule: null },
      );
      expect(days[0]).toMatchObject({
        workedMinutes: 720,
        expectedMinutes: null,
        lateMinutes: null,
        overtimeMinutes: null,
      });
      expect(totals.overtimeMinutes).toBeNull();
    });
  });

  describe('faltas', () => {
    it('lista dias úteis passados sem marcação como falta, sem contar folgas e o dia atual', () => {
      const { days, totals } = build([], {
        from: '2026-10-17', // sábado
        to: '2026-10-21', // quarta (hoje)
        now: new Date('2026-10-21T09:00:00-03:00'),
      });
      expect(days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20']);
      expect(totals.absentDays).toBe(2);
    });

    it('não conta faltas antes do cadastro do funcionário', () => {
      const { totals } = build([], {
        from: '2026-10-19',
        to: '2026-10-23',
        employeeSince: '2026-10-22',
      });
      expect(totals.absentDays).toBe(2);
    });
  });

  it('totaliza o período', () => {
    const { totals } = build(
      [
        p('2026-10-19T08:00'),
        p('2026-10-19T17:00'), // 9h → 60 extra
        p('2026-10-20T08:30'),
        p('2026-10-20T15:30'), // 7h, 30 de atraso, 60 de falta
      ],
      { from: '2026-10-19', to: '2026-10-20' },
    );
    expect(totals).toEqual({
      workedMinutes: 16 * 60,
      expectedMinutes: 960,
      lateMinutes: 30,
      overtimeMinutes: 60,
      deficitMinutes: 60,
      incompleteDays: 0,
      absentDays: 0,
    });
  });
});

it('considera as marcações com precisão de minuto (ignora segundos)', () => {
  const { days } = build([
    { id: 'a', timestamp: new Date('2026-10-19T08:10:59-03:00') },
    { id: 'b', timestamp: new Date('2026-10-19T17:10:01-03:00') },
  ]);
  expect(days[0]).toMatchObject({ workedMinutes: 540, lateMinutes: 0 });
});

describe('groupIntoShifts', () => {
  it('separa jornadas quando o intervalo é longo demais para ser pausa', () => {
    const shifts = groupIntoShifts([
      p('2026-10-19T08:00'),
      p('2026-10-19T17:00'),
      p('2026-10-20T08:00'),
      p('2026-10-20T17:00'),
    ]);
    expect(shifts.map((s) => s.length)).toEqual([2, 2]);
  });

  it('aceita um período contínuo longo (ex.: 10h sem pausa) como uma jornada', () => {
    const shifts = groupIntoShifts([
      p('2026-10-19T08:00'),
      p('2026-10-19T18:00'),
    ]);
    expect(shifts).toHaveLength(1);
  });
});
