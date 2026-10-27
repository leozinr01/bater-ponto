import { formatMinutes } from '../lib/format';
import type { AbsenceType, DayAlert, DayStatus, TimesheetDay } from '../lib/types';
import { Badge } from './ui';

const statusMap: Record<DayStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
  complete: { label: 'Completo', tone: 'green' },
  incomplete: { label: 'Incompleto', tone: 'amber' },
  in_progress: { label: 'Em andamento', tone: 'blue' },
  absent: { label: 'Falta', tone: 'red' },
};

export const absenceLabels: Record<AbsenceType, string> = {
  MEDICAL: 'Atestado',
  VACATION: 'Férias',
  LEAVE: 'Afastamento',
  ALLOWANCE: 'Abono',
};

export function DayStatusBadge({ day }: { day: TimesheetDay }) {
  if (day.absence && day.punches.length === 0) {
    return (
      <Badge tone="blue" dot>
        {absenceLabels[day.absence.type]}
      </Badge>
    );
  }
  if (day.holiday && day.punches.length === 0) {
    return (
      <Badge tone="brand" dot>
        Feriado
      </Badge>
    );
  }
  if (day.status === 'complete' && day.punches.length === 0) {
    return <Badge>{day.scheduled ? '–' : 'Folga'}</Badge>;
  }
  const { label, tone } = statusMap[day.status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/** Saldo do dia/período: extra positivo, falta de horas negativa. */
export function Balance({ overtime, deficit }: { overtime: number | null; deficit: number | null }) {
  if (overtime === null && deficit === null) return <span className="text-slate-600">–</span>;
  const balance = (overtime ?? 0) - (deficit ?? 0);
  if (balance === 0) return <span className="text-slate-400">0:00</span>;
  return (
    <span className={balance > 0 ? 'text-emerald-300' : 'text-red-300'}>
      {balance > 0 ? '+' : ''}
      {formatMinutes(balance)}
    </span>
  );
}

export const alertLabels: Record<DayAlert, { label: string; detail: string }> = {
  short_break: {
    label: 'Intervalo curto',
    detail: 'Intervalo abaixo do mínimo: 1h para jornada acima de 6h, 15 min acima de 4h (CLT art. 71)',
  },
  overtime_limit: { label: '+2h extras', detail: 'Mais de 2 horas extras no dia (CLT art. 59)' },
  short_rest: { label: 'Descanso < 11h', detail: 'Menos de 11h de descanso desde a jornada anterior (CLT art. 66)' },
};

/** Selos dos alertas da CLT de um dia. */
export function DayAlerts({ alerts }: { alerts: DayAlert[] }) {
  return alerts.map((alert) => (
    <span key={alert} title={alertLabels[alert].detail}>
      <Badge tone="amber">{alertLabels[alert].label}</Badge>
    </span>
  ));
}
