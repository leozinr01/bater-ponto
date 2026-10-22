import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentMonth, formatMonth, shiftMonth } from '../lib/format';

/** Navegação de mês: anterior / nome do mês / próximo (não passa do mês atual). */
export function MonthNav({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrent = month >= currentMonth();
  return (
    <div className="flex items-center gap-1 rounded-xl bg-ink-800 p-1 ring-1 ring-white/10 ring-inset">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Mês anterior"
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-36 text-center text-sm font-semibold text-white">{formatMonth(month)}</span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={isCurrent}
        aria-label="Próximo mês"
        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
