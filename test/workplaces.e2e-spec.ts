import { authHeader, createTestApp, createUser, TestContext } from './helpers';

// Praça da Sé, São Paulo
const SE = { latitude: -23.55052, longitude: -46.633308 };
/** Ponto a `meters` ao norte da Sé (1° de latitude ≈ 111,2 km). */
const north = (meters: number) => ({
  latitude: SE.latitude + meters / 111_195,
  longitude: SE.longitude,
});

describe('Geolocalização (e2e)', () => {
  let ctx: TestContext;
  let asAdmin: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
    const admin = await createUser(ctx, { role: 'ADMIN', name: 'Admin' });
    asAdmin = authHeader(ctx, admin);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const punch = async (body?: object) => {
    const employee = await createUser(ctx);
    const res = await ctx
      .http()
      .post('/api/punches')
      .set(authHeader(ctx, employee))
      .send(body);
    return { employee, res };
  };

  it('sem local cadastrado, guarda a localização sem avaliar', async () => {
    const { res } = await punch({ ...north(10), accuracy: 12 });
    expect(res.status).toBe(201);
    expect(res.body.location).toEqual({
      status: null,
      latitude: expect.closeTo(north(10).latitude, 9),
      longitude: SE.longitude,
      accuracyMeters: 12,
      workplaceName: null,
      distanceMeters: null,
    });
  });

  describe('locais de trabalho', () => {
    it('só administradores gerenciam, com validação', async () => {
      const employee = await createUser(ctx);
      const forbidden = await ctx
        .http()
        .get('/api/workplaces')
        .set(authHeader(ctx, employee));
      expect(forbidden.status).toBe(403);

      const invalid = await ctx
        .http()
        .post('/api/workplaces')
        .set(asAdmin)
        .send({ name: 'X', latitude: 95, longitude: 0, radiusMeters: 10 });
      expect(invalid.status).toBe(400);
    });

    it('cadastra, altera e remove', async () => {
      const created = await ctx
        .http()
        .post('/api/workplaces')
        .set(asAdmin)
        .send({ name: ' Depósito ', ...north(50_000), radiusMeters: 200 });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        name: 'Depósito',
        radiusMeters: 200,
      });

      const updated = await ctx
        .http()
        .put(`/api/workplaces/${created.body.id}`)
        .set(asAdmin)
        .send({ name: 'Depósito 2', ...north(50_000), radiusMeters: 300 });
      expect(updated.status).toBe(200);
      expect(updated.body.radiusMeters).toBe(300);

      const removed = await ctx
        .http()
        .delete(`/api/workplaces/${created.body.id}`)
        .set(asAdmin);
      expect(removed.status).toBe(204);
      const again = await ctx
        .http()
        .delete(`/api/workplaces/${created.body.id}`)
        .set(asAdmin);
      expect(again.status).toBe(404);
    });
  });

  describe('com local cadastrado', () => {
    beforeAll(async () => {
      await ctx
        .http()
        .post('/api/workplaces')
        .set(asAdmin)
        .send({ name: 'Matriz', ...SE, radiusMeters: 150 })
        .expect(201);
    });

    it('marcação no raio = no local', async () => {
      const { res } = await punch({ ...north(100), accuracy: 10 });
      expect(res.status).toBe(201);
      expect(res.body.location).toMatchObject({
        status: 'INSIDE',
        workplaceName: 'Matriz',
        distanceMeters: 100,
      });
    });

    it('marcação longe é aceita com alerta de fora do local', async () => {
      const { res } = await punch({ ...north(8000), accuracy: 10 });
      expect(res.status).toBe(201);
      expect(res.body.location).toMatchObject({
        status: 'OUTSIDE',
        workplaceName: 'Matriz',
        distanceMeters: 8000,
      });
    });

    it.each([
      ['sem corpo', undefined],
      ['localização inválida', { latitude: 'abc', longitude: 999 }],
    ])('%s: marcação aceita como sem localização', async (_, body) => {
      const { res } = await punch(body);
      expect(res.status).toBe(201);
      expect(res.body.location).toMatchObject({
        status: 'UNAVAILABLE',
        latitude: null,
      });
    });

    it('alerta aparece no painel do dia, nos registros e no relatório', async () => {
      const { employee } = await punch({ ...north(8000), accuracy: 10 });

      const today = await ctx.http().get('/api/punches/today').set(asAdmin);
      const row = today.body.employees.find(
        (e: { employee: { id: string } }) => e.employee.id === employee.id,
      );
      expect(row).toMatchObject({
        outsideLocationPunches: 1,
        noLocationPunches: 0,
      });

      const date = today.body.date;
      const sheet = await ctx
        .http()
        .get('/api/punches/timesheet')
        .query({ employeeId: employee.id, from: date, to: date })
        .set(asAdmin);
      expect(sheet.body.days[0].punches[0].locationStatus).toBe('OUTSIDE');
      expect(sheet.body.totals.outsideLocationPunches).toBe(1);

      const report = await ctx
        .http()
        .get('/api/punches/report')
        .query({ employeeId: employee.id, from: date, to: date })
        .set(asAdmin);
      expect(report.body.data[0].totals.outsideLocationPunches).toBe(1);
    });

    it('a localização gravada não pode ser alterada nem no banco', async () => {
      const { res } = await punch({ ...north(8000), accuracy: 10 });
      await expect(
        ctx.prisma.punchClock.update({
          where: { id: res.body.id },
          data: { locationStatus: 'INSIDE' },
        }),
      ).rejects.toThrow(/não podem ser alteradas/);
    });

    it('inclusão do admin não tem localização', async () => {
      const employee = await createUser(ctx);
      const res = await ctx
        .http()
        .post('/api/punches/manual')
        .set(asAdmin)
        .send({
          employeeId: employee.id,
          timestamp: '2026-10-20T08:00:00-03:00',
          reason: 'Esqueceu de marcar a entrada',
        });
      expect(res.status).toBe(201);
      expect(res.body.created.location).toBeNull();
    });
  });
});
