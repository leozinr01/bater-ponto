import { TimesheetDay } from '@/punches/timesheet';

/** Hora de sábado vale 1h30 no banco quando paga horas negativas (adicional de 50%). */
export const SATURDAY_BANK_FACTOR = 1.5;

/**
 * Movimento do banco de horas num período.
 * Entram no saldo: o saldo das semanas e as extras de folga em dia útil (1:1), falta de horas, folgas de banco,
 * ajustes manuais e o crédito de sábado. Vão para a folha de pagamento (fora do saldo):
 * extras de sábado que sobraram depois de zerar o negativo (50%) e extras de domingo e feriado (100%).
 */
export interface Movement {
  /** Extras de dias úteis, creditadas 1:1 no banco. */
  overtimeMinutes: number;
  deficitMinutes: number;
  compensatedMinutes: number;
  adjustmentMinutes: number;
  /** Crédito no banco vindo de extras de sábado, já com o fator 1,5. */
  saturdayCreditMinutes: number;
  /** Horas reais de sábado que foram para a folha (adicional de 50%). */
  payroll50Minutes: number;
  /** Horas reais de domingo e feriado que foram para a folha (adicional de 100%). */
  payroll100Minutes: number;
  balanceMinutes: number;
}

export const emptyMovement = (): Movement => ({
  overtimeMinutes: 0,
  deficitMinutes: 0,
  compensatedMinutes: 0,
  adjustmentMinutes: 0,
  saturdayCreditMinutes: 0,
  payroll50Minutes: 0,
  payroll100Minutes: 0,
  balanceMinutes: 0,
});

type LedgerDay = Pick<
  TimesheetDay,
  | 'date'
  | 'weekday'
  | 'scheduled'
  | 'holiday'
  | 'overtimeMinutes'
  | 'deficitMinutes'
  | 'compensatedMinutes'
>;

export interface Adjustment {
  date: string;
  minutes: number;
}

/**
 * Percorre os dias em ordem e aplica as regras do banco. A ordem importa: o sábado só
 * paga o negativo acumulado até ele. Ajustes de uma data entram antes do dia.
 * Retorna o movimento de cada mês (YYYY-MM) e o saldo final.
 */
export function runLedger(days: LedgerDay[], adjustments: Adjustment[]) {
  const byMonth = new Map<string, Movement>();
  const monthOf = (date: string) => {
    const key = date.slice(0, 7);
    let m = byMonth.get(key);
    if (!m) byMonth.set(key, (m = emptyMovement()));
    return m;
  };

  type Event =
    | { date: string; order: 0; adjustment: Adjustment }
    | { date: string; order: 1; day: LedgerDay };
  const events: Event[] = [
    ...adjustments.map((a) => ({
      date: a.date,
      order: 0 as const,
      adjustment: a,
    })),
    ...days.map((d) => ({ date: d.date, order: 1 as const, day: d })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

  let balance = 0;
  for (const event of events) {
    const m = monthOf(event.date);
    if ('adjustment' in event) {
      m.adjustmentMinutes += event.adjustment.minutes;
      m.balanceMinutes += event.adjustment.minutes;
      balance += event.adjustment.minutes;
      continue;
    }

    const day = event.day;
    const overtime = day.overtimeMinutes ?? 0;
    const deficit = day.deficitMinutes ?? 0;
    let delta = -deficit - day.compensatedMinutes;
    m.deficitMinutes += deficit;
    m.compensatedMinutes += day.compensatedMinutes;

    if (overtime > 0) {
      // Dia de trabalho só tem extra no fechamento da semana: vai para o banco, como dia útil
      if (day.scheduled) {
        m.overtimeMinutes += overtime;
        delta += overtime;
      } else if (day.holiday || day.weekday === 0) {
        m.payroll100Minutes += overtime;
      } else if (day.weekday === 6) {
        const negative = Math.max(0, -(balance + delta));
        const credit = Math.min(
          Math.round(overtime * SATURDAY_BANK_FACTOR),
          negative,
        );
        const used = Math.min(
          overtime,
          Math.ceil(credit / SATURDAY_BANK_FACTOR),
        );
        m.saturdayCreditMinutes += credit;
        m.payroll50Minutes += overtime - used;
        delta += credit;
      } else {
        m.overtimeMinutes += overtime;
        delta += overtime;
      }
    }

    m.balanceMinutes += delta;
    balance += delta;
  }

  return { byMonth, balance };
}
