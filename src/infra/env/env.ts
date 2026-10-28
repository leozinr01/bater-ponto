import { z } from 'zod';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  /** Fuso usado para definir o "dia" de trabalho e interpretar horários da jornada. */
  APP_TIMEZONE: z
    .string()
    .default('America/Sao_Paulo')
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'APP_TIMEZONE inválido (use um nome IANA, ex: America/Sao_Paulo)'),
  CORS_ORIGIN: z.string().optional(),
  /**
   * Proxies confiáveis à frente da API (Express "trust proxy"): número de saltos
   * (ex.: 1 no Render/Railway/Fly) ou true. Sem isso, atrás de proxy todos os usuários
   * parecem ter o mesmo IP e dividem o limite de tentativas de login.
   */
  TRUST_PROXY: z
    .string()
    .regex(
      /^(\d+|true|false)$/,
      'TRUST_PROXY deve ser um número de saltos, true ou false',
    )
    .optional()
    .or(z.literal(''))
    .transform((value) =>
      !value
        ? undefined
        : /^\d+$/.test(value)
          ? Number(value)
          : value === 'true',
    ),
  /** Liga o Swagger em /swagger. Desligado por padrão para não ir ao ar por esquecimento. */
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;
