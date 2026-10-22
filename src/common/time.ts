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

/** Data local (YYYY-MM-DD) de um instante no fuso informado. */
export function localDate(instant: Date, tz: string): string {
  return dayjs(instant).tz(tz).format('YYYY-MM-DD');
}

/** Horário local legível de um instante no fuso informado. */
export function localDateTime(instant: Date, tz: string): string {
  return dayjs(instant).tz(tz).format('YYYY-MM-DDTHH:mm:ssZ');
}

/** Instante correspondente a uma data + horário locais no fuso informado. */
export function zonedInstant(date: string, time: string, tz: string): Date {
  return dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', tz).toDate();
}

export function addDays(date: string, days: number): string {
  return dayjs.utc(date).add(days, 'day').format('YYYY-MM-DD');
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD. */
export function weekday(date: string): number {
  return dayjs.utc(date).day();
}

export function isValidDate(date: string): boolean {
  return DATE_REGEX.test(date) && dayjs.utc(date).format('YYYY-MM-DD') === date;
}
