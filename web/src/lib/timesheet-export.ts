import { alertLabels, dayStatusLabel } from '../components/timesheet';
import type { ExportSection, ExportTable } from './export';
import { formatDate, formatDuration, formatMinutes, timeOf, WEEKDAYS } from './format';
import type { Timesheet } from './types';

const dash = (minutes: number | null | undefined) => (minutes ? formatMinutes(minutes) : '–');
const signedBalance = (overtime: number | null, deficit: number | null) => {
  if (overtime === null && deficit === null) return '–';
  const b = (overtime ?? 0) - (deficit ?? 0);
  return `${b > 0 ? '+' : ''}${formatMinutes(b)}`;
};

/**
 * Espelho de ponto como tabela: uma linha por dia com entrada, intervalo, saída,
 * horas trabalhadas, hora extra com o adicional e horas negativas. Marcações além
 * da quarta vão para a coluna "Outras". No fim, destaques coloridos e um resumo.
 */
export function timesheetSection(sheet: Timesheet, title?: string): ExportSection {
  const t = sheet.totals;
  const extras =
    (t.overtime50Minutes ?? 0) + (t.overtime100Minutes ?? 0);

  return {
    title,
    head: [
      'Data',
      'Dia',
      'Entrada',
      'Saída intv.',
      'Volta intv.',
      'Saída',
      'Outras',
      'Trabalhado',
      'Hora extra',
      'Negativo',
      'Atraso',
      'Saldo',
      'Situação',
    ],
    rows: sheet.days.map((d) => {
      const times = d.punches.map((p) => timeOf(p.localTime));
      // Com duas marcações não houve intervalo: a segunda é a saída
      const [entry, breakOut, breakIn, exit] =
        times.length <= 2 ? [times[0], undefined, undefined, times[1]] : times;
      return [
        formatDate(d.date, false),
        WEEKDAYS[d.weekday],
        entry ?? '–',
        breakOut ?? '–',
        breakIn ?? '–',
        exit ?? '–',
        times.slice(4).join(' ') || '–',
        d.punches.length ? formatMinutes(d.workedMinutes) : '–',
        d.overtimeMinutes ? `${formatMinutes(d.overtimeMinutes)} (${d.overtimeRate}%)` : '–',
        dash(d.deficitMinutes),
        dash(d.lateMinutes),
        signedBalance(d.overtimeMinutes, d.deficitMinutes),
        [dayStatusLabel(d), d.absence?.reason, ...d.alerts.map((a) => alertLabels[a].label)]
          .filter(Boolean)
          .join(' · '),
      ];
    }),
    highlights: [
      { label: 'Trabalhado', value: formatDuration(t.workedMinutes), tone: 'brand' },
      {
        label: 'Saldo',
        value: signedBalance(t.overtimeMinutes, t.deficitMinutes),
        tone: ((t.overtimeMinutes ?? 0) - (t.deficitMinutes ?? 0)) >= 0 ? 'green' : 'red',
      },
      { label: 'Hora extra', value: extras ? formatDuration(extras) : '0h', tone: 'amber' },
      { label: 'Atrasos', value: t.lateMinutes ? formatDuration(t.lateMinutes) : '0h', tone: t.lateMinutes ? 'red' : 'gray' },
    ],
    summary: [
      ['Horas trabalhadas', formatMinutes(t.workedMinutes)],
      ['Horas previstas', formatMinutes(t.expectedMinutes)],
      ['Hora extra 50% (sábado e úteis)', formatMinutes(t.overtime50Minutes)],
      ['Hora extra 100% (domingo e feriado)', formatMinutes(t.overtime100Minutes)],
      ['Horas negativas', formatMinutes(t.deficitMinutes)],
      ['Atrasos', formatMinutes(t.lateMinutes)],
      ['Faltas (dias)', t.absentDays],
      ['Dias incompletos', t.incompleteDays],
    ],
    signatures: true,
  };
}

/** Monta o PDF completo do espelho de ponto com cabeçalho e metadados. */
export function buildTimesheetExport(sheet: Timesheet, from: string, to: string): ExportTable {
  return {
    filename: `espelho-ponto_${fileSlug(sheet.employee.name)}_${from.slice(0, 7)}`,
    title: 'Espelho de ponto',
    subtitle: `Período de ${formatDate(from)} a ${formatDate(to)}`,
    meta: [
      ['Funcionário', sheet.employee.name],
      ['Fuso horário', sheet.timezone],
      ['Jornada', sheet.schedule ? `${sheet.schedule.name} (início ${sheet.schedule.startTime})` : 'Não definida'],
      ['Emissão', new Date().toLocaleDateString('pt-BR')],
    ],
    sections: [timesheetSection(sheet)],
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
