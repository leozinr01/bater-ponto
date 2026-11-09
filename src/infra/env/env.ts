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
  /**
   * Grava o endereço aproximado de cada batida a partir da localização (OpenStreetMap).
   * Ligado por padrão; os testes desligam para não depender da internet.
   */
  REVERSE_GEOCODING: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  NOMINATIM_URL: z
    .string()
    .url()
    .default('https://nominatim.openstreetmap.org'),
  /**
   * Lembretes push de entrada e saída. Sem as chaves VAPID, ficam desligados.
   * Gere com: npx web-push generate-vapid-keys
   */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  /** Contato exigido pelos serviços de push: "mailto:voce@empresa.com" ou a URL do app. */
  VAPID_SUBJECT: z.string().optional(),
  /**
   * Segredo que o agendador externo envia para disparar os lembretes (POST /api/push/tick).
   * Sem ele, a rota fica desligada.
   */
  CRON_SECRET: z
    .string()
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || value.length >= 16,
      'CRON_SECRET deve ter pelo menos 16 caracteres',
    ),
  /**
   * Lembretes por e-mail (SMTP). Sem SMTP_HOST, ficam desligados.
   * Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=a conta, SMTP_PASS=senha de app.
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Remetente, ex.: "Ponto <ponto@empresa.com>". Padrão: SMTP_USER. */
  EMAIL_FROM: z.string().optional(),
  /** Endereço do app, usado no link dos e-mails. */
  APP_URL: z.string().url().optional(),
  /** Liga o Swagger em /swagger. Desligado por padrão para não ir ao ar por esquecimento. */
  SWAGGER_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;
