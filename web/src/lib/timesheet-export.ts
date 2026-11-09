import { alertLabels, dayStatusLabel } from '../components/timesheet';
import type { ExportSection } from './export';
import { formatDate, formatMinutes, timeOf, WEEKDAYS } from './format';
import type { Timesheet } from './types';

const dash = (minutes: number | null | undefined) => (minutes ? formatMinutes(minutes) : '–');

/**
 * Espelho de ponto como tabela: uma linha por dia com as quatro marcações da jornada
 * (entrada, saída e volta do intervalo, saída), horas, extra com o adicional e horas negativas.
 * Marcações além da quarta vão para a coluna "Outras". No fim, o resumo do período.
 */
export function timesheetSection(sheet: Timesheet, title?: string): ExportSection {
  const t = sheet.totals;
  return {
    title,
    head: [
      'Data',
      'Entrada',
      'Saída intervalo',
      'Volta intervalo',
      'Saída',
      'Outras',
      'Trabalhado',
      'Hora extra',
      'Negativo',
      'Atraso',
      'Situação',
    ],
    rows: sheet.days.map((d) => {
      const times = d.punches.map((p) => timeOf(p.localTime));
      // Com duas marcações não houve intervalo: a segunda é a saída
      const [entry, breakOut, breakIn, exit] =
        times.length <= 2 ? [times[0], undefined, undefined, times[1]] : times;
      return [
        `${formatDate(d.date, false)} ${WEEKDAYS[d.weekday]}`,
        entry ?? '–',
        breakOut ?? '–',
        breakIn ?? '–',
        exit ?? '–',
        times.slice(4).join(' ') || '–',
        d.punches.length ? formatMinutes(d.workedMinutes) : '–',
        d.overtimeMinutes ? `${formatMinutes(d.overtimeMinutes)} (${d.overtimeRate}%)` : '–',
        dash(d.deficitMinutes),
        dash(d.lateMinutes),
        [dayStatusLabel(d), d.absence?.reason, ...d.alerts.map((a) => alertLabels[a].label)]
          .filter(Boolean)
          .join(' · '),
      ];
    }),
    summary: [
      ['Horas trabalhadas', formatMinutes(t.workedMinutes)],
      ['Horas previstas', formatMinutes(t.expectedMinutes)],
      ['Hora extra 50%', formatMinutes(t.overtime50Minutes)],
      ['Hora extra 100%', formatMinutes(t.overtime100Minutes)],
      ['Horas negativas', formatMinutes(t.deficitMinutes)],
      ['Atrasos', formatMinutes(t.lateMinutes)],
      ['Faltas (dias)', t.absentDays],
      ['Dias incompletos', t.incompleteDays],
    ],
  };
}

/** Nome do arquivo sem acentos nem espaços: "João Silva" -> "joao-silva". */
export function fileSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
