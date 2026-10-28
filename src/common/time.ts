import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export { dayjs };

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
/** ISO 8601 com fuso explícito (Z ou ±HH:mm), para não haver ambiguidade de horário. */
export const ISO_WITH_OFFSET_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/*
 * As conversões de fuso usam Intl com um formatador em cache por fuso. O espelho e o
 * banco de horas fazem milhares delas por funcionário, e o dayjs.tz cria um formatador
 * a cada chamada (~80 µs cada): no relatório de 50 funcionários com 2 anos, eram ~10 s.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Data e hora de parede de um instante no fuso. */
function wallClock(instant: number, tz: string): WallClock {
  const parts: Record<string, number> = {};
  for (const { type, value } of formatter(tz).formatToParts(instant)) {
    if (type !== 'literal') parts[type] = Number(value);
  }
  return parts as unknown as WallClock;
}

/** Deslocamento do fuso (ms, ex.: -3h) no instante. */
function offsetAt(instant: number, tz: string): number {
  const w = wallClock(instant, tz);
  const asUtc = Date.UTC(
    w.year,
    w.month - 1,
    w.day,
    w.hour,
    w.minute,
    w.second,
  );
  return asUtc - (instant - (((instant % 1000) + 1000) % 1000));
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

/** Data local (YYYY-MM-DD) de um instante no fuso informado. */
export function localDate(instant: Date, tz: string): string {
  const w = wallClock(instant.getTime(), tz);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/** Horário local legível de um instante no fuso informado. */
export function localDateTime(instant: Date, tz: string): string {
  const time = instant.getTime();
  const w = wallClock(time, tz);
  const offsetMinutes = Math.round(offsetAt(time, tz) / 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}` +
    `T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

const zonedCache = new Map<string, number>();

/** Instante correspondente a uma data + horário locais no fuso informado. */
export function zonedInstant(date: string, time: string, tz: string): Date {
  const key = `${date} ${time} ${tz}`;
  let result = zonedCache.get(key);
  if (result === undefined) {
    const [y, mo, d] = date.split('-').map(Number);
    const [h, mi] = time.split(':').map(Number);
    const wall = Date.UTC(y, mo - 1, d, h, mi);
    // Mesma regra do dayjs (fixOffset): o deslocamento pode mudar entre o palpite e o
    // resultado (horário de verão); em horário ambíguo ou inexistente, vale o mais tarde
    const o0 = offsetAt(wall, tz);
    result = wall - o0;
    const o2 = offsetAt(result, tz);
    if (o2 !== o0) {
      result = wall - o2;
      const o3 = offsetAt(result, tz);
      if (o3 !== o2) result = wall - Math.min(o2, o3);
    }
    if (zonedCache.size > 50_000) zonedCache.clear();
    zonedCache.set(key, result);
  }
  return new Date(result);
}

function utcDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, days: number): string {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD. */
export function weekday(date: string): number {
  return utcDate(date).getUTCDay();
}

export function isValidDate(date: string): boolean {
  return DATE_REGEX.test(date) && dayjs.utc(date).format('YYYY-MM-DD') === date;
}
