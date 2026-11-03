export type ExportFormat = 'pdf' | 'csv';

/** Tabela pronta para exportar: título no topo do PDF e nome do arquivo sem extensão. */
export type ExportTable = {
  filename: string;
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | number)[][];
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
function downloadCsv({ filename, head, rows }: ExportTable) {
  const csv = [head, ...rows]
    .map((r) => r.map((v) => `"${safeCell(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

/** PDF em paisagem com a tabela. A biblioteca só é carregada quando alguém exporta. */
async function downloadPdf({ filename, title, subtitle, head, rows }: ExportTable) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 40);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 40, 56);
  }
  autoTable(doc, {
    startY: subtitle ? 68 : 54,
    head: [head],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 64, 160] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
  });
  doc.save(`${filename}.pdf`);
}

export function exportTable(format: ExportFormat, table: ExportTable) {
  return format === 'pdf' ? downloadPdf(table) : Promise.resolve(downloadCsv(table));
}
