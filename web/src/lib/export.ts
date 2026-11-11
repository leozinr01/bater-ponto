export type ExportFormat = 'pdf' | 'csv';

/** Uma tabela do arquivo, com um resumo opcional (pares rótulo/valor) logo abaixo. */
export type ExportSection = {
  /** Título da seção (ex.: nome do funcionário); no PDF, cada seção com título começa numa página nova. */
  title?: string;
  head: string[];
  rows: (string | number)[][];
  summary?: [string, string | number][];
  /**
   * Destaques do período: até 4 cartões coloridos no topo da seção (resumo visual).
   * Ex.: Trabalhado, Saldo, Hora extra, Atrasos.
   */
  highlights?: { label: string; value: string; tone?: 'brand' | 'green' | 'red' | 'amber' | 'gray' }[];
  /**
   * Se verdadeiro, imprime uma área de assinatura ao final da seção (funcionário e responsável).
   */
  signatures?: boolean;
};

/** Arquivo pronto para exportar. */
export type ExportTable = {
  filename: string;
  title: string;
  subtitle?: string;
  /** Metadados do cabeçalho em pares rótulo/valor (ex.: Funcionário, Cargo, Período, Empresa). */
  meta?: [string, string][];
  sections: ExportSection[];
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Texto começando com = + - @ viraria fórmula no Excel; o apóstrofo o mantém como texto.
// Saldos como "+1:30" e "-0:15" são só números e passam direto.
const safeCell = (v: string | number) =>
  typeof v === 'string' && /^[=+\-@\t\r]/.test(v) && !/^[+-]\d+(:\d{2})?$/.test(v) ? `'${v}` : String(v);

/** CSV separado por ";" e com BOM, para abrir direto no Excel em português. */
function downloadCsv({ filename, title, subtitle, meta, sections }: ExportTable) {
  const lines: (string | number)[][] = [[title]];
  if (subtitle) lines.push([subtitle]);
  if (meta?.length) for (const [k, v] of meta) lines.push([k, v]);
  lines.push([]);
  for (const s of sections) {
    if (s.title) lines.push([s.title]);
    lines.push(s.head, ...s.rows);
    if (s.summary?.length) lines.push([], ['Resumo'], ...s.summary);
    lines.push([]);
  }
  const csv = lines.map((r) => r.map((v) => `"${safeCell(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

// Paleta do PDF (RGB)
const COLORS = {
  brand: [37, 64, 160] as [number, number, number],
  brandSoft: [232, 236, 250] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  textMuted: [100, 116, 139] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  rowAlt: [248, 250, 252] as [number, number, number],
  weekend: [240, 245, 250] as [number, number, number],
  green: [16, 128, 80] as [number, number, number],
  red: [185, 28, 28] as [number, number, number],
  amber: [180, 83, 9] as [number, number, number],
  gray: [71, 85, 105] as [number, number, number],
};

const toneColor = (t?: 'brand' | 'green' | 'red' | 'amber' | 'gray') =>
  t === 'green' ? COLORS.green : t === 'red' ? COLORS.red : t === 'amber' ? COLORS.amber : t === 'gray' ? COLORS.gray : COLORS.brand;

type Doc = import('jspdf').jsPDF & { lastAutoTable?: { finalY: number } };

/** Faixa de cabeçalho com título, subtítulo e metadados (funcionário, período etc.). */
function drawHeader(doc: Doc, pageWidth: number, title: string, subtitle?: string, meta?: [string, string][]) {
  // Faixa colorida no topo
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.text);
  doc.text(title, 40, 36);

  // Subtítulo
  let y = 54;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(subtitle, 40, y);
    y += 18;
  }

  // Metadados em duas colunas (rótulo + valor)
  if (meta?.length) {
    const colWidth = (pageWidth - 80) / 2;
    const half = Math.ceil(meta.length / 2);
    const cols = [meta.slice(0, half), meta.slice(half)];
    doc.setFontSize(9);
    let rowY = y;
    const rows = Math.max(cols[0].length, cols[1].length);
    for (let i = 0; i < rows; i++) {
      for (let c = 0; c < 2; c++) {
        const item = cols[c][i];
        if (!item) continue;
        const x = 40 + c * colWidth;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.textMuted);
        doc.text(`${item[0]}:`, x, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.text);
        doc.text(String(item[1]), x + doc.getTextWidth(`${item[0]}: `), rowY);
      }
      rowY += 14;
    }
    y = rowY + 4;
  }

  return y;
}

/** Até 4 cartões coloridos: rótulo em cima, valor grande embaixo. */
function drawHighlights(doc: Doc, pageWidth: number, startY: number, highlights: NonNullable<ExportSection['highlights']>) {
  const gap = 10;
  const cardHeight = 52;
  const available = pageWidth - 80;
  const count = Math.min(highlights.length, 4);
  const cardWidth = (available - gap * (count - 1)) / count;

  for (let i = 0; i < count; i++) {
    const h = highlights[i];
    const x = 40 + i * (cardWidth + gap);
    const color = toneColor(h.tone);

    // Caixa com fundo bem claro e borda lateral colorida
    doc.setFillColor(...COLORS.rowAlt);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 4, 4, 'F');
    doc.setFillColor(...color);
    doc.rect(x, startY, 3, cardHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.textMuted);
    doc.text(h.label.toUpperCase(), x + 12, startY + 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...color);
    doc.text(h.value, x + 12, startY + 38);
  }

  return startY + cardHeight + 16;
}

/** Área para assinaturas no fim da seção. */
function drawSignatures(doc: Doc, pageWidth: number, y: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const needed = 60;
  if (y + needed > pageHeight - 50) {
    doc.addPage();
    y = 50;
  } else {
    // Empurra as assinaturas para o fim da página (acima do rodapé)
    y = Math.max(y + 20, pageHeight - 90);
  }

  const colWidth = (pageWidth - 80 - 60) / 2;
  const lineY = y + 20;
  doc.setDrawColor(...COLORS.textMuted);
  doc.setLineWidth(0.5);

  // Funcionário
  doc.line(40, lineY, 40 + colWidth, lineY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.textMuted);
  doc.text('Assinatura do funcionário', 40, lineY + 12);

  // Responsável
  const x2 = 40 + colWidth + 60;
  doc.line(x2, lineY, x2 + colWidth, lineY);
  doc.text('Assinatura do responsável', x2, lineY + 12);

  return lineY + 24;
}

/** Rodapé com data de geração e paginação. */
function drawFooter(doc: Doc, pageWidth: number) {
  const total = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textMuted);
  const generated = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Linha de separação
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(40, pageHeight - 28, pageWidth - 40, pageHeight - 28);
    doc.text(`Gerado em ${generated}`, 40, pageHeight - 16);
    const label = `Página ${i} de ${total}`;
    doc.text(label, pageWidth - 40 - doc.getTextWidth(label), pageHeight - 16);
  }
}

/** PDF em paisagem, estilo profissional (logo CSS cards, tipografia Helvetica). */
async function downloadPdf({ filename, title, subtitle, meta, sections }: ExportTable) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }) as Doc;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = { left: 40, right: 40, top: 40, bottom: 40 };

  let y = drawHeader(doc, pageWidth, title, subtitle, meta);

  sections.forEach((s, i) => {
    if (s.title && i > 0) {
      doc.addPage();
      y = drawHeader(doc, pageWidth, title, subtitle, meta);
    }
    if (s.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.text);
      doc.text(s.title, 40, y + 4);
      // Linha sublinhada discreta
      doc.setDrawColor(...COLORS.brand);
      doc.setLineWidth(1);
      doc.line(40, y + 8, 40 + doc.getTextWidth(s.title) + 4, y + 8);
      y += 18;
    }

    if (s.highlights?.length) {
      y = drawHighlights(doc, pageWidth, y, s.highlights);
    }

    autoTable(doc, {
      startY: y,
      head: [s.head],
      body: s.rows.map((r) => r.map(String)),
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
        textColor: COLORS.text,
        lineColor: COLORS.border,
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: COLORS.brand,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'left',
      },
      alternateRowStyles: { fillColor: COLORS.rowAlt },
      bodyStyles: { valign: 'middle' },
      // Marca domingos/sábados com fundo mais claro (quando a primeira coluna começa com "dom"/"sáb")
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const cell = data.row.cells[0];
        const txt = String(cell?.text?.[0] ?? '').toLowerCase();
        if (txt.includes('dom') || txt.includes('sáb')) {
          data.cell.styles.fillColor = COLORS.weekend;
        }
      },
      margin,
    });

    y = (doc.lastAutoTable?.finalY ?? y) + 16;

    if (s.summary?.length) {
      // Resumo em caixa destacada centralizada (ocupa a largura toda para ficar mais respirável)
      const rowHeight = 18;
      const boxWidth = Math.min(380, pageWidth - 80);
      const boxHeight = rowHeight * s.summary.length + 36;
      const boxX = (pageWidth - boxWidth) / 2;

      const pageHeight = doc.internal.pageSize.getHeight();
      const signaturesReserve = s.signatures ? 80 : 0;
      if (y + boxHeight + signaturesReserve > pageHeight - margin.bottom - 24) {
        doc.addPage();
        y = drawHeader(doc, pageWidth, title, subtitle, meta);
      }

      // Caixa de resumo
      doc.setFillColor(...COLORS.brandSoft);
      doc.roundedRect(boxX, y, boxWidth, boxHeight, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.brand);
      doc.text('Resumo do período', boxX + 14, y + 20);

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      let ry = y + 40;
      for (const [label, value] of s.summary) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textMuted);
        doc.text(label, boxX + 14, ry);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.text);
        const valStr = String(value);
        doc.text(valStr, boxX + boxWidth - 14 - doc.getTextWidth(valStr), ry);
        ry += rowHeight;
      }
      y += boxHeight + 20;
    }

    if (s.signatures) {
      y = drawSignatures(doc, pageWidth, y);
    }
  });

  drawFooter(doc, pageWidth);
  doc.save(`${filename}.pdf`);
}

export function exportTable(format: ExportFormat, table: ExportTable) {
  return format === 'pdf' ? downloadPdf(table) : Promise.resolve(downloadCsv(table));
}
