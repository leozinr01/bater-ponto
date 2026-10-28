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

  it('publica o Swagger quando SWAGGER_ENABLED está ligado', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    const env = app.get(EnvService);
    const withSwagger = {
      get: (key: Parameters<EnvService['get']>[0]) =>
        key === 'SWAGGER_ENABLED' ? true : env.get(key),
    } as EnvService;
    appSetup(app, withSwagger);
    await app.init();

    try {
      const res = await request(app.getHttpServer()).get('/swagger-json');
      expect(res.status).toBe(200);
      expect(res.body.info.title).toBe('Sistema de Ponto');
    } finally {
      await app.close();
    }
  });
});
