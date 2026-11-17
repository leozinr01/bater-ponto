import { alertLabels, dayStatusLabel } from '../components/timesheet';
import { api } from './api';
import { exportTable, type ExportChart, type ExportFormat, type ExportSection, type ExportTable } from './export';
import { formatDate, formatMinutes, formatSigned, monthRange, timeOf, WEEKDAYS } from './format';
import { balanceText, dailyBars, punchColumns } from './timesheet-cells';
import type { Paginated, ReportItem, Timesheet } from './types';

const dash = (minutes: number | null | undefined) => (minutes ? formatMinutes(minutes) : '–');

/** Parte do nome do arquivo: "2026-11" no mês inteiro, "2026-11-03_a_2026-11-20" num período escolhido. */
function periodSlug(from: string, to: string) {
  const month = from.slice(0, 7);
  return from.endsWith('-01') && to === monthRange(month).to ? month : `${from}_a_${to}`;
}
const time = (p: { localTime: string } | null) => (p ? timeOf(p.localTime) : '–');

/** Horas trabalhadas por dia, com a parte prevista do dia como marca. */
function hoursChart(sheet: Timesheet): ExportChart | undefined {
  if (!sheet.schedule) return undefined;
  return {
    title: 'Horas trabalhadas por dia',
    bars: dailyBars(sheet).map((b) => ({
      label: String(Number(b.date.slice(8))),
      value: b.worked,
      target: b.expected,
      tone: b.tone,
      marker: b.absent,
    })),
    legend: [
      { label: 'Cumpriu o previsto', tone: 'green' },
      { label: 'Abaixo do previsto ou falta', tone: 'red' },
      { label: 'Folga ou feriado trabalhado', tone: 'amber' },
      { label: 'Previsto do dia', tone: 'target' },
    ],
  };
}

/**
 * Espelho de ponto como tabela: uma linha por dia com entrada, intervalo, saída,
 * horas trabalhadas, hora extra (+) com o adicional e horas negativas (-). Marcações
 * além da quarta vão para a coluna "Outras". Antes da tabela, destaques e o gráfico
 * de horas por dia; no fim, o resumo.
 */
export function timesheetSection(sheet: Timesheet, title?: string): ExportSection {
  const t = sheet.totals;
  const balance =
    t.overtimeMinutes === null && t.deficitMinutes === null
      ? null
      : (t.overtimeMinutes ?? 0) - (t.deficitMinutes ?? 0);

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
      const c = punchColumns(d);
      return [
        formatDate(d.date, false),
        WEEKDAYS[d.weekday],
        time(c.entry),
        time(c.breakOut),
        time(c.breakIn),
        time(c.exit),
        c.others.map((p) => timeOf(p.localTime)).join(' ') || '–',
        d.punches.length ? formatMinutes(d.workedMinutes) : '–',
        d.overtimeMinutes ? `${formatSigned(d.overtimeMinutes)} (${d.overtimeRate}%)` : '–',
        d.deficitMinutes ? formatSigned(-d.deficitMinutes) : '–',
        dash(d.lateMinutes),
        balanceText(d, formatSigned),
        [
          dayStatusLabel(d),
          d.absence?.reason,
          d.week &&
            `Semana: ${formatMinutes(d.week.workedMinutes)} de ${formatMinutes(d.week.expectedMinutes)}${d.week.pending ? ' (pendente)' : ''}`,
          ...d.alerts.map((a) => alertLabels[a].label),
        ]
          .filter(Boolean)
          .join(' · '),
      ];
    }),
    highlights: [
      {
        label: 'Trabalhado',
        value: `${formatMinutes(t.workedMinutes)}${t.expectedMinutes !== null ? ` de ${formatMinutes(t.expectedMinutes)}` : ''}`,
        tone: 'brand',
      },
      {
        label: 'Saldo do período',
        value: formatSigned(balance),
        tone: balance === null || balance === 0 ? 'gray' : balance > 0 ? 'green' : 'red',
      },
      {
        label: 'Hora extra',
        value: t.overtimeMinutes ? formatSigned(t.overtimeMinutes) : '0:00',
        tone: t.overtimeMinutes ? 'green' : 'gray',
      },
      {
        label: 'Horas negativas',
        value: t.deficitMinutes ? formatSigned(-t.deficitMinutes) : '0:00',
        tone: t.deficitMinutes ? 'red' : 'gray',
      },
    ],
    chart: hoursChart(sheet),
    summary: [
      ['Horas trabalhadas', formatMinutes(t.workedMinutes)],
      ['Horas previstas', formatMinutes(t.expectedMinutes)],
      ['Hora extra 50% (semana e sábado)', t.overtime50Minutes ? formatSigned(t.overtime50Minutes) : '0:00'],
      ['Hora extra 100% (domingo e feriado)', t.overtime100Minutes ? formatSigned(t.overtime100Minutes) : '0:00'],
      ['Horas negativas', t.deficitMinutes ? formatSigned(-t.deficitMinutes) : '0:00'],
      ['Saldo do período', formatSigned(balance)],
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
    filename: `espelho-ponto_${fileSlug(sheet.employee.name)}_${periodSlug(from, to)}`,
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

/** Todos os funcionários do relatório do período (todas as páginas). */
export async function fetchReportItems(from: string, to: string) {
  const items: ReportItem[] = [];
  for (let page = 1; ; page++) {
    const res = await api<Paginated<ReportItem>>('/punches/report', { query: { from, to, page, pageSize: 100 } });
    items.push(...res.data);
    if (page >= res.meta.totalPages) break;
  }
  return items;
}

/** Espelho de ponto de todos os funcionários num arquivo só: uma seção (página) por funcionário. */
export async function exportAllTimesheets(from: string, to: string, format: ExportFormat) {
  const items = await fetchReportItems(from, to);
  const sections: ExportSection[] = [];
  for (const { employee } of items) {
    const sheet = await api<Timesheet>('/punches/timesheet', { query: { employeeId: employee.id, from, to } });
    sections.push(timesheetSection(sheet, employee.name));
  }
  await exportTable(format, {
    filename: `espelho-ponto_todos_${periodSlug(from, to)}`,
    title: 'Espelho de ponto',
    subtitle: `Período de ${formatDate(from)} a ${formatDate(to)}`,
    meta: [
      ['Funcionários', String(items.length)],
      ['Emissão', new Date().toLocaleDateString('pt-BR')],
    ],
    sections,
  });
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
