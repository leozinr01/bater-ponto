import { EmployeesService } from '@/employees/employees.service';
import { authHeader, createTestApp, createUser, TestContext } from './helpers';

describe('Funcionários e jornadas (e2e)', () => {
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

  it('funcionário não acessa nenhuma rota administrativa', async () => {
    const employee = await createUser(ctx);
    const headers = authHeader(ctx, employee);
    const id = employee.id;

    const calls = [
      () => ctx.http().get('/api/employees'),
      () => ctx.http().post('/api/employees').send({}),
      () => ctx.http().get(`/api/employees/${id}`),
      () => ctx.http().patch(`/api/employees/${id}`).send({ role: 'ADMIN' }),
      () =>
        ctx
          .http()
          .post(`/api/employees/${id}/password`)
          .send({ password: 'x'.repeat(10) }),
      () => ctx.http().get('/api/work-schedules'),
      () => ctx.http().post('/api/work-schedules').send({}),
      () => ctx.http().patch(`/api/work-schedules/${id}`).send({}),
      () => ctx.http().get('/api/punches/report?from=2026-10-01&to=2026-10-31'),
      () => ctx.http().post('/api/punches/manual').send({}),
      () => ctx.http().post(`/api/punches/${id}/void`).send({}),
      () => ctx.http().post(`/api/punches/${id}/replace`).send({}),
    ];

    for (const [index, call] of calls.entries()) {
      const res = await call().set(headers);
      expect(res.status, `chamada #${index}: ${JSON.stringify(res.body)}`).toBe(
        403,
      );
    }

    const stillEmployee = await ctx.prisma.user.findUnique({ where: { id } });
    expect(stillEmployee?.role).toBe('EMPLOYEE');
  });

  it('admin cadastra funcionário com jornada; e-mail é único', async () => {
    const schedule = await ctx
      .http()
      .post('/api/work-schedules')
      .set(asAdmin)
      .send({
        name: 'Comercial',
        startTime: '08:00',
        dailyMinutes: 480,
        workDays: [5, 1, 2, 3, 4],
        lateToleranceMinutes: 10,
        overtimeToleranceMinutes: 10,
      });
    expect(schedule.status).toBe(201);
    expect(schedule.body.workDays).toEqual([1, 2, 3, 4, 5]);

    const created = await ctx.http().post('/api/employees').set(asAdmin).send({
      name: 'Carlos',
      email: 'Carlos@Teste.com',
      password: 'senha-inicial-1',
      workScheduleId: schedule.body.id,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      email: 'carlos@teste.com',
      role: 'EMPLOYEE',
      active: true,
      workScheduleId: schedule.body.id,
    });
    expect(created.body).not.toHaveProperty('password');

    const duplicated = await ctx
      .http()
      .post('/api/employees')
      .set(asAdmin)
      .send({
        name: 'Outro',
        email: 'carlos@teste.com',
        password: 'senha-inicial-1',
      });
    expect(duplicated.status).toBe(409);
  });

  it('cadastro simultâneo com o mesmo e-mail recebe 409, não erro 500', async () => {
    await createUser(ctx, { email: 'simultaneo@teste.com' });
    // Simula a corrida: o outro cadastro passou pela checagem antes deste ser gravado
    const check = vi
      .spyOn(
        EmployeesService.prototype as unknown as {
          ensureEmailAvailable: () => Promise<void>;
        },
        'ensureEmailAvailable',
      )
      .mockResolvedValue(undefined);

    try {
      const res = await ctx.http().post('/api/employees').set(asAdmin).send({
        name: 'Simultâneo',
        email: 'simultaneo@teste.com',
        password: 'senha-inicial-1',
      });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('Já existe um usuário com este e-mail');
    } finally {
      check.mockRestore();
    }
  });

  it('valida dados de cadastro com mensagens claras', async () => {
    const res = await ctx.http().post('/api/employees').set(asAdmin).send({
      name: '',
      email: 'invalido',
      password: '123',
      role: 'SUPERUSER',
      extra: 'campo desconhecido',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'Informe o nome',
        'E-mail inválido',
        'A senha deve ter pelo menos 8 caracteres',
        'Papel inválido (EMPLOYEE ou ADMIN)',
        'property extra should not exist',
      ]),
    );

    const badSchedule = await ctx
      .http()
      .post('/api/work-schedules')
      .set(asAdmin)
      .send({
        name: 'X',
        startTime: '25:00',
        dailyMinutes: 0,
        workDays: [1, 1, 9],
        lateToleranceMinutes: 10,
        overtimeToleranceMinutes: 10,
      });
    expect(badSchedule.status).toBe(400);
    expect(badSchedule.body.message).toEqual(
      expect.arrayContaining([
        'startTime deve estar no formato HH:mm (ex: 08:00)',
        'dailyMinutes deve ser maior que zero',
        'workDays não pode ter dias repetidos',
        'workDays deve conter inteiros de 0 a 6',
      ]),
    );
  });

  it('lista com paginação e filtros', async () => {
    for (let i = 1; i <= 5; i++) {
      await createUser(ctx, {
        name: `Paginado ${i}`,
        email: `paginado${i}@teste.com`,
      });
    }

    const page1 = await ctx
      .http()
      .get('/api/employees?search=paginado&page=1&pageSize=2')
      .set(asAdmin);
    expect(page1.status).toBe(200);
    expect(page1.body.meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
    expect(page1.body.data.map((u) => u.name)).toEqual([
      'Paginado 1',
      'Paginado 2',
    ]);

    const page3 = await ctx
      .http()
      .get('/api/employees?search=paginado&page=3&pageSize=2')
      .set(asAdmin);
    expect(page3.body.data.map((u) => u.name)).toEqual(['Paginado 5']);

    const admins = await ctx
      .http()
      .get('/api/employees?role=ADMIN')
      .set(asAdmin);
    expect(admins.body.data.every((u) => u.role === 'ADMIN')).toBe(true);

    const invalid = await ctx
      .http()
      .get('/api/employees?page=0&pageSize=1000')
      .set(asAdmin);
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toEqual(
      expect.arrayContaining([
        'page deve ser maior ou igual a 1',
        'pageSize deve ser no máximo 100',
      ]),
    );
  });

  it('desativar funcionário bloqueia o acesso imediatamente e mantém os registros', async () => {
    const employee = await createUser(ctx);
    const headers = authHeader(ctx, employee);
    await ctx.prisma.punchClock.create({ data: { userId: employee.id } });

    const res = await ctx
      .http()
      .patch(`/api/employees/${employee.id}`)
      .set(asAdmin)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);

    expect((await ctx.http().get('/api/punches').set(headers)).status).toBe(
      401,
    );
    expect(
      await ctx.prisma.punchClock.count({ where: { userId: employee.id } }),
    ).toBe(1);

    const filtered = await ctx
      .http()
      .get('/api/employees?active=false')
      .set(asAdmin);
    expect(filtered.body.data.map((u) => u.id)).toContain(employee.id);
  });

  it('admin não remove o próprio acesso; senha não é alterada pelo PATCH', async () => {
    const self = await ctx
      .http()
      .patch(`/api/employees/${admin.id}`)
      .set(asAdmin)
      .send({ role: 'EMPLOYEE' });
    expect(self.status).toBe(400);

    const employee = await createUser(ctx);
    const withPassword = await ctx
      .http()
      .patch(`/api/employees/${employee.id}`)
      .set(asAdmin)
      .send({ password: 'nova-senha-123' });
    expect(withPassword.status).toBe(400);
  });

  it('admin promove funcionário e redefine senha (invalidando sessões)', async () => {
    const employee = await createUser(ctx);
    const headers = authHeader(ctx, employee);

    await ctx
      .http()
      .patch(`/api/employees/${employee.id}`)
      .set(asAdmin)
      .send({ role: 'ADMIN' })
      .expect(200);
    expect((await ctx.http().get('/api/employees').set(headers)).status).toBe(
      200,
    );

    await ctx
      .http()
      .post(`/api/employees/${employee.id}/password`)
      .set(asAdmin)
      .send({ password: 'senha-redefinida-1' })
      .expect(204);
    expect((await ctx.http().get('/api/employees').set(headers)).status).toBe(
      401,
    );

    const login = await ctx
      .http()
      .post('/api/auth/login')
      .send({ email: employee.email, password: 'senha-redefinida-1' });
    expect(login.status).toBe(200);
  });

  it('404 para funcionário ou jornada inexistente; 400 para jornada inválida no cadastro', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(
      (await ctx.http().get(`/api/employees/${missing}`).set(asAdmin)).status,
    ).toBe(404);
    expect(
      (await ctx.http().get(`/api/work-schedules/${missing}`).set(asAdmin))
        .status,
    ).toBe(404);
    expect(
      (await ctx.http().get('/api/employees/nao-e-uuid').set(asAdmin)).status,
    ).toBe(400);

    const res = await ctx.http().post('/api/employees').set(asAdmin).send({
      name: 'Sem jornada',
      email: 'semjornada@teste.com',
      password: 'senha-inicial-1',
      workScheduleId: missing,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Jornada de trabalho não encontrada');
  });
});
