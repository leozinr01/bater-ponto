/**
 * Cada arquivo de teste e2e roda num schema próprio e descartável do PostgreSQL
 * apontado por DATABASE_URL, com as migrations reais aplicadas.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Defina DATABASE_URL para rodar os testes e2e (veja .env.example)',
  );
}

const schema = `test_${randomUUID().replace(/-/g, '')}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);

process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'America/Sao_Paulo';
process.env.JWT_SECRET = randomBytes(48).toString('base64');

beforeAll(() => {
  execSync('npx prisma migrate deploy', { env: process.env, stdio: 'ignore' });
});

afterAll(async () => {
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await prisma.$disconnect();
});
