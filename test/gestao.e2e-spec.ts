import { authHeader, createTestApp, createUser, TestContext } from './helpers';

/** Instante a partir de horário local de Brasília (UTC-3). */
const br = (local: string) => new Date(`${local}:00-03:00`);

/** Data local de hoje no fuso dos testes. */
const localToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  );

describe('Feriados, abonos, painel do dia e alertas (e2e)', () => {
  let ctx: TestContext;
  let asAdmin: Record<string, string>;
  let admin: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createUser(ctx, { role: 'ADMIN', name: 'Admin' });
    asAdmin = authHeader(ctx, admin);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createSchedule = async (overrides: Record<string, unknown> = {}) => {
    const res = await ctx
      .http()
      .post('/api/work-schedules')
      .set(asAdmin)
      .send({
        name: 'Comercial',
        startTime: '08:00',
        dailyMinutes: 480,
        workDays: [1, 2, 3, 4, 5],
        lateToleranceMinutes: 10,
        overtimeToleranceMinutes: 10,
        ...overrides,
      })
      .expect(201);
    return res.body.id as string;
  };

  /** Funcionário com jornada comercial, cadastrado antes do período dos testes. */
  const createEmployee = async (name: string, scheduleId?: string) => {
    const employee = await createUser(ctx, {
      name,
      workScheduleId: scheduleId ?? (await createSchedule()),
    });
    await ctx.prisma.user.update({
      where: { id: employee.id },
      data: { createdAt: br('2026-09-01T00:00') },
    });
    return employee;
  };

  const timesheet = (employeeId: string, from: string, to: string) =>
    ctx
      .http()
      .get(
        `/api/punches/timesheet?employeeId=${employeeId}&from=${from}&to=${to}`,
      )
      .set(asAdmin)
      .expect(200);

  describe('feriados', () => {
    it('importa os feriados nacionais sem duplicar', async () => {
      const first = await ctx
        .http()
        .post('/api/holidays/national?year=2026')
        .set(asAdmin);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ created: 10, skipped: 0 });

      const again = await ctx
        .http()
        .post('/api/holidays/national?year=2026')
        .set(asAdmin);
      expect(again.body).toEqual({ created: 0, skipped: 10 });

      const list = await ctx
        .http()
        .get('/api/holidays?year=2026')
        .set(asAdmin)
        .expect(200);
      expect(list.body).toHaveLength(10);
      expect(list.body[1]).toMatchObject({
        date: '2026-04-03',
        name: 'Paixão de Cristo',
      });
    });

    it('valida data e recusa feriado repetido', async () => {
      const invalid = await ctx
        .http()
        .post('/api/holidays')
        .set(asAdmin)
        .send({ date: '2026-02-30', name: 'Inexistente' });
      expect(invalid.status).toBe(400);

      const duplicate = await ctx
        .http()
        .post('/api/holidays')
        .set(asAdmin)
        .send({ date: '2026-12-25', name: 'Outro Natal' });
      expect(duplicate.status).toBe(409);
    });

    it('é restrito a administradores', async () => {
      const employee = await createUser(ctx);
      const res = await ctx
        .http()
        .get('/api/holidays?year=2026')
        .set(authHeader(ctx, employee));
      expect(res.status).toBe(403);
    });

    it('feriado em dia de trabalho não gera falta; removido, volta a gerar', async () => {
      const employee = await createEmployee('Feriado');
      const created = await ctx
        .http()
        .post('/api/holidays')
        .set(asAdmin)
        .send({ date: '2026-09-09', name: 'Feriado local' })
        .expect(201);

      // ter 08 sem marcação (falta) e qua 09 feriado
      const sheet = await timesheet(employee.id, '2026-09-08', '2026-09-09');
      const holiday = sheet.body.days.find((d) => d.date === '2026-09-09');
      expect(holiday).toMatchObject({
        holiday: 'Feriado local',
        status: 'complete',
        expectedMinutes: 0,
      });
      expect(sheet.body.totals.absentDays).toBe(1);

      await ctx
        .http()
        .delete(`/api/holidays/${created.body.id}`)
        .set(asAdmin)
        .expect(204);
      const after = await timesheet(employee.id, '2026-09-08', '2026-09-09');
      expect(after.body.totals.absentDays).toBe(2);
    });
  });

  describe('abonos', () => {
    it('lança atestado, recusa sobreposição e cancela sem apagar', async () => {
      const employee = await createEmployee('Atestado');
      const created = await ctx.http().post('/api/absences').set(asAdmin).send({
        employeeId: employee.id,
        type: 'MEDICAL',
        startDate: '2026-10-13',
        endDate: '2026-10-14',
        reason: 'Atestado médico de 2 dias',
      });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        employeeId: employee.id,
        type: 'MEDICAL',
        canceled: false,
        createdById: admin.id,
        createdByName: 'Admin',
      });

      const sheet = await timesheet(employee.id, '2026-10-13', '2026-10-15');
      expect(sheet.body.days.map((d) => [d.date, d.status])).toEqual([
        ['2026-10-13', 'complete'],
        ['2026-10-14', 'complete'],
        ['2026-10-15', 'absent'],
      ]);
      expect(sheet.body.days[0].absence).toEqual({
        type: 'MEDICAL',
        reason: 'Atestado médico de 2 dias',
      });
      expect(sheet.body.totals).toMatchObject({
        excusedDays: 2,
        absentDays: 1,
      });

      const overlap = await ctx.http().post('/api/absences').set(asAdmin).send({
        employeeId: employee.id,
        type: 'VACATION',
        startDate: '2026-10-14',
        endDate: '2026-10-20',
        reason: 'Férias sobrepostas',
      });
      expect(overlap.status).toBe(409);

      const canceled = await ctx
        .http()
        .post(`/api/absences/${created.body.id}/cancel`)
        .set(asAdmin);
      expect(canceled.status).toBe(200);
      expect(canceled.body.canceled).toBe(true);

      const again = await ctx
        .http()
        .post(`/api/absences/${created.body.id}/cancel`)
        .set(asAdmin);
      expect(again.status).toBe(409);

      const after = await timesheet(employee.id, '2026-10-13', '2026-10-15');
      expect(after.body.totals).toMatchObject({
        excusedDays: 0,
        absentDays: 3,
      });

      // O cancelado continua no histórico
      const list = await ctx
        .http()
        .get(
          `/api/absences?employeeId=${employee.id}&from=2026-10-01&to=2026-10-31`,
        )
        .set(asAdmin)
        .expect(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].canceled).toBe(true);
    });

    it('valida o período', async () => {
      const employee = await createEmployee('Período');
      const res = await ctx.http().post('/api/absences').set(asAdmin).send({
        employeeId: employee.id,
        type: 'ALLOWANCE',
        startDate: '2026-10-20',
        endDate: '2026-10-19',
        reason: 'Período invertido',
      });
      expect(res.status).toBe(400);
    });

    it('administrador não lança para si mesmo; funcionário só consulta os próprios', async () => {
      const self = await ctx.http().post('/api/absences').set(asAdmin).send({
        employeeId: admin.id,
        type: 'ALLOWANCE',
        startDate: '2026-10-20',
        endDate: '2026-10-20',
        reason: 'Abono para mim mesmo',
      });
      expect(self.status).toBe(403);

      const employee = await createEmployee('Consulta');
      const other = await createUser(ctx);
      const asEmployee = authHeader(ctx, employee);

      const create = await ctx
        .http()
        .post('/api/absences')
        .set(asEmployee)
        .send({
          employeeId: employee.id,
          type: 'ALLOWANCE',
          startDate: '2026-10-20',
          endDate: '2026-10-20',
          reason: 'Tentativa do próprio funcionário',
        });
      expect(create.status).toBe(403);

      const own = await ctx
        .http()
        .get('/api/absences?from=2026-10-01&to=2026-10-31')
        .set(asEmployee);
      expect(own.status).toBe(200);

      const foreign = await ctx
        .http()
        .get(
          `/api/absences?employeeId=${other.id}&from=2026-10-01&to=2026-10-31`,
        )
        .set(asEmployee);
      expect(foreign.status).toBe(403);
    });
  });

  describe('painel do dia', () => {
    it('mostra a situação de cada funcionário agora', async () => {
      const todayDate = localToday();
      const todayWeekday = new Date(`${todayDate}T12:00:00Z`).getUTCDay();
      const allDays = [0, 1, 2, 3, 4, 5, 6];
      // Se o teste rodar num feriado importado acima, todos estariam de folga
      await ctx.prisma.holiday.deleteMany({ where: { date: todayDate } });

      const working = await createUser(ctx, { name: 'Trabalhando' });
      await ctx.prisma.punchClock.create({
        data: {
          userId: working.id,
          timestamp: new Date(Date.now() - 30 * 60_000),
        },
      });

      // Entrada às 00:00 sem tolerância: já passou do horário e não marcou
      const late = await createEmployee(
        'Atrasado',
        await createSchedule({
          startTime: '00:00',
          lateToleranceMinutes: 0,
          workDays: allDays,
        }),
      );
      const dayOff = await createEmployee(
        'Folga',
        await createSchedule({
          workDays: allDays.filter((d) => d !== todayWeekday),
        }),
      );
      const away = await createEmployee(
        'Férias',
        await createSchedule({ workDays: allDays }),
      );
      await ctx
        .http()
        .post('/api/absences')
        .set(asAdmin)
        .send({
          employeeId: away.id,
          type: 'VACATION',
          startDate: todayDate,
          endDate: todayDate,
          reason: 'Férias de um dia',
        })
        .expect(201);
      const inactive = await createUser(ctx, { name: 'Desligado' });
      await ctx.prisma.user.update({
        where: { id: inactive.id },
        data: { active: false },
      });

      const res = await ctx.http().get('/api/punches/today').set(asAdmin);
      expect(res.status).toBe(200);
      expect(res.body.date).toBe(todayDate);

      const statusOf = (id: string) =>
        res.body.employees.find((e) => e.employee.id === id)?.status;
      expect(statusOf(working.id)).toBe('working');
      expect(statusOf(late.id)).toBe('late');
      expect(statusOf(dayOff.id)).toBe('day_off');
      expect(statusOf(away.id)).toBe('away');
      expect(statusOf(inactive.id)).toBeUndefined();

      const workingItem = res.body.employees.find(
        (e) => e.employee.id === working.id,
      );
      expect(workingItem.workingSince).not.toBeNull();

      const total = Object.values(
        res.body.counts as Record<string, number>,
      ).reduce((a, b) => a + b, 0);
      expect(total).toBe(res.body.employees.length);
    });

    it('é restrito a administradores', async () => {
      const employee = await createUser(ctx);
      const res = await ctx
        .http()
        .get('/api/punches/today')
        .set(authHeader(ctx, employee));
      expect(res.status).toBe(403);
    });
  });

  describe('alertas da CLT', () => {
    it('marca no espelho o intervalo curto e o excesso de horas extras', async () => {
      const employee = await createEmployee('Alertas');
      await ctx.prisma.punchClock.createMany({
        data: [
          // seg: 30 min de almoço
          '2026-10-05T08:00',
          '2026-10-05T12:00',
          '2026-10-05T12:30',
          '2026-10-05T16:30',
          // ter: 3h extras
          '2026-10-06T08:00',
          '2026-10-06T12:00',
          '2026-10-06T13:00',
          '2026-10-06T20:00',
        ].map((local) => ({ userId: employee.id, timestamp: br(local) })),
      });

      const sheet = await timesheet(employee.id, '2026-10-05', '2026-10-06');
      expect(sheet.body.days.map((d) => d.alerts)).toEqual([
        ['short_break'],
        ['overtime_limit'],
      ]);
      expect(sheet.body.totals.alertDays).toBe(2);
    });
  });
});
