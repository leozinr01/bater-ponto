import { runLedger } from './ledger';

// 2026-11-02 é segunda; 07 sábado; 08 domingo
const day = (
  date: string,
  weekday: number,
  values: { overtime?: number; deficit?: number; holiday?: string },
) => ({
  date,
  weekday,
  holiday: values.holiday ?? null,
  overtimeMinutes: values.overtime ?? 0,
  deficitMinutes: values.deficit ?? 0,
  compensatedMinutes: 0,
});

describe('runLedger', () => {
  it('extras de dia útil e falta de horas entram 1:1 no saldo', () => {
    const { balance, byMonth } = runLedger(
      [
        day('2026-11-02', 1, { overtime: 30 }),
        day('2026-11-03', 2, { deficit: 50 }),
      ],
      [],
    );
    expect(balance).toBe(-20);
    expect(byMonth.get('2026-11')).toMatchObject({
      overtimeMinutes: 30,
      deficitMinutes: 50,
      payroll50Minutes: 0,
    });
  });

  it('sábado paga o negativo com fator 1,5 e o resto vai para a folha', () => {
    // -90 no banco; 2h no sábado: 60 min viram 90 no banco, 60 min vão para a folha
    const { balance, byMonth } = runLedger(
      [
        day('2026-11-03', 2, { deficit: 90 }),
        day('2026-11-07', 6, { overtime: 120 }),
      ],
      [],
    );
    expect(balance).toBe(0);
    expect(byMonth.get('2026-11')).toMatchObject({
      saturdayCreditMinutes: 90,
      payroll50Minutes: 60,
    });
  });

  it('sábado com saldo positivo vai todo para a folha', () => {
    const { balance, byMonth } = runLedger(
      [
        day('2026-11-02', 1, { overtime: 15 }),
        day('2026-11-07', 6, { overtime: 240 }),
      ],
      [],
    );
    expect(balance).toBe(15);
    expect(byMonth.get('2026-11')?.payroll50Minutes).toBe(240);
  });

  it('sábado não deixa o saldo positivo: só cobre o que falta', () => {
    // -20 no banco; 4h no sábado: 14 min (×1,5 = 21, limitado a 20) e 226 para a folha
    const { balance, byMonth } = runLedger(
      [
        day('2026-11-03', 2, { deficit: 20 }),
        day('2026-11-07', 6, { overtime: 240 }),
      ],
      [],
    );
    expect(balance).toBe(0);
    expect(byMonth.get('2026-11')).toMatchObject({
      saturdayCreditMinutes: 20,
      payroll50Minutes: 226,
    });
  });

  it('domingo e feriado vão para a folha com 100% e não mexem no saldo', () => {
    const { balance, byMonth } = runLedger(
      [
        day('2026-11-03', 2, { deficit: 60 }),
        day('2026-11-08', 0, { overtime: 120 }),
        day('2026-11-15', 0, { overtime: 60, holiday: 'Proclamação' }),
      ],
      [],
    );
    expect(balance).toBe(-60);
    expect(byMonth.get('2026-11')?.payroll100Minutes).toBe(180);
  });

  it('ajustes entram antes do dia e contam para o sábado', () => {
    const { balance } = runLedger(
      [day('2026-11-07', 6, { overtime: 60 })],
      [{ date: '2026-11-07', minutes: -60 }],
    );
    // -60 do ajuste: 40 min do sábado (×1,5) zeram o saldo
    expect(balance).toBe(0);
  });
});
