export type ExportFormat = 'pdf' | 'csv';

/** Uma tabela do arquivo, com um resumo opcional (pares rótulo/valor) logo abaixo. */
export type ExportSection = {
  /** Título da seção (ex.: nome do funcionário); no PDF, cada seção com título começa numa página nova. */
  title?: string;
  head: string[];
  rows: (string | number)[][];
  summary?: [string, string | number][];
};

/** Arquivo pronto para exportar: título no topo do PDF e nome do arquivo sem extensão. */
export type ExportTable = {
  filename: string;
  title: string;
  subtitle?: string;
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

/** CSV separado por ";" e com BOM, para abrir direto no Excel em português. Seções separadas por linha em branco. */
function downloadCsv({ filename, title, subtitle, sections }: ExportTable) {
  const lines: (string | number)[][] = [[title], ...(subtitle ? [[subtitle]] : []), []];
  for (const s of sections) {
    if (s.title) lines.push([s.title]);
    lines.push(s.head, ...s.rows);
    if (s.summary?.length) lines.push([], ['Resumo'], ...s.summary);
    lines.push([]);
  }
  const csv = lines.map((r) => r.map((v) => `"${safeCell(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

/** PDF em paisagem. A biblioteca só é carregada quando alguém exporta. */
async function downloadPdf({ filename, title, subtitle, sections }: ExportTable) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const margin = { left: 40, right: 40 };
  const lastY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;

  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 56);
    doc.setTextColor(0);
  }
  let y = subtitle ? 72 : 58;

  sections.forEach((s, i) => {
    if (s.title) {
      if (i > 0) {
        doc.addPage();
        y = 40;
      }
      doc.setFontSize(11);
      doc.text(s.title, 40, y);
      y += 10;
    }
    autoTable(doc, {
      startY: y,
      head: [s.head],
      body: s.rows.map((r) => r.map(String)),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 64, 160] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin,
    });
    if (s.summary?.length) {
      autoTable(doc, {
        startY: lastY() + 14,
        head: [['Resumo', '']],
        body: s.summary.map(([k, v]) => [k, String(v)]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [60, 70, 90] },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 180 }, 1: { cellWidth: 100 } },
        tableWidth: 280,
        margin,
      });
    }
    y = lastY() + 24;
  });

  doc.save(`${filename}.pdf`);
}

export function exportTable(format: ExportFormat, table: ExportTable) {
  return format === 'pdf' ? downloadPdf(table) : Promise.resolve(downloadCsv(table));
}
