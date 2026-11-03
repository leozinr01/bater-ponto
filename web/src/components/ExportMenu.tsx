import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ExportFormat } from '../lib/export';
import { Button } from './ui';

const options = [
  { format: 'pdf', label: 'PDF', hint: 'Para imprimir ou enviar', icon: FileText },
  { format: 'csv', label: 'CSV', hint: 'Para abrir no Excel', icon: FileSpreadsheet },
] as const;

/** Botão "Exportar" que abre a escolha entre PDF e CSV. */
export function ExportMenu({
  onExport,
  loading,
  disabled,
}: {
  onExport: (format: ExportFormat) => void;
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
          className="animate-fade-in absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl bg-ink-800 p-1 shadow-xl ring-1 shadow-black/40 ring-white/10"
        >
          {options.map(({ format, label, hint, icon: Icon }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onExport(format);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <Icon className="size-4 text-slate-400" />
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
