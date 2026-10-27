import { ArrowRight, Coffee } from 'lucide-react';
import { formatDate, formatMinutes, timeOf, WEEKDAYS } from '../lib/format';
import type { TimesheetDay } from '../lib/types';
import { absenceLabels, Balance, DayStatusBadge } from './timesheet';
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
    'rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
    kind === 'in' ? 'text-emerald-300' : 'text-red-300',
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
 * Períodos do dia como pares "entrada → saída" (entrada verde, saída vermelha).
 * Com `onEdit`, cada horário abre a correção.
 */
export function PeriodPairs({ day, onEdit }: { day: TimesheetDay; onEdit?: (p: PunchRef) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
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

/** Detalhe de um dia: cada trecho trabalhado e os intervalos entre eles. */
export function DayDetail({ day, date, future }: { day?: TimesheetDay; date: string; future: boolean }) {
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

  return (
    <div className="animate-fade-in rounded-xl bg-white/[0.02] p-4 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">
          {weekday}, {formatDate(date, false)}
        </p>
        <div className="flex items-center gap-3">
          {day && day.punches.length > 0 && (
            <span className="text-sm text-slate-400 tabular-nums">
              <span className="font-semibold text-white">{formatMinutes(day.workedMinutes)}</span>
              {Boolean(day.overtimeMinutes || day.deficitMinutes) && (
                <span className="ml-2 text-xs">
                  <Balance overtime={day.overtimeMinutes} deficit={day.deficitMinutes} />
                </span>
              )}
            </span>
          )}
          {day && !future && <DayStatusBadge day={day} />}
        </div>
      </div>

      {!day || day.punches.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {future
            ? 'Esse dia ainda não chegou.'
            : !day
              ? 'Esse dia é do mês anterior: veja nos registros dele.'
              : day.absence
              ? `${absenceLabels[day.absence.type]}: ${day.absence.reason}`
              : day.holiday
              ? `Feriado: ${day.holiday}.`
              : day.status === 'absent'
              ? 'Falta: nenhuma marcação num dia de trabalho.'
              : day.scheduled
                ? 'Nenhuma marcação.'
                : 'Folga.'}
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {day.periods.map((p, i) => {
            const next = day.periods[i + 1];
            return (
              <li key={p.start} className="pt-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-12 font-semibold text-emerald-300 tabular-nums">{timeOf(p.start)}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-gradient-to-r from-emerald-500/60 to-red-500/60">
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap text-slate-400 tabular-nums">
                      {p.end ? formatMinutes(p.minutes) : 'em andamento'}
                    </span>
                  </span>
                  <span
                    className={cn('w-12 text-right font-semibold tabular-nums', p.end ? 'text-red-300' : 'text-brand-300')}
                  >
                    {p.end ? timeOf(p.end) : 'agora'}
                  </span>
                </div>
                {p.end && next && (
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-amber-300/80">
                    <Coffee className="size-3" />
                    Intervalo de{' '}
                    {formatMinutes(Math.round((new Date(next.start).getTime() - new Date(p.end).getTime()) / 60_000))}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
