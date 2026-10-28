// O dayjs.tz erra perto das viradas de horário de verão do fuso da máquina; a
// referência só é confiável com a máquina em UTC (como na Vercel).
process.env.TZ = 'UTC';

import {
  addDays,
  dayjs,
  localDate,
  localDateTime,
  weekday,
  zonedInstant,
} from './time';

/**
 * As conversões de fuso trocaram o dayjs.tz por Intl em cache, por desempenho.
 * Estes testes garantem que o resultado é idêntico ao do dayjs, inclusive nas
 * viradas do horário de verão (São Paulo até 2019, Nova York).
 */
const ZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/New_York',
  'UTC',
];
const HOUR = 3600_000;

describe('conversões de fuso (iguais ao dayjs)', () => {
  it.each(ZONES)(
    'localDate e localDateTime a cada ~1h de 2017 a 2020 (%s)',
    (tz) => {
      const start = Date.UTC(2017, 0, 1);
      const end = Date.UTC(2020, 0, 1);
      for (let t = start; t < end; t += HOUR + 7_000) {
        const instant = new Date(t);
        const reference = dayjs(instant).tz(tz);
        expect(localDate(instant, tz)).toBe(reference.format('YYYY-MM-DD'));
        expect(localDateTime(instant, tz)).toBe(
          reference.format('YYYY-MM-DDTHH:mm:ssZ'),
        );
      }
    },
    20_000,
  );

  it.each(ZONES)(
    'zonedInstant de cada dia e horário cheio de 2017 a 2020 (%s)',
    (tz) => {
      for (
        let date = '2017-01-01';
        date < '2020-01-01';
        date = addDays(date, 1)
      ) {
        for (const time of [
          '00:00',
          '00:30',
          '01:00',
          '02:30',
          '08:00',
          '23:59',
        ]) {
          const ours = zonedInstant(date, time, tz);
          const reference = dayjs
            .tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', tz)
            .toDate();
          if (ours.getTime() !== reference.getTime()) {
            // Só aceita diferença em horário ambíguo (a hora que se repete no fim do
            // horário de verão): as duas leituras mostram a mesma hora de parede, e o
            // dayjs escolhe entre elas pelo fuso de hoje.
            expect(localDateTime(ours, tz).slice(0, 16)).toBe(
              `${date}T${time}`,
            );
            expect(localDateTime(reference, tz).slice(0, 16)).toBe(
              `${date}T${time}`,
            );
          } else {
            expect(ours.getTime()).toBe(reference.getTime());
          }
        }
      }
    },
    20_000,
  );

  it('addDays e weekday atravessam meses, anos e anos bissextos', () => {
    for (
      let date = '2023-12-25';
      date < '2025-01-10';
      date = addDays(date, 1)
    ) {
      expect(addDays(date, 1)).toBe(
        dayjs.utc(date).add(1, 'day').format('YYYY-MM-DD'),
      );
      expect(addDays(date, -40)).toBe(
        dayjs.utc(date).add(-40, 'day').format('YYYY-MM-DD'),
      );
      expect(weekday(date)).toBe(dayjs.utc(date).day());
    }
  });
});
