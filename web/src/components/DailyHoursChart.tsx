import { formatDate, formatMinutes, WEEKDAYS } from '../lib/format';
import type { ChartTone, DayBar } from '../lib/timesheet-cells';
import { cn } from './ui';

const barColor: Record<ChartTone, string> = {
  green: 'bg-emerald-400/80',
  red: 'bg-red-400/80',
  amber: 'bg-amber-400/80',
  gray: 'bg-slate-500/40',
};

function describe(bar: DayBar) {
  const date = `${WEEKDAYS[bar.weekday]} ${formatDate(bar.date, false)}`;
  if (bar.absent) return `${date}: falta`;
  if (!bar.worked && !bar.expected) return `${date}: sem registro`;
  const expected = bar.expected ? ` de ${formatMinutes(bar.expected)} previstas` : ' (fora da jornada)';
  return `${date}: ${formatMinutes(bar.worked)} trabalhadas${expected}`;
}

/** Horas trabalhadas em cada dia do período, com a parte prevista do dia como marca tracejada. */
export function DailyHoursChart({ bars, todayDate }: { bars: DayBar[]; todayDate: string }) {
  const max = Math.max(60, ...bars.map((b) => Math.max(b.worked, b.expected ?? 0)));
  // Escala em horas cheias, com folga em cima
  const top = Math.ceil((max * 1.1) / 60) * 60;
  const pct = (minutes: number) => `${(minutes / top) * 100}%`;
  const gridHours = [0.5, 1].map((f) => Math.round((top * f) / 60) * 60);
  // Um rótulo a cada poucos dias quando o período é longo
  const labelStep = Math.max(1, Math.ceil(bars.length / 16));

  return (
    <div>
      <div className="relative h-32">
        {gridHours.map((m) => (
          <div key={m} className="absolute inset-x-0 border-t border-dashed border-white/[0.06]" style={{ bottom: pct(m) }}>
            <span className="absolute -top-2 right-0 bg-ink-850 pl-1 text-[10px] text-slate-600 tabular-nums">
              {m / 60}h
            </span>
          </div>
        ))}
        <div className="absolute inset-0 right-6 flex items-end gap-[2px] border-b border-white/10 sm:gap-1">
          {bars.map((bar) => (
            <div
              key={bar.date}
              title={describe(bar)}
              className={cn('group relative flex h-full flex-1 items-end', bar.date > todayDate && 'opacity-30')}
            >
              {bar.expected ? (
                <div
                  className="absolute inset-x-0 border-t-2 border-dashed border-slate-400/50"
                  style={{ bottom: pct(bar.expected) }}
                />
              ) : null}
              {bar.absent ? (
                <div className="h-1 w-full rounded-sm bg-red-400" />
              ) : (
                <div
                  className={cn('w-full rounded-t-sm transition-opacity group-hover:opacity-100', barColor[bar.tone])}
                  style={{ height: pct(bar.worked) }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mr-6 mt-1 flex gap-[2px] sm:gap-1">
        {bars.map((bar, i) => (
          <span
            key={bar.date}
            className={cn(
              'flex-1 text-center text-[10px] text-slate-600 tabular-nums',
              bar.date === todayDate && 'font-bold text-brand-300',
            )}
          >
            {i % labelStep === 0 || bar.date === todayDate ? Number(bar.date.slice(8)) : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <Legend className="bg-emerald-400/80">Cumpriu o previsto</Legend>
        <Legend className="bg-red-400/80">Abaixo do previsto ou falta</Legend>
        <Legend className="bg-amber-400/80">Folga ou feriado trabalhado</Legend>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-slate-400/60" />
          Previsto do dia
        </span>
      </div>
    </div>
  );
}

function Legend({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm', className)} />
      {children}
    </span>
  );
}
