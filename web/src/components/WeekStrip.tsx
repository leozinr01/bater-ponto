import { useState } from 'react';
import { formatMinutes, WEEKDAYS } from '../lib/format';
import type { TimesheetDay } from '../lib/types';
import { DayDetail } from './DayPeriods';
import { Card, cn } from './ui';

/** "2026-10-22" + n dias */
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Datas de segunda a domingo da semana de `date`. */
function weekOf(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = addDays(date, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const dotColor: Record<string, string> = {
  complete: 'bg-emerald-400',
  incomplete: 'bg-amber-400',
  in_progress: 'bg-brand-400',
  absent: 'bg-red-400',
};

function statusLabel(day: TimesheetDay | undefined) {
  if (!day) return 'Sem dados';
  if (day.status === 'complete' && day.punches.length === 0) return day.scheduled ? 'Sem marcações' : 'Folga';
  return { complete: 'Completo', incomplete: 'Incompleto', in_progress: 'Em andamento', absent: 'Falta' }[day.status];
}

/** Semana de hoje, de segunda a domingo. Tocar num dia mostra os horários dele logo abaixo. */
export function WeekStrip({ days, todayDate }: { days: TimesheetDay[]; todayDate: string }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const week = weekOf(todayDate);
  const total = week.reduce((acc, d) => acc + (byDate.get(d)?.workedMinutes ?? 0), 0);
  const [selected, setSelected] = useState(todayDate);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-white">Esta semana</h2>
        <p className="text-xs text-slate-500 tabular-nums">{formatMinutes(total)} trabalhadas</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {week.map((date) => {
          const d = byDate.get(date);
          const isToday = date === todayDate;
          const isSelected = date === selected;
          const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
          const dot = d && !(d.status === 'complete' && d.punches.length === 0) ? dotColor[d.status] : null;
          const worked = d?.workedMinutes ?? 0;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              aria-pressed={isSelected}
              title={`${weekday} ${date.slice(8)}: ${statusLabel(d)}`}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 transition-all active:scale-95',
                isToday ? 'bg-brand-500 shadow-lg shadow-brand-500/25' : 'bg-white/[0.03] ring-1 ring-white/[0.05] hover:bg-white/[0.06]',
                isSelected && !isToday && 'bg-white/[0.08] ring-white/30',
                isSelected && isToday && 'ring-2 ring-white/60',
                date > todayDate && 'opacity-40',
              )}
            >
              <span className={cn('text-[11px] font-medium uppercase', isToday ? 'text-brand-100' : 'text-slate-500')}>
                {weekday}
              </span>
              <span className={cn('text-lg font-bold tabular-nums', isToday ? 'text-white' : 'text-slate-200')}>
                {Number(date.slice(8))}
              </span>
              <span className={cn('size-1.5 rounded-full', dot ?? 'bg-transparent', isToday && dot && 'ring-2 ring-white/60')} />
              <span
                className={cn(
                  'text-[11px] tabular-nums',
                  isToday ? 'font-semibold text-white' : worked ? 'text-slate-400' : 'text-slate-600',
                )}
              >
                {worked ? formatMinutes(worked) : '–'}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <DayDetail key={selected} day={byDate.get(selected)} date={selected} future={selected > todayDate} />
      </div>
    </Card>
  );
}
