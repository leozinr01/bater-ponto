import { buildTimesheet, groupIntoShifts, ScheduleInput } from './timesheet';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão

let seq = 0;
/** Marcação a partir de horário local de Brasília. */
const p = (local: string) => ({
  id: String(++seq),
  timestamp: new Date(`${local}:00-03:00`),
});

// 40h semanais de segunda a sexta (8h por dia)
const schedule: ScheduleInput = {
  startTime: '08:00',
  weeklyMinutes: 2400,
  workDays: [1, 2, 3, 4, 5],
  lateToleranceMinutes: 10,
  overtimeToleranceMinutes: 10,
};

// Semana de 2026-10-19 (segunda) a 2026-10-25 (domingo)
const WEEK = {
  mon: '2026-10-19',
  tue: '2026-10-20',
  wed: '2026-10-21',
  thu: '2026-10-22',
  fri: '2026-10-23',
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

/** Um período contínuo no dia, das `start` às `end`. */
const span = (date: string, start: string, end: string) => [
  p(`${date}T${start}`),
  p(`${date}T${end}`),
];

/** Semana inteira (seg a sex) de 8h, com 1h de almoço. */
const fullWeek = () =>
  Object.values(WEEK).flatMap((d) => [
    ...span(d, '08:00', '12:00'),
    ...span(d, '13:00', '17:00'),
  ]);

const week = { from: WEEK.mon, to: WEEK.fri };

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
      week: null,
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
    const night = { ...schedule, startTime: '22:00', weeklyMinutes: 2100 };
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
      expectedMinutes: 420,
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

  describe('carga semanal', () => {
    it('sair mais cedo num dia e mais tarde no outro não gera saldo', () => {
      const { days, totals } = build(
        [
          ...span(WEEK.mon, '08:00', '15:00'), // 7h
          ...span(WEEK.tue, '08:00', '17:00'), // 9h
          ...span(WEEK.wed, '08:00', '12:00'), // 4h
          ...span(WEEK.thu, '08:00', '20:00'), // 12h
          ...span(WEEK.fri, '08:00', '16:00'), // 8h
        ],
        week,
      );
      expect(days.map((d) => d.deficitMinutes)).toEqual([0, 0, 0, 0, 0]);
      expect(days.map((d) => d.overtimeMinutes)).toEqual([0, 0, 0, 0, 0]);
      expect(days.at(-1)!.week).toEqual({
        from: WEEK.mon,
        to: '2026-10-25',
        expectedMinutes: 2400,
        workedMinutes: 2400,
        pending: false,
      });
      expect(totals).toMatchObject({ overtimeMinutes: 0, deficitMinutes: 0 });
    });

    it('20h semanais em 5 dias: cada dia prevê 4h, e o saldo é da semana', () => {
      const partTime = { ...schedule, weeklyMinutes: 1200 };
      const { days } = build(
        [
          ...span(WEEK.mon, '08:00', '12:00'), // 4h
          ...span(WEEK.tue, '08:00', '11:00'), // 3h
          ...span(WEEK.wed, '08:00', '13:00'), // 5h
          ...span(WEEK.thu, '08:00', '12:00'), // 4h
          ...span(WEEK.fri, '08:00', '12:30'), // 4h30
        ],
        { ...week, schedule: partTime },
      );
      expect(days.map((d) => d.expectedMinutes)).toEqual([
        240, 240, 240, 240, 240,
      ]);
      expect(days.at(-1)).toMatchObject({
        overtimeMinutes: 30,
        deficitMinutes: 0,
        overtimeRate: 50,
      });
    });

    it('lança a extra da semana no último dia de trabalho, com 50%', () => {
      const { days, totals } = build(
        [...fullWeek(), ...span(WEEK.mon, '17:00', '19:30')],
        week,
      );
      expect(days[0].overtimeMinutes).toBe(0);
      expect(days.at(-1)).toMatchObject({
        date: WEEK.fri,
        overtimeMinutes: 150,
        deficitMinutes: 0,
        overtimeRate: 50,
      });
      expect(totals).toMatchObject({
        overtimeMinutes: 150,
        overtime50Minutes: 150,
        deficitMinutes: 0,
      });
    });

    it('lança a falta de horas da semana no último dia de trabalho', () => {
      const punches = fullWeek().filter(
        (x) =>
          x.timestamp.getTime() !==
          new Date(`${WEEK.wed}T17:00:00-03:00`).getTime(),
      );
      punches.push(p(`${WEEK.wed}T15:00`));
      const { days } = build(punches, week);
      expect(days.at(-1)).toMatchObject({
        overtimeMinutes: 0,
        deficitMinutes: 120,
      });
    });

    it('ignora diferença da semana dentro da tolerância e respeita a configuração', () => {
      const punches = [...fullWeek(), ...span(WEEK.fri, '17:30', '17:38')];
      expect(build(punches, week).days.at(-1)!.overtimeMinutes).toBe(0);
      expect(
        build(punches, {
          ...week,
          schedule: { ...schedule, overtimeToleranceMinutes: 5 },
        }).days.at(-1)!.overtimeMinutes,
      ).toBe(8);
    });

    it('semana ainda em andamento não tem saldo', () => {
      const { days, totals } = build(
        [
          ...span(WEEK.mon, '08:00', '18:00'),
          ...span(WEEK.tue, '08:00', '18:00'),
        ],
        { ...week, now: new Date(`${WEEK.wed}T09:00:00-03:00`) },
      );
      expect(days.every((d) => d.week === null)).toBe(true);
      expect(totals).toMatchObject({ overtimeMinutes: 0, deficitMinutes: 0 });
    });

    it('dia incompleto deixa a semana pendente até a correção', () => {
      const punches = fullWeek().filter(
        (x) =>
          x.timestamp.getTime() !==
          new Date(`${WEEK.wed}T17:00:00-03:00`).getTime(),
      );
      const { days } = build(punches, week);
      expect(days.at(-1)).toMatchObject({
        overtimeMinutes: null,
        deficitMinutes: null,
      });
      expect(days.at(-1)!.week).toMatchObject({ pending: true });
    });

    it('dia de falta sai do previsto da semana (já conta como falta)', () => {
      const punches = fullWeek().filter(
        (x) => !x.timestamp.toISOString().startsWith('2026-10-22'),
      );
      const { days, totals } = build(punches, week);
      expect(days.find((d) => d.date === WEEK.thu)!.status).toBe('absent');
      expect(days.at(-1)!.week).toMatchObject({
        expectedMinutes: 1920,
        workedMinutes: 1920,
      });
      expect(totals).toMatchObject({ absentDays: 1, deficitMinutes: 0 });
    });

    it('falta no último dia de trabalho ainda fecha a semana nele', () => {
      const punches = fullWeek().filter(
        (x) => !x.timestamp.toISOString().startsWith('2026-10-23'),
      );
      const { days } = build(punches, week);
      expect(days.at(-1)).toMatchObject({
        date: WEEK.fri,
        status: 'absent',
        overtimeMinutes: 0,
        deficitMinutes: 0,
      });
      expect(days.at(-1)!.week).toMatchObject({ expectedMinutes: 1920 });
    });

    it('feriado na semana tira a parte do dia do previsto', () => {
      const punches = fullWeek().filter(
        (x) => !x.timestamp.toISOString().startsWith('2026-10-21'),
      );
      const { days, totals } = build(punches, {
        ...week,
        holidays: new Map([[WEEK.wed, 'Feriado municipal']]),
      });
      expect(days.at(-1)!.week).toMatchObject({ expectedMinutes: 1920 });
      expect(totals).toMatchObject({
        absentDays: 0,
        overtimeMinutes: 0,
        deficitMinutes: 0,
      });
    });

    it('semana que começou antes do período fecha com os dias anteriores a ele', () => {
      const { days } = build(
        [...fullWeek(), ...span(WEEK.mon, '17:00', '18:00')],
        { from: WEEK.wed, to: WEEK.fri },
      );
      expect(days.map((d) => d.date)).toEqual([WEEK.wed, WEEK.thu, WEEK.fri]);
      expect(days.at(-1)).toMatchObject({ overtimeMinutes: 60 });
    });

    it('trabalho em dia de folga é todo hora extra, no próprio dia, sem atraso', () => {
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
        overtimeRate: 100,
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
        ...span(WEEK.mon, '08:00', '17:00'), // 9h
        ...span(WEEK.tue, '08:30', '15:30'), // 7h, 30 de atraso
        ...span(WEEK.wed, '08:00', '16:00'),
        ...span(WEEK.thu, '08:00', '16:00'),
        ...span(WEEK.fri, '08:00', '16:00'),
      ],
      week,
    );
    expect(totals).toEqual({
      workedMinutes: 2400,
      expectedMinutes: 2400,
      lateMinutes: 30,
      overtimeMinutes: 0,
      overtime50Minutes: 0,
      overtime100Minutes: 0,
      deficitMinutes: 0,
      incompleteDays: 0,
      absentDays: 0,
      compensatedMinutes: 0,
      excusedDays: 0,
      alertDays: 5, // todos passam de 6h sem intervalo
    });
  });
});

