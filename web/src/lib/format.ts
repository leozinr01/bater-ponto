export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 465 -> "7:45". null -> "–" */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '–';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  return `${sign}${Math.floor(abs / 60)}:${pad(abs % 60)}`;
}

/** 480 -> "8h", 525 -> "8h45" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

/** "2026-10-20T08:00:00-03:00" -> "08:00" (horário já no fuso da empresa) */
export function timeOf(localTime: string): string {
  return localTime.slice(11, 16);
}

/** "2026-10-20T08:00:00-03:00" -> "2026-10-20" */
export function dateOf(localTime: string): string {
  return localTime.slice(0, 10);
}

/** "2026-10-20" -> "20/10/2026" */
export function formatDate(date: string, withYear = true): string {
  const [y, m, d] = date.split('-');
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/** Data de hoje (YYYY-MM-DD) no fuso informado, ou no do navegador. */
export function today(timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "2026-11-01", -1 -> "2026-10-31" */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

/** "2026-10" -> { from: "2026-10-01", to: "2026-10-31" }, com fim limitado a hoje */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const end = `${month}-${pad(last)}`;
  const now = today();
  return { from, to: from <= now && now < end ? now : end };
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Deslocamento (minutos) do fuso em relação ao UTC num instante. */
function offsetMinutes(timeZone: string, instant: number): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(instant)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const value = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -value : value;
}

/**
 * Data + horário no fuso da empresa -> ISO 8601 com deslocamento explícito,
 * como a API exige nas correções. Ex: ("2026-10-20", "08:00", "America/Sao_Paulo")
 * -> "2026-10-20T08:00:00-03:00".
 */
export function zonedIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  let offset = offsetMinutes(timeZone, asUtc);
  offset = offsetMinutes(timeZone, asUtc - offset * 60_000);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** "08:45" -> 525 */
export function parseDuration(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 525 -> "08:45" */
export function durationInput(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
