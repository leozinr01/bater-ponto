import { addDays } from './format';
import type { Timesheet, TimesheetDay } from './types';

type Punch = TimesheetDay['punches'][number];

/**
 * Marcações nas colunas da folha: entrada, saída e volta do intervalo, saída e as que
 * passarem de quatro. Com duas marcações não houve intervalo: a segunda é a saída.
 */
export function punchColumns(day: TimesheetDay) {
  const p = day.punches;
  if (p.length <= 2) {
    return { entry: p[0] ?? null, breakOut: null, breakIn: null, exit: p[1] ?? null, others: [] as Punch[] };
  }
  return { entry: p[0], breakOut: p[1], breakIn: p[2], exit: p[3] ?? null, others: p.slice(4) };
}

/** Saldo do dia (extra − falta); null quando ainda não há cálculo. */
export function dayBalance(day: TimesheetDay): number | null {
  if (day.overtimeMinutes === null && day.deficitMinutes === null) return null;
  return (day.overtimeMinutes ?? 0) - (day.deficitMinutes ?? 0);
}

/**
 * Saldo como aparece na folha: com sinal quando há extra ou falta, "0:00" no dia que fecha
 * a semana zerada e "–" nos demais (dia comum não tem saldo próprio: ele fecha na semana).
 */
export function balanceText(day: TimesheetDay, signed: (m: number) => string): string {
  const balance = dayBalance(day);
  if (balance) return signed(balance);
  return day.week && balance === 0 ? '0:00' : '–';
}

export type ChartTone = 'green' | 'red' | 'amber' | 'gray';

export interface DayBar {
  date: string;
  weekday: number;
  /** Minutos trabalhados. */
  worked: number;
  /** Parte do dia na carga semanal (só em dia de trabalho). */
  expected: number | null;
  tone: ChartTone;
  absent: boolean;
}

/**
 * Uma barra por data do período (com os dias sem registro), para o gráfico de horas:
 * verde cumpriu a parte do dia, vermelho ficou abaixo ou faltou, âmbar trabalhou em folga ou feriado.
 */
export function dailyBars(sheet: Timesheet): DayBar[] {
  const byDate = new Map(sheet.days.map((d) => [d.date, d]));
  const bars: DayBar[] = [];
  for (let date = sheet.from; date <= sheet.to; date = addDays(date, 1)) {
    const day = byDate.get(date);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const worked = day?.workedMinutes ?? 0;
    const expected = day?.scheduled ? day.expectedMinutes : null;
    const absent = day?.status === 'absent';
    const tone: ChartTone = absent
      ? 'red'
      : expected
        ? worked >= expected
          ? 'green'
          : day?.status === 'complete'
            ? 'red'
            : 'gray'
        : worked > 0
          ? 'amber'
          : 'gray';
    bars.push({ date, weekday, worked, expected, tone, absent });
  }
  return bars;
}