it('separa o adicional: 100% em domingo e feriado, 50% nos demais dias', () => {
  const { days, totals } = build(
    [
      p('2026-10-24T08:00'), // sábado
      p('2026-10-24T12:00'),
      p('2026-10-25T08:00'), // domingo
      p('2026-10-25T10:00'),
      p('2026-10-28T08:00'), // quarta, feriado
      p('2026-10-28T09:00'),
    ],
    {
      from: '2026-10-24',
      to: '2026-10-28',
      holidays: new Map([['2026-10-28', 'Feriado municipal']]),
    },
  );
  const rate = (date: string) =>
    days.find((d) => d.date === date)?.overtimeRate;
  expect(rate('2026-10-24')).toBe(50);
  expect(rate('2026-10-25')).toBe(100);
  expect(rate('2026-10-28')).toBe(100);
  expect(totals.overtime50Minutes).toBe(240);
  expect(totals.overtime100Minutes).toBe(180);
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

describe('feriados', () => {
  const holidays = new Map([['2026-10-19', 'Feriado municipal']]);

  it('não conta falta num feriado em dia de trabalho', () => {
    const { days, totals } = build([], { holidays });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      holiday: 'Feriado municipal',
      scheduled: false,
      status: 'complete',
      expectedMinutes: 0,
    });
    expect(totals).toMatchObject({ absentDays: 0, expectedMinutes: 0 });
  });

  it('conta como extra todo o tempo trabalhado no feriado, sem atraso', () => {
    const { days } = build([p('2026-10-19T10:00'), p('2026-10-19T14:00')], {
      holidays,
    });
    expect(days[0]).toMatchObject({
      holiday: 'Feriado municipal',
      lateMinutes: 0,
      overtimeMinutes: 240,
      deficitMinutes: 0,
    });
  });

  it('ignora feriado que cai em dia sem trabalho', () => {
    const { days } = build([], {
      holidays: new Map([['2026-10-18', 'Domingo de feriado']]),
      from: '2026-10-18',
      to: '2026-10-18',
    });
    expect(days).toHaveLength(0);
  });
});

