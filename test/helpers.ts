import { AppModule } from '@/app.module';
import { appSetup } from '@/config/app.setup';
import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  jwt: JwtService;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  appSetup(app, app.get(EnvService));
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    jwt: app.get(JwtService),
    http: () => request(app.getHttpServer()),
  };
}

export const TEST_PASSWORD = 'senha-de-teste-1';

export async function createUser(
  ctx: TestContext,
  data: {
    role?: UserRole;
    name?: string;
    email?: string;
    workScheduleId?: string;
  } = {},
) {
  return ctx.prisma.user.create({
    data: {
      name: data.name ?? 'Usuário Teste',
      email: data.email ?? `${randomUUID()}@teste.com`,
      password: hashSync(TEST_PASSWORD, 4),
      role: data.role ?? 'EMPLOYEE',
      workScheduleId: data.workScheduleId,
    },
  });
}

/** Header de autorização com um access token válido para o usuário. */
export function authHeader(
  ctx: TestContext,
  user: { id: string; tokenVersion: number },
) {
  const token = ctx.jwt.sign(
    { sub: user.id, type: 'access', ver: user.tokenVersion },
    { expiresIn: '1h' },
  );
  return { Authorization: `Bearer ${token}` };
}
