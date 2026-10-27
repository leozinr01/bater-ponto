import { authHeader, createTestApp, createUser, TestContext } from './helpers';

/** Instante a partir de horário local de Brasília (UTC-3). */
const br = (local: string) => new Date(`${local}:00-03:00`);

describe('Ponto (e2e)', () => {
  let ctx: TestContext;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let asAdmin: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createUser(ctx, { role: 'ADMIN', name: 'Admin' });
    asAdmin = authHeader(ctx, admin);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const seedPunches = (userId: string, locals: string[]) =>
    ctx.prisma.punchClock.createMany({
      data: locals.map((local) => ({ userId, timestamp: br(local) })),
    });

  describe('registro', () => {
    it('registra com o horário do servidor e recusa clique duplicado', async () => {
      const employee = await createUser(ctx);
      const headers = authHeader(ctx, employee);

      const before = Date.now();
      const first = await ctx.http().post('/api/punches').set(headers).send();
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        employeeId: employee.id,
        source: 'EMPLOYEE',
        voided: false,
        interpretedAs: 'entrada',
      });
      expect(new Date(first.body.timestamp).getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(first.body.localTime).toMatch(/-03:00$/);

      const duplicate = await ctx
        .http()
        .post('/api/punches')
        .set(headers)
        .send();
      expect(duplicate.status).toBe(409);
    });

    it('ignora horário enviado pelo cliente', async () => {
      const employee = await createUser(ctx);
      const res = await ctx
        .http()
        .post('/api/punches')
        .set(authHeader(ctx, employee))
        .send({ timestamp: '2020-01-01T08:00:00Z' });
      expect(res.status).toBe(201);
      expect(
        Math.abs(new Date(res.body.timestamp).getTime() - Date.now()),
      ).toBeLessThan(10_000);
    });

    it('cliques simultâneos geram uma única marcação', async () => {
      const employee = await createUser(ctx);
      const headers = authHeader(ctx, employee);

      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          ctx.http().post('/api/punches').set(headers).send(),
        ),
      );

      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      expect(
        await ctx.prisma.punchClock.count({ where: { userId: employee.id } }),
      ).toBe(1);
    });

    it('interpreta a marcação seguinte à entrada como saída', async () => {
      const employee = await createUser(ctx);
      await ctx.prisma.punchClock.create({
        data: {
          userId: employee.id,
          timestamp: new Date(Date.now() - 2 * 3600_000),
        },
      });
      const res = await ctx
        .http()
        .post('/api/punches')
        .set(authHeader(ctx, employee))
        .send();
      expect(res.body.interpretedAs).toBe('saída');
    });
  });

  describe('consulta e permissões', () => {
    let employee: Awaited<ReturnType<typeof createUser>>;
    let other: Awaited<ReturnType<typeof createUser>>;

    beforeAll(async () => {
      employee = await createUser(ctx, { name: 'Consulta' });
      other = await createUser(ctx, { name: 'Outro' });
      await seedPunches(employee.id, [
        '2026-10-05T08:00',
        '2026-10-05T12:00',
        '2026-10-05T13:00',
        '2026-10-05T17:00',
        '2026-10-06T08:00',
        '2026-10-06T12:00',
        '2026-10-06T13:00',
        '2026-10-06T23:30',
        '2026-10-07T08:00',
        '2026-10-07T17:00',
      ]);
      await seedPunches(other.id, ['2026-10-06T09:00', '2026-10-06T18:00']);
    });

    it('funcionário vê só o próprio histórico', async () => {
      const headers = authHeader(ctx, employee);

      const own = await ctx.http().get('/api/punches').set(headers);
      expect(own.status).toBe(200);
      expect(own.body.meta.total).toBe(10);
      expect(own.body.data.every((p) => p.employeeId === employee.id)).toBe(
        true,
      );

      const explicitSelf = await ctx
        .http()
        .get(`/api/punches?employeeId=${employee.id}`)
        .set(headers);
      expect(explicitSelf.status).toBe(200);

      const others = await ctx
        .http()
        .get(`/api/punches?employeeId=${other.id}`)
        .set(headers);
      expect(others.status).toBe(403);

      const othersSheet = await ctx
        .http()
        .get(
          `/api/punches/timesheet?employeeId=${other.id}&from=2026-10-01&to=2026-10-31`,
        )
        .set(headers);
      expect(othersSheet.status).toBe(403);
    });

    it('admin filtra por funcionário e período (dia no fuso local) com paginação', async () => {
      const day = await ctx
        .http()
        .get(
          `/api/punches?employeeId=${employee.id}&from=2026-10-06&to=2026-10-06&pageSize=3`,
        )
        .set(asAdmin);
      expect(day.status).toBe(200);
      // 23:30 de Brasília já é dia 07 em UTC, mas pertence ao dia 06
      expect(day.body.meta).toEqual({
        page: 1,
        pageSize: 3,
        total: 4,
        totalPages: 2,
      });
      expect(day.body.data.map((p) => p.localTime)).toEqual([
        '2026-10-06T23:30:00-03:00',
        '2026-10-06T13:00:00-03:00',
        '2026-10-06T12:00:00-03:00',
      ]);

      const page2 = await ctx
        .http()
        .get(
          `/api/punches?employeeId=${employee.id}&from=2026-10-06&to=2026-10-06&pageSize=3&page=2`,
        )
        .set(asAdmin);
      expect(page2.body.data.map((p) => p.localTime)).toEqual([
        '2026-10-06T08:00:00-03:00',
      ]);

      const fromOnly = await ctx
        .http()
        .get(`/api/punches?employeeId=${employee.id}&from=2026-10-07`)
        .set(asAdmin);
      expect(fromOnly.body.meta.total).toBe(2);
    });

    it('valida o período', async () => {
      const cases = [
        [
          'from=2026-10-10&to=2026-10-01',
          'from deve ser anterior ou igual a to',
        ],
        [
          'from=2026-01-01&to=2026-12-31',
          'O período deve ter no máximo 93 dias',
        ],
        ['from=2026-02-30&to=2026-03-01', 'from não é uma data válida'],
      ];
      for (const [qs, message] of cases) {
        const res = await ctx
          .http()
          .get(`/api/punches/timesheet?${qs}`)
          .set(asAdmin);
        expect(res.status).toBe(400);
        expect(res.body.message).toBe(message);
      }

      const missing = await ctx
        .http()
        .get('/api/punches/timesheet')
        .set(asAdmin);
      expect(missing.status).toBe(400);
      expect(missing.body.message).toEqual(
        expect.arrayContaining(['from deve estar no formato YYYY-MM-DD']),
      );
    });
  });

  describe('espelho, correções e configuração', () => {
    let employee: Awaited<ReturnType<typeof createUser>>;
    let scheduleId: string;
    const period = 'from=2026-10-05&to=2026-10-09';

    beforeAll(async () => {
      const schedule = await ctx
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
        });
      scheduleId = schedule.body.id;

      employee = await createUser(ctx, {
        name: 'Espelho',
        workScheduleId: scheduleId,
      });
      await ctx.prisma.user.update({
        where: { id: employee.id },
        data: { createdAt: br('2026-09-01T00:00') },
      });

      await seedPunches(employee.id, [
        // seg: jornada normal com almoço
        '2026-10-05T08:00',
        '2026-10-05T12:00',
        '2026-10-05T13:00',
        '2026-10-05T17:00',
        // ter: 30 min de atraso e 1h extra
        '2026-10-06T08:30',
        '2026-10-06T12:00',
        '2026-10-06T13:00',
        '2026-10-06T18:30',
        // qua: jornada noturna que atravessa a meia-noite (7h)
        '2026-10-07T22:00',
        '2026-10-08T02:00',
        '2026-10-08T03:00',
        '2026-10-08T06:00',
        // qui: sem início de jornada → falta
        // sex: saída não marcada
        '2026-10-09T08:00',
        '2026-10-09T12:00',
        '2026-10-09T13:00',
      ]);
    });

    const timesheet = (headers = asAdmin) =>
      ctx
        .http()
        .get(`/api/punches/timesheet?employeeId=${employee.id}&${period}`)
        .set(headers);

    const dayOf = (body, date: string) =>
      body.days.find((d) => d.date === date);

    it('calcula o espelho considerando todas as marcações', async () => {
      const res = await timesheet();
      expect(res.status).toBe(200);
      expect(res.body.timezone).toBe('America/Sao_Paulo');

      expect(dayOf(res.body, '2026-10-05')).toMatchObject({
        status: 'complete',
        workedMinutes: 480,
        breakMinutes: 60,
        lateMinutes: 0,
        overtimeMinutes: 0,
        deficitMinutes: 0,
      });
      expect(dayOf(res.body, '2026-10-06')).toMatchObject({
        status: 'complete',
        workedMinutes: 540,
        lateMinutes: 30,
        overtimeMinutes: 60,
      });
      expect(dayOf(res.body, '2026-10-07')).toMatchObject({
        status: 'complete',
        workedMinutes: 420,
        breakMinutes: 60,
        deficitMinutes: 60,
      });
      expect(dayOf(res.body, '2026-10-07').periods.at(-1).end).toBe(
        '2026-10-08T06:00:00-03:00',
      );
      expect(dayOf(res.body, '2026-10-08')).toMatchObject({
        status: 'absent',
        workedMinutes: 0,
      });
      expect(dayOf(res.body, '2026-10-09')).toMatchObject({
        status: 'incomplete',
        workedMinutes: 240,
        overtimeMinutes: null,
        deficitMinutes: null,
      });

      expect(res.body.totals).toEqual({
        workedMinutes: 1680,
        expectedMinutes: 2400,
        lateMinutes: 30,
        overtimeMinutes: 60,
        deficitMinutes: 60,
        incompleteDays: 1,
        absentDays: 1,
        excusedDays: 0,
        alertDays: 0,
      });
    });

    it('o próprio funcionário consulta o seu espelho', async () => {
      const res = await ctx
        .http()
        .get(`/api/punches/timesheet?${period}`)
        .set(authHeader(ctx, employee));
      expect(res.status).toBe(200);
      expect(res.body.employee.id).toBe(employee.id);
      expect(res.body.totals.workedMinutes).toBe(1680);
    });

    it('relatório administrativo traz os mesmos totais, paginado por funcionário', async () => {
      const res = await ctx
        .http()
        .get(`/api/punches/report?${period}&employeeId=${employee.id}`)
        .set(asAdmin);
      expect(res.status).toBe(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].employee).toEqual({
        id: employee.id,
        name: 'Espelho',
      });
      expect(res.body.data[0].totals.workedMinutes).toBe(1680);

      const paged = await ctx
        .http()
        .get(`/api/punches/report?${period}&pageSize=1&page=2`)
        .set(asAdmin);
      expect(paged.status).toBe(200);
      expect(paged.body.data).toHaveLength(1);
      expect(paged.body.meta.pageSize).toBe(1);
    });

    it('inclusão manual completa o dia sem apagar nada', async () => {
      const res = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          employeeId: employee.id,
          timestamp: '2026-10-09T17:00:00-03:00',
          reason: 'Esqueceu de marcar a saída; confirmado pelo gestor',
        });
      expect(res.status).toBe(201);
      expect(res.body.created).toMatchObject({
        source: 'ADMIN',
        createdById: admin.id,
        reason: 'Esqueceu de marcar a saída; confirmado pelo gestor',
      });

      const sheet = await timesheet();
      expect(dayOf(sheet.body, '2026-10-09')).toMatchObject({
        status: 'complete',
        workedMinutes: 480,
        overtimeMinutes: 0,
      });
      expect(sheet.body.totals.incompleteDays).toBe(0);
    });

    it('troca de horário preserva a marcação original no histórico', async () => {
      const original = await ctx.prisma.punchClock.findFirstOrThrow({
        where: { userId: employee.id, timestamp: br('2026-10-06T18:30') },
      });

      const res = await ctx
        .http()
        .post(`/api/punches/${original.id}/replace`)
        .set(asAdmin)
        .send({
          timestamp: '2026-10-06T17:00:00-03:00',
          reason: 'Saída registrada com atraso, horário real 17:00',
        });
      expect(res.status).toBe(200);
      expect(res.body.voided).toMatchObject({
        id: original.id,
        voided: true,
        voidedById: admin.id,
        localTime: '2026-10-06T18:30:00-03:00',
      });
      expect(res.body.created).toMatchObject({
        replacesId: original.id,
        localTime: '2026-10-06T17:00:00-03:00',
      });

      // a original continua no banco e visível no histórico
      const history = await ctx
        .http()
        .get(`/api/punches?from=2026-10-06&to=2026-10-06`)
        .set(authHeader(ctx, employee));
      const ids = history.body.data.map((p) => p.id);
      expect(ids).toContain(original.id);
      expect(
        history.body.data.find((p) => p.id === original.id).voidReason,
      ).toBe('Saída registrada com atraso, horário real 17:00');

      const onlyValid = await ctx
        .http()
        .get(`/api/punches?from=2026-10-06&to=2026-10-06&includeVoided=false`)
        .set(authHeader(ctx, employee));
      expect(onlyValid.body.data.map((p) => p.id)).not.toContain(original.id);

      // e o cálculo usa apenas a marcação válida: 3h30 + 4h = 7h30
      const sheet = await timesheet();
      expect(dayOf(sheet.body, '2026-10-06')).toMatchObject({
        workedMinutes: 450,
        overtimeMinutes: 0,
        deficitMinutes: 30,
      });

      const again = await ctx
        .http()
        .post(`/api/punches/${original.id}/void`)
        .set(asAdmin)
        .send({
          reason: 'Tentando de novo',
        });
      expect(again.status).toBe(409);
    });

    it('desconsiderar uma marcação torna o dia incompleto em vez de inventar horário', async () => {
      const lunchReturn = await ctx.prisma.punchClock.findFirstOrThrow({
        where: { userId: employee.id, timestamp: br('2026-10-05T13:00') },
      });
      const res = await ctx
        .http()
        .post(`/api/punches/${lunchReturn.id}/void`)
        .set(asAdmin)
        .send({
          reason: 'Marcação feita por outra pessoa',
        });
      expect(res.status).toBe(200);
      expect(res.body.created).toBeNull();

      const sheet = await timesheet();
      expect(dayOf(sheet.body, '2026-10-05')).toMatchObject({
        status: 'incomplete',
        workedMinutes: 240,
        overtimeMinutes: null,
      });
      expect(
        await ctx.prisma.punchClock.count({ where: { id: lunchReturn.id } }),
      ).toBe(1);
    });

    it('valida correções', async () => {
      const base = { employeeId: employee.id, reason: 'Justificativa válida' };

      const future = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          ...base,
          timestamp: new Date(Date.now() + 3600_000).toISOString(),
        });
      expect(future.status).toBe(400);
      expect(future.body.message).toBe(
        'Não é possível incluir marcações no futuro',
      );

      const noOffset = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          ...base,
          timestamp: '2026-10-09T17:00:00',
        });
      expect(noOffset.status).toBe(400);
      expect(noOffset.body.message[0]).toMatch(/fuso explícito/);

      const noReason = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          employeeId: employee.id,
          timestamp: '2026-10-09T17:00:00-03:00',
          reason: 'ok',
        });
      expect(noReason.status).toBe(400);
      expect(noReason.body.message).toContain(
        'A justificativa deve ter pelo menos 5 caracteres',
      );

      const missingEmployee = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          ...base,
          employeeId: '00000000-0000-4000-8000-000000000000',
          timestamp: '2026-10-09T17:00:00-03:00',
        });
      expect(missingEmployee.status).toBe(404);
    });

    it('administrador não corrige as próprias marcações', async () => {
      const own = await ctx.prisma.punchClock.create({
        data: { userId: admin.id, timestamp: br('2026-10-05T08:00') },
      });

      const voidOwn = await ctx
        .http()
        .post(`/api/punches/${own.id}/void`)
        .set(asAdmin)
        .send({
          reason: 'Quero apagar meu atraso',
        });
      expect(voidOwn.status).toBe(403);

      const addOwn = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          employeeId: admin.id,
          timestamp: '2026-10-05T07:00:00-03:00',
          reason: 'Quero adiantar minha entrada',
        });
      expect(addOwn.status).toBe(403);
    });

    it('mudanças de jornada valem a partir de hoje e não alteram o passado', async () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
      }).format(new Date());
      const history = () =>
        ctx.prisma.scheduleHistory.findMany({
          where: { userId: employee.id },
          orderBy: { effectiveFrom: 'asc' },
        });

      await ctx
        .http()
        .patch(`/api/work-schedules/${scheduleId}`)
        .set(asAdmin)
        .send({ dailyMinutes: 420, lateToleranceMinutes: 30 })
        .expect(200);

      // O passado continua com a jornada da época: ter (7h30 após a correção) com 8h previstas
      const sheet = await timesheet();
      expect(dayOf(sheet.body, '2026-10-06')).toMatchObject({
        expectedMinutes: 480,
        overtimeMinutes: 0,
        deficitMinutes: 30,
        lateMinutes: 30,
      });
      expect(
        (await history()).map((h) => [h.effectiveFrom, h.dailyMinutes]),
      ).toEqual([
        ['1970-01-01', 480],
        [today, 420],
      ]);

      // Simula que a mudança vale desde a terça: só os dias a partir dela mudam
      await ctx.prisma.scheduleHistory.updateMany({
        where: { userId: employee.id, effectiveFrom: today },
        data: { effectiveFrom: '2026-10-06' },
      });
      const changed = await timesheet();
      expect(dayOf(changed.body, '2026-10-05')).toMatchObject({
        expectedMinutes: 480,
      });
      // ter: 7h30 com jornada de 7h → 30 min extra; atraso de 30 min agora dentro da tolerância
      expect(dayOf(changed.body, '2026-10-06')).toMatchObject({
        expectedMinutes: 420,
        overtimeMinutes: 30,
        deficitMinutes: 0,
        lateMinutes: 0,
      });
      // qua: 7h noturnas = jornada cheia
      expect(dayOf(changed.body, '2026-10-07')).toMatchObject({
        overtimeMinutes: 0,
        deficitMinutes: 0,
      });

      // Tirar a jornada também vale só daí em diante
      await ctx
        .http()
        .patch(`/api/employees/${employee.id}`)
        .set(asAdmin)
        .send({ workScheduleId: null })
        .expect(200);
      const withoutSchedule = await timesheet();
      expect(withoutSchedule.body.schedule).toBeNull();
      expect(withoutSchedule.body.totals.absentDays).toBe(1);

      // Sem jornada desde a quinta: a falta de quinta deixa de existir
      await ctx.prisma.scheduleHistory.updateMany({
        where: { userId: employee.id, effectiveFrom: today },
        data: { effectiveFrom: '2026-10-08' },
      });
      const fromThursday = await timesheet();
      expect(dayOf(fromThursday.body, '2026-10-08')).toBeUndefined();
      expect(fromThursday.body.totals.absentDays).toBe(0);
      expect(dayOf(fromThursday.body, '2026-10-05')).toMatchObject({
        expectedMinutes: 480,
      });
    });
  });
});