describe('alertas da CLT', () => {
  it('alerta intervalo menor que 1h em jornada acima de 6h', () => {
    const { days, totals } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T12:30'),
      p('2026-10-19T17:00'),
    ]);
    expect(days[0].alerts).toEqual(['short_break']);
    expect(totals.alertDays).toBe(1);
  });

  it('alerta jornada acima de 6h sem nenhum intervalo', () => {
    const { days } = build([p('2026-10-19T08:00'), p('2026-10-19T16:00')]);
    expect(days[0].alerts).toContain('short_break');
  });

  it('não alerta jornada normal com 1h de intervalo', () => {
    const { days, totals } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T13:00'),
      p('2026-10-19T17:00'),
    ]);
    expect(days[0].alerts).toEqual([]);
    expect(totals.alertDays).toBe(0);
  });

  it('alerta mais de 10h trabalhadas num dia de trabalho', () => {
    const { days } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T13:00'),
      p('2026-10-19T20:00'),
    ]);
    expect(days[0].workedMinutes).toBe(660);
    expect(days[0].alerts).toEqual(['overtime_limit']);
  });

  it('alerta mais de 2h extras num dia de folga', () => {
    const { days } = build(
      [
        p('2026-10-18T08:00'),
        p('2026-10-18T12:00'),
        p('2026-10-18T13:00'),
        p('2026-10-18T14:00'),
      ],
      { from: '2026-10-18', to: '2026-10-18' },
    );
    expect(days[0].overtimeMinutes).toBe(300);
    expect(days[0].alerts).toEqual(['overtime_limit']);
  });

  it('alerta menos de 11h de descanso desde a jornada anterior', () => {
    const { days } = build(
      [
        p('2026-10-19T14:00'),
        p('2026-10-19T18:00'),
        p('2026-10-19T19:00'),
        p('2026-10-19T23:00'),
        p('2026-10-20T08:00'),
        p('2026-10-20T12:00'),
        p('2026-10-20T13:00'),
        p('2026-10-20T17:00'),
      ],
      { to: '2026-10-20' },
    );
    expect(days[0].alerts).toEqual([]);
    expect(days[1].alerts).toEqual(['short_rest']);
  });

  it('não avalia alertas em dia incompleto', () => {
    const { days } = build([
      p('2026-10-19T08:00'),
      p('2026-10-19T12:00'),
      p('2026-10-19T12:10'),
    ]);
    expect(days[0]).toMatchObject({ status: 'incomplete', alerts: [] });
  });
});

