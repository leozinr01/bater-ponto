import {
  authHeader,
  createTestApp,
  createUser,
  TEST_PASSWORD,
  TestContext,
} from './helpers';

describe('Autenticação (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const login = (email: string, password: string) =>
    ctx.http().post('/api/auth/login').send({ email, password });

  it('faz login com e-mail (sem diferenciar maiúsculas) e senha, e acessa /auth/me', async () => {
    const user = await createUser(ctx, {
      email: 'joana@teste.com',
      name: 'Joana',
    });

    const res = await login('Joana@Teste.com', TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });

    const me = await ctx
      .http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: user.id,
      name: 'Joana',
      role: 'EMPLOYEE',
    });
    expect(me.body).not.toHaveProperty('password');
  });

  it('rejeita senha errada e e-mail inexistente com a mesma mensagem', async () => {
    const user = await createUser(ctx);
    const wrong = await login(user.email, 'senha-errada-123');
    const missing = await login('ninguem@teste.com', TEST_PASSWORD);

    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.message).toBe(missing.body.message);
  });

  it('não permite login de usuário desativado', async () => {
    const user = await createUser(ctx);
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { active: false },
    });

    expect((await login(user.email, TEST_PASSWORD)).status).toBe(401);
  });

  it('retorna erros de validação claros', async () => {
    const res = await ctx.http().post('/api/auth/login').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining(['E-mail inválido', 'Informe a senha']),
    );
  });

  it('não existe cadastro público de usuários', async () => {
    const res = await ctx.http().post('/api/users/register').send({
      name: 'Hacker',
      email: 'h@teste.com',
      password: '12345678',
      role: 'ADMIN',
    });
    expect(res.status).toBe(404);
  });

  it('exige token em rotas protegidas e rejeita token inválido', async () => {
    expect((await ctx.http().get('/api/punches')).status).toBe(401);
    expect((await ctx.http().post('/api/punches')).status).toBe(401);
    expect(
      (
        await ctx
          .http()
          .get('/api/punches')
          .set('Authorization', 'Bearer abc.def.ghi')
      ).status,
    ).toBe(401);
  });

  it('renova tokens com refresh token, sem aceitar um no lugar do outro', async () => {
    const user = await createUser(ctx);
    const { body: tokens } = await login(user.email, TEST_PASSWORD);

    const refreshed = await ctx
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));

    const accessAsRefresh = await ctx
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: tokens.accessToken });
    expect(accessAsRefresh.status).toBe(401);

    const refreshAsAccess = await ctx
      .http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.refreshToken}`);
    expect(refreshAsAccess.status).toBe(401);
  });

  it('trocar a senha invalida os tokens anteriores', async () => {
    const user = await createUser(ctx);
    const { body: old } = await login(user.email, TEST_PASSWORD);

    const wrongCurrent = await ctx
      .http()
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${old.accessToken}`)
      .send({ currentPassword: 'errada-123', newPassword: 'nova-senha-123' });
    expect(wrongCurrent.status).toBe(400);

    const weak = await ctx
      .http()
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${old.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: '123' });
    expect(weak.status).toBe(400);
    expect(weak.body.message).toContain(
      'A senha deve ter pelo menos 8 caracteres',
    );

    const changed = await ctx
      .http()
      .post('/api/auth/password')
      .set('Authorization', `Bearer ${old.accessToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'nova-senha-123' });
    expect(changed.status).toBe(200);

    const oldAccess = await ctx
      .http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${old.accessToken}`);
    expect(oldAccess.status).toBe(401);

    const oldRefresh = await ctx
      .http()
      .post('/api/auth/refresh')
      .send({ refreshToken: old.refreshToken });
    expect(oldRefresh.status).toBe(401);

    const newAccess = await ctx
      .http()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${changed.body.accessToken}`);
    expect(newAccess.status).toBe(200);

    expect((await login(user.email, 'nova-senha-123')).status).toBe(200);
    expect((await login(user.email, TEST_PASSWORD)).status).toBe(401);
  });

  it('o papel vem do banco: token antigo não mantém privilégios removidos', async () => {
    const admin = await createUser(ctx, { role: 'ADMIN' });
    const headers = authHeader(ctx, admin);
    expect((await ctx.http().get('/api/employees').set(headers)).status).toBe(
      200,
    );

    await ctx.prisma.user.update({
      where: { id: admin.id },
      data: { role: 'EMPLOYEE' },
    });
    expect((await ctx.http().get('/api/employees').set(headers)).status).toBe(
      403,
    );
  });

  it('limita tentativas de login', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push(
        (await login('bruteforce@teste.com', 'tentativa-123')).status,
      );
    }
    expect(statuses).toContain(429);
  });

  it('a equipe inteira faz login pelo mesmo IP sem ser barrada', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      statuses.push(
        (await login(`equipe${i}@teste.com`, 'senha-qualquer-1')).status,
      );
    }
    // 401 = e-mail inexistente; o que importa é nenhum 429
    expect(statuses).toEqual(statuses.map(() => 401));
  });

  it('a equipe inteira renova a sessão pelo mesmo IP sem ser barrada', async () => {
    const users = await Promise.all(
      Array.from({ length: 30 }, () => createUser(ctx)),
    );
    const statuses: number[] = [];
    for (const user of users) {
      const refreshToken = ctx.jwt.sign({
        sub: user.id,
        type: 'refresh',
        ver: user.tokenVersion,
      });
      const res = await ctx
        .http()
        .post('/api/auth/refresh')
        .send({ refreshToken });
      statuses.push(res.status);
    }
    expect(statuses).toEqual(users.map(() => 200));
  });
});
