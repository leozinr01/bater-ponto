/**
 * Dados de demonstração: duas jornadas, feriados nacionais, 8 funcionários fictícios
 * (e-mails @demo.local, senha demo1234) e ~2 meses de marcações com perfis variados:
 * pontual, atrasos, horas extras, marcação esquecida, faltas, intervalo curto,
 * férias e atestado (lançados em nome do primeiro administrador, se houver).
 * As marcações de hoje vão só até a hora atual, então o painel "Hoje" fica movimentado.
 *
 * Use num banco de desenvolvimento ou de apresentação, NUNCA no banco de produção:
 * marcações não são apagadas pelo sistema.
 *
 * Uso: CONFIRM_DEMO_SEED=sim npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import 'dotenv/config';
import { addDays, localDate, weekday, zonedInstant } from '../src/common/time';
import { nationalHolidays } from '../src/holidays/national-holidays';

const TZ = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';
const DAYS_BACK = 60;
const PASSWORD = 'demo1234';
const EMAIL_DOMAIN = 'demo.local';

interface Profile {
  name: string;
  schedule: 'full' | 'part';
  /** Chances por dia (0 a 1). */
  late?: number;
  overtime?: number;
  forget?: number;
  absent?: number;
  shortBreak?: number;
  /** Afastamento em dias contados a partir de hoje (ex: [-25, -21]). */
  absence?: {
    type: 'MEDICAL' | 'VACATION';
    days: [number, number];
    reason: string;
  };
}

const PROFILES: Profile[] = [
  { name: 'Ana Souza', schedule: 'full' },
  { name: 'Bruno Lima', schedule: 'full', late: 0.35 },
  { name: 'Carla Mendes', schedule: 'full', overtime: 0.45 },
  {
    name: 'Diego Rocha',
    schedule: 'full',
    forget: 0.08,
    late: 0.1,
    absence: {
      type: 'MEDICAL',
      days: [-9, -8],
      reason: 'Atestado médico de 2 dias',
    },
  },
  {
    name: 'Eduarda Alves',
    schedule: 'full',
    absent: 0.06,
    absence: { type: 'VACATION', days: [-26, -17], reason: 'Férias (10 dias)' },
  },
  { name: 'Felipe Costa', schedule: 'full', shortBreak: 0.3, overtime: 0.15 },
  { name: 'Gabriela Nunes', schedule: 'part', late: 0.1 },
  { name: 'Henrique Dias', schedule: 'part', absent: 0.04, forget: 0.04 },
];

/** Gerador pseudoaleatório com semente: os dados saem iguais a cada execução. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(2026);
const chance = (p = 0) => random() < p;
const between = (min: number, max: number) =>
  Math.round(min + random() * (max - min));

const slug = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.');

const at = (date: string, minutesOfDay: number) =>
  new Date(zonedInstant(date, '00:00', TZ).getTime() + minutesOfDay * 60_000);

/** Marcações de um dia (minutos desde a meia-noite local), conforme o perfil. */
function dayPunches(profile: Profile): number[] {
  if (profile.schedule === 'part') {
    // 13:00, 6h com 15 min de pausa
    const start =
      13 * 60 + (chance(profile.late) ? between(15, 40) : between(-8, 6));
    const pause = start + between(150, 180);
    const back = pause + between(15, 20);
    const end = start + 360 + (back - pause) + between(-5, 10);
    return [start, pause, back, end];
  }
  // 08:00, 8h com 1h de almoço
  const start =
    8 * 60 + (chance(profile.late) ? between(15, 55) : between(-12, 8));
  const lunch = 12 * 60 + between(-15, 20);
  const lunchMinutes = chance(profile.shortBreak)
    ? between(25, 45)
    : between(58, 75);
  const back = lunch + lunchMinutes;
  const extra = chance(profile.overtime) ? between(40, 170) : between(-6, 12);
  const end = back + (480 - (lunch - start)) + extra;
  return [start, lunch, back, end];
}

