import { formatMinutes } from '../lib/format';
import type { DayStatus, TimesheetDay } from '../lib/types';
import { Badge } from './ui';

export function DayStatusBadge({ day }: { day: TimesheetDay }) {
  const map: Record<DayStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
    complete: { label: 'Completo', tone: 'green' },
    incomplete: { label: 'Incompleto', tone: 'amber' },
    in_progress: { label: 'Em andamento', tone: 'blue' },
    absent: { label: 'Falta', tone: 'red' },
  };
  if (day.status === 'complete' && day.punches.length === 0) {
    return <Badge>{day.scheduled ? '–' : 'Folga'}</Badge>;
  }
  const { label, tone } = map[day.status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Saldo do dia/período: extra positivo, falta de horas negativa. */
export function Balance({
  overtime,
  deficit,
}: {
  overtime: number | null;
  deficit: number | null;
}) {
  if (overtime === null && deficit === null) return <span className="text-slate-400">–</span>;
  const balance = (overtime ?? 0) - (deficit ?? 0);
  if (balance === 0) return <span className="text-slate-500">0:00</span>;
  return (
    <span className={balance > 0 ? 'text-emerald-600' : 'text-red-600'}>
      {balance > 0 ? '+' : ''}
      {formatMinutes(balance)}
    </span>
  );
}
