import { AppModule } from '@/app.module';
import { appSetup } from '@/config/app.setup';
import { EnvService } from '@/infra/env/env.service';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createTestApp, TestContext } from './helpers';

describe('Configuração da aplicação (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('responde com os cabeçalhos de segurança do helmet', async () => {
    const res = await ctx.http().post('/api/auth/login').send({});

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['content-security-policy']).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('não publica o Swagger quando SWAGGER_ENABLED não está ligado', async () => {
    const page = await ctx.http().get('/swagger');
    const json = await ctx.http().get('/swagger-json');

    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  /** Sobe uma aplicação com algumas variáveis de ambiente trocadas. */
  async function withEnv(
    overrides: Partial<Record<Parameters<EnvService['get']>[0], unknown>>,
    run: (http: () => ReturnType<typeof request>) => Promise<void>,
  ) {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    const env = app.get(EnvService);
    appSetup(app, {
      get: (key: Parameters<EnvService['get']>[0]) =>
        key in overrides ? overrides[key] : env.get(key),
    } as EnvService);
    await app.init();
    try {
      await run(() => request(app.getHttpServer()));
    } finally {
      await app.close();
    }
  }

  it('publica o Swagger quando SWAGGER_ENABLED está ligado', async () => {
    await withEnv({ SWAGGER_ENABLED: true }, async (http) => {
      const res = await http().get('/swagger-json');
      expect(res.status).toBe(200);
      expect(res.body.info.title).toBe('Sistema de Ponto');
    });
  });

  it('com CORS ligado, libera o cabeçalho Date para o app acertar o relógio', async () => {
    await withEnv({ CORS_ORIGIN: 'https://app.teste' }, async (http) => {
      const res = await http()
        .post('/api/auth/refresh')
        .set('Origin', 'https://app.teste')
        .send({ refreshToken: 'x' });
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://app.teste',
      );
      expect(res.headers['access-control-expose-headers']).toContain('Date');
      expect(res.headers['date']).toBeDefined();
    });
  });

  it('com TRUST_PROXY, o limite de login conta o IP real de cada usuário', async () => {
    await withEnv({ TRUST_PROXY: 1 }, async (http) => {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        const res = await http()
          .post('/api/auth/login')
          .set('X-Forwarded-For', `203.0.113.${i + 1}`)
          .send({ email: 'mesma-conta@teste.com', password: 'senha-errada-1' });
        statuses.push(res.status);
      }
      expect(statuses).toEqual(statuses.map(() => 401));
    });
  });
});