async function main() {
  if (process.env.CONFIRM_DEMO_SEED !== 'sim') {
    const host = process.env.DATABASE_URL?.split('@')[1]?.split('/')[0];
    throw new Error(
      `Este script grava dados fictícios no banco ${host ?? '(DATABASE_URL)'}.\n` +
        'Use só em banco de desenvolvimento/apresentação. Para confirmar: CONFIRM_DEMO_SEED=sim npm run seed:demo',
    );
  }

  const prisma = new PrismaClient();
  try {
    if (
      await prisma.user.count({
        where: { email: { endsWith: `@${EMAIL_DOMAIN}` } },
      })
    ) {
      throw new Error(
        `Os dados de demonstração (@${EMAIL_DOMAIN}) já existem neste banco.`,
      );
    }

    const now = new Date();
    const today = localDate(now, TZ);
    const firstDay = addDays(today, -DAYS_BACK);
    const year = Number(today.slice(0, 4));

    // Feriados
    for (const y of [year - 1, year]) {
      await prisma.holiday.createMany({
        data: nationalHolidays(y),
        skipDuplicates: true,
      });
    }
    const holidays = new Set(
      (await prisma.holiday.findMany({ select: { date: true } })).map(
        (h) => h.date,
      ),
    );

    // Jornadas
    const full = await prisma.workSchedule.create({
      data: {
        name: 'Comercial 8h (demo)',
        startTime: '08:00',
        dailyMinutes: 480,
        workDays: [1, 2, 3, 4, 5],
        lateToleranceMinutes: 10,
        overtimeToleranceMinutes: 10,
      },
    });
    const part = await prisma.workSchedule.create({
      data: {
        name: 'Meio período 6h (demo)',
        startTime: '13:00',
        dailyMinutes: 360,
        workDays: [1, 2, 3, 4, 5],
        lateToleranceMinutes: 10,
        overtimeToleranceMinutes: 10,
      },
    });

    const password = await hash(PASSWORD, 10);
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    let totalPunches = 0;

    for (const profile of PROFILES) {
      const user = await prisma.user.create({
        data: {
          name: profile.name,
          email: `${slug(profile.name)}@${EMAIL_DOMAIN}`,
          password,
          role: 'EMPLOYEE',
          workScheduleId: profile.schedule === 'full' ? full.id : part.id,
          createdAt: zonedInstant(firstDay, '00:00', TZ),
        },
      });

      const absence = admin && profile.absence;
      const away = absence
        ? {
            start: addDays(today, absence.days[0]),
            end: addDays(today, absence.days[1]),
          }
        : null;
      if (absence && away) {
        await prisma.absence.create({
          data: {
            userId: user.id,
            type: absence.type,
            startDate: away.start,
            endDate: away.end,
            reason: absence.reason,
            createdById: admin.id,
          },
        });
      }

      const punches: Date[] = [];
      for (let date = firstDay; date <= today; date = addDays(date, 1)) {
        if ([0, 6].includes(weekday(date)) || holidays.has(date)) continue;
        if (away && date >= away.start && date <= away.end) continue;
        if (chance(profile.absent)) continue;

        let times = dayPunches(profile).map((m) => at(date, m));
        // Esqueceu de marcar a volta do almoço ou a saída (só em dias passados)
        if (date < today && chance(profile.forget)) {
          times.splice(chance(0.5) ? 2 : 3, 1);
        }
        // Hoje: só o que já aconteceu
        times = times.filter((t) => t <= now);
        punches.push(...times);
      }

      await prisma.punchClock.createMany({
        data: punches.map((timestamp) => ({
          userId: user.id,
          timestamp,
          source: 'EMPLOYEE' as const,
          createdAt: timestamp,
        })),
      });
      totalPunches += punches.length;
      console.log(
        `  ${user.name.padEnd(16)} ${user.email} · ${punches.length} marcações`,
      );
    }

    console.log(
      `\nPronto: ${PROFILES.length} funcionários, ${totalPunches} marcações desde ${firstDay}. Senha de todos: ${PASSWORD}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
