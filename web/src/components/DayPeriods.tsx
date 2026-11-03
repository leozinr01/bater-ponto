import { ArrowRight } from 'lucide-react';
import { timeOf } from '../lib/format';
import type { TimesheetDay } from '../lib/types';
import { cn } from './ui';

export type PunchRef = { id: string; localTime: string };

/** Marcação do período (para abrir a correção) a partir do horário. */
function punchAt(day: TimesheetDay, localTime: string | null) {
  return localTime ? day.punches.find((p) => p.localTime === localTime) : undefined;
}

function TimeChip({
  time,
  kind,
  punch,
  onEdit,
}: {
  time: string;
  kind: 'in' | 'out';
  punch?: PunchRef;
  onEdit?: (p: PunchRef) => void;
}) {
  const cls = cn(
    'rounded-md px-1.5 py-0.5 font-semibold text-slate-100 tabular-nums',
    onEdit && punch && 'cursor-pointer ring-1 ring-transparent transition hover:bg-white/5 hover:ring-brand-400/50',
  );
  const label = `${kind === 'in' ? 'Entrada' : 'Saída'} ${time}`;
  return onEdit && punch ? (
    <button type="button" className={cls} title={`${label}: clique para corrigir`} onClick={() => onEdit(punch)}>
      {time}
    </button>
  ) : (
    <span className={cls} title={label}>
      {time}
    </span>
  );
}

/**
 * Períodos do dia como pares "entrada → saída".
 * Com `onEdit`, cada horário abre a correção.
 */
export function PeriodPairs({ day, onEdit }: { day: TimesheetDay; onEdit?: (p: PunchRef) => void }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {day.periods.map((p) => (
        <span
          key={p.start}
          className="inline-flex items-center rounded-lg bg-white/[0.04] px-1 py-0.5 text-[13px] ring-1 ring-white/[0.06] ring-inset"
        >
          <TimeChip time={timeOf(p.start)} kind="in" punch={punchAt(day, p.start)} onEdit={onEdit} />
          <ArrowRight className="mx-0.5 size-3 text-slate-600" />
          {p.end ? (
            <TimeChip time={timeOf(p.end)} kind="out" punch={punchAt(day, p.end)} onEdit={onEdit} />
          ) : (
            <span className="flex items-center gap-1 px-1.5 text-xs font-medium text-brand-300">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-400" />
              agora
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
