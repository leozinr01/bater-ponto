import { dueReminders, PresenceItem } from './reminders';

const item = (values: Partial<PresenceItem>): PresenceItem => ({
  employee: { id: 'u1', name: 'Ana Souza' },
  status: 'not_started',
  expectedStart: '08:00',
  expectedMinutes: 480,
  workingSince: null,
  workedMinutes: 0,
  ...values,
});

const now = new Date('2026-11-09T08:05:00-03:00');

describe('dueReminders', () => {
  it('lembra a entrada a partir do horário previsto', () => {
    expect(dueReminders([item({})], now, '07:59')).toEqual([]);
    expect(dueReminders([item({})], now, '08:00')).toMatchObject([
      { userId: 'u1', kind: 'entry' },
    ]);
    expect(dueReminders([item({ status: 'late' })], now, '09:30')).toHaveLength(
      1,
    );
  });

  it('não lembra a entrada depois de 2h nem para quem já chegou ou está de folga', () => {
    expect(dueReminders([item({})], now, '10:01')).toEqual([]);
    expect(dueReminders([item({ status: 'working' })], now, '08:10')).toEqual(
      [],
    );
    expect(dueReminders([item({ status: 'day_off' })], now, '08:10')).toEqual(
      [],
    );
    expect(dueReminders([item({ status: 'away' })], now, '08:10')).toEqual([]);
    expect(dueReminders([item({ expectedStart: null })], now, '08:10')).toEqual(
      [],
    );
  });

  it('lembra a saída quando a carga do dia foi cumprida', () => {
    const working = item({
      status: 'working',
      workedMinutes: 240, // manhã
      workingSince: '2026-11-09T13:00:00-03:00',
    });
    expect(
      dueReminders([working], new Date('2026-11-09T16:59:00-03:00'), '16:59'),
    ).toEqual([]);
    expect(
      dueReminders([working], new Date('2026-11-09T17:00:00-03:00'), '17:00'),
    ).toMatchObject([{ kind: 'exit' }]);
  });

  it('não lembra a saída no intervalo nem sem jornada', () => {
    expect(
      dueReminders(
        [item({ status: 'on_break', workedMinutes: 600 })],
        now,
        '18:00',
      ),
    ).toEqual([]);
    expect(
      dueReminders(
        [
          item({
            status: 'working',
            expectedMinutes: null,
            workingSince: '2026-11-09T08:00:00-03:00',
          }),
        ],
        now,
        '20:00',
      ),
    ).toEqual([]);
  });
});
