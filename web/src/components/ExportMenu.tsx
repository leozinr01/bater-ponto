import { ChevronDown, Download, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

export type ExportOption<T extends string> = { value: T; label: string; hint: string; icon: LucideIcon };

export const pdfCsvOptions: ExportOption<'pdf' | 'csv'>[] = [
  { value: 'pdf', label: 'PDF', hint: 'Para imprimir ou enviar', icon: FileText },
  { value: 'csv', label: 'CSV', hint: 'Para abrir no Excel', icon: FileSpreadsheet },
];

/** Botão "Exportar" que abre a escolha do formato (por padrão, PDF ou CSV). */
export function ExportMenu<T extends string = 'pdf' | 'csv'>({
  onExport,
  options = pdfCsvOptions as unknown as ExportOption<T>[],
  loading,
  disabled,
}: {
  onExport: (value: T) => void;
  options?: ExportOption<T>[];
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        icon={Download}
        loading={loading}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Exportar
        <ChevronDown className="-mr-1 size-4 text-slate-400" />
      </Button>
      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl bg-ink-800 p-1 shadow-xl ring-1 shadow-black/40 ring-white/10"
        >
          {options.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(value);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <Icon className="size-4 shrink-0 text-slate-400" />
              <span>
                <span className="block text-sm font-medium text-white">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
