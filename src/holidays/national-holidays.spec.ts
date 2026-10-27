import { easterSunday, nationalHolidays } from './national-holidays';

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
  ])('calcula a Páscoa de %i', (year, date) => {
    expect(easterSunday(year)).toBe(date);
  });
});

describe('nationalHolidays', () => {
  it('lista os feriados nacionais do ano em ordem, com a Paixão de Cristo móvel', () => {
    const holidays = nationalHolidays(2026);
    expect(holidays.map((h) => h.date)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-21',
      '2026-05-01',
      '2026-09-07',
      '2026-10-12',
      '2026-11-02',
      '2026-11-15',
      '2026-11-20',
      '2026-12-25',
    ]);
  });

  it('só inclui a Consciência Negra a partir de 2024', () => {
    expect(nationalHolidays(2023).some((h) => h.date === '2023-11-20')).toBe(
      false,
    );
  });
});