describe('abonos', () => {
  const medical = { type: 'MEDICAL' as const, reason: 'Atestado de 2 dias' };

  it('não conta falta nem horas previstas num dia abonado', () => {
    const absences = new Map([
      ['2026-10-19', medical],
      ['2026-10-20', medical],
    ]);
    const { days, totals } = build([], {
      absences,
      to: '2026-10-21',
    });
    expect(
      days.map((d) => [d.date, d.status, d.absence?.type ?? null]),
    ).toEqual([
      ['2026-10-19', 'complete', 'MEDICAL'],
      ['2026-10-20', 'complete', 'MEDICAL'],
      ['2026-10-21', 'absent', null],
    ]);
    expect(totals).toMatchObject({
      absentDays: 1,
      excusedDays: 2,
      expectedMinutes: 480,
    });
  });

  it('conta como extra o que for trabalhado num dia abonado', () => {
    const { days } = build([p('2026-10-19T08:00'), p('2026-10-19T10:00')], {
      absences: new Map([['2026-10-19', medical]]),
    });
    expect(days[0]).toMatchObject({
      scheduled: false,
      expectedMinutes: 0,
      overtimeMinutes: 120,
      lateMinutes: 0,
    });
  });

  it('não conta como abonado o fim de semana dentro de férias', () => {
    const vacation = { type: 'VACATION' as const, reason: 'Férias' };
    const { days, totals } = build([], {
      absences: new Map([
        ['2026-10-17', vacation],
        ['2026-10-18', vacation],
        ['2026-10-19', vacation],
      ]),
      from: '2026-10-17',
      to: '2026-10-19',
    });
    expect(days.map((d) => d.date)).toEqual(['2026-10-19']);
    expect(totals.excusedDays).toBe(1);
  });
});

describe('histórico de jornada', () => {
  const partTime: ScheduleInput = {
    ...schedule,
    startTime: '13:00',
    weeklyMinutes: 1200,
  };
  const history = [
    { from: '1970-01-01', schedule },
    { from: '2026-10-21', schedule: partTime },
  ];

  it('calcula cada dia com a jornada vigente naquela data', () => {
    const { days } = build(
      [
        ...span(WEEK.tue, '08:00', '12:00'),
        ...span(WEEK.tue, '13:00', '17:00'),
        ...span(WEEK.wed, '13:00', '17:00'),
      ],
      {
        from: WEEK.tue,
        to: WEEK.wed,
        scheduleHistory: history,
        schedule: partTime, // atual
      },
    );
    expect(days[0]).toMatchObject({ expectedMinutes: 480, lateMinutes: 0 });
    // a partir de 21: 4h previstas e entrada às 13:00
    expect(days[1]).toMatchObject({ expectedMinutes: 240, lateMinutes: 0 });
  });

  it('a semana da troca soma a parte de cada dia pela jornada da época', () => {
    const { days } = build(
      [
        ...span(WEEK.mon, '08:00', '16:00'),
        ...span(WEEK.tue, '08:00', '16:00'),
        ...span(WEEK.wed, '13:00', '17:00'),
        ...span(WEEK.thu, '13:00', '17:00'),
        ...span(WEEK.fri, '13:00', '17:00'),
      ],
      { ...week, scheduleHistory: history, schedule: partTime },
    );
    expect(days.at(-1)!.week).toMatchObject({
      expectedMinutes: 2 * 480 + 3 * 240,
      workedMinutes: 2 * 480 + 3 * 240,
    });
    expect(days.at(-1)!.overtimeMinutes).toBe(0);
  });

  it('dia sem jornada no histórico não gera falta', () => {
    const { days, totals } = build([], {
      from: '2026-10-19',
      to: '2026-10-20',
      scheduleHistory: [
        { from: '1970-01-01', schedule: null },
        { from: '2026-10-20', schedule },
      ],
    });
    expect(days.map((d) => [d.date, d.status])).toEqual([
      ['2026-10-20', 'absent'],
    ]);
    expect(totals.absentDays).toBe(1);
  });
});

describe('folga de banco', () => {
  it('não gera falta e consome a parte do dia do banco de horas', () => {
    const { days, totals } = build([], {
      absences: new Map([
        [
          '2026-10-19',
          { type: 'COMPENSATION' as const, reason: 'Folga de banco' },
        ],
      ]),
      holidays: new Map([['2026-10-20', 'Feriado']]),
      to: '2026-10-20',
    });
    expect(days[0]).toMatchObject({
      status: 'complete',
      expectedMinutes: 0,
      compensatedMinutes: 480,
    });
    // feriado não consome banco
    expect(days[1].compensatedMinutes).toBe(0);
    expect(totals).toMatchObject({
      compensatedMinutes: 480,
      absentDays: 0,
      excusedDays: 1,
    });
  });
});
