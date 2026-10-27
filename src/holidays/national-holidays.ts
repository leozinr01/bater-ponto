import { addDays } from '@/common/time';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Feriados nacionais (Lei 662/1949, Lei 6.802/1980 e Lei 14.759/2023).
 * Carnaval e Corpus Christi são ponto facultativo: o administrador inclui se a empresa folgar.
 */
export function nationalHolidays(
  year: number,
): { date: string; name: string }[] {
  const fixed = (md: string, name: string) => ({ date: `${year}-${md}`, name });
  return [
    fixed('01-01', 'Confraternização Universal'),
    { date: addDays(easterSunday(year), -2), name: 'Paixão de Cristo' },
    fixed('04-21', 'Tiradentes'),
    fixed('05-01', 'Dia do Trabalho'),
    fixed('09-07', 'Independência do Brasil'),
    fixed('10-12', 'Nossa Senhora Aparecida'),
    fixed('11-02', 'Finados'),
    fixed('11-15', 'Proclamação da República'),
    ...(year >= 2024
      ? [fixed('11-20', 'Dia Nacional de Zumbi e da Consciência Negra')]
      : []),
    fixed('12-25', 'Natal'),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
