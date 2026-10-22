import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * Configuração do driver `pg` a partir da DATABASE_URL.
 *
 * O driver `pg` manda cada consulta numa única ida e volta, sem prepared statements
 * nomeados. Com o motor nativo do Prisma num pooler em modo transação (pgbouncer=true),
 * cada consulta virava BEGIN + DEALLOCATE ALL + consulta + COMMIT: 4 idas e voltas.
 */
export function pgAdapterFromUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  // Parâmetros do Prisma que o pg não entende
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  url.searchParams.delete('pgbouncer');
  url.searchParams.delete('connection_limit');

  const local = LOCAL_HOSTS.includes(url.hostname.replace(/^\[|\]$/g, ''));
  // Sem sslmode explícito, banco remoto usa SSL sem verificar o certificado: o mesmo
  // comportamento padrão (sslmode=prefer) do motor nativo do Prisma. Para verificar,
  // use sslmode=verify-full&sslrootcert=<certificado do provedor> na URL.
  const ssl = !local && !url.searchParams.has('sslmode') ? { rejectUnauthorized: false } : undefined;

  return new PrismaPg(
    {
      connectionString: url.toString(),
      ssl,
      max: 10,
      // Abrir conexão com um banco distante custa ~2s: mantém as abertas por 5 min
      idleTimeoutMillis: 5 * 60_000,
      keepAlive: true,
    },
    { schema },
  );
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: pgAdapterFromUrl(process.env.DATABASE_URL ?? ''),
      log: ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    // Já abre uma conexão na subida, para a primeira requisição não pagar esse custo
    await this.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy() {
    return this.$disconnect();
  }
}
