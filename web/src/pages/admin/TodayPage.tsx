import { AlarmClock, ArrowRight, Coffee, HeartPulse, LayoutDashboard, LogOut, Moon, RefreshCw, Timer, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Avatar, Badge, Button, Card, cn, EmptyState, Loading, PageHeader, type Icon } from '../../components/ui';
import { absenceLabels } from '../../components/timesheet';
import { errorMessage } from '../../lib/api';
import { useServerNow } from '../../lib/clock';
import { formatDate, formatMinutes, timeOf, WEEKDAYS } from '../../lib/format';
import { useToday } from '../../lib/queries';
import type { PresenceStatus, TodayEmployee } from '../../lib/types';

const presence: Record<
  PresenceStatus,
  { label: string; tone: 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'brand'; icon: Icon; order: number }
> = {
  late: { label: 'Atrasado', tone: 'red', icon: AlarmClock, order: 0 },
  working: { label: 'Trabalhando', tone: 'green', icon: Timer, order: 1 },
  on_break: { label: 'Em intervalo', tone: 'amber', icon: Coffee, order: 2 },
  not_started: { label: 'Ainda não chegou', tone: 'gray', icon: Users, order: 3 },
  finished: { label: 'Encerrou o dia', tone: 'blue', icon: LogOut, order: 4 },
  day_off: { label: 'Folga', tone: 'gray', icon: Moon, order: 5 },
  away: { label: 'Afastado', tone: 'blue', icon: HeartPulse, order: 6 },
};

function liveMinutes(item: TodayEmployee, now: number) {
  if (!item.workingSince) return item.workedMinutes;
  return item.workedMinutes + Math.max(0, Math.floor((now - new Date(item.workingSince).getTime()) / 60_000));
}

function StatButton({
  status,
  count,
  active,
  onClick,
}: {
  status: PresenceStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const { label, icon: IconCmp, tone } = presence[status];
  const accent = {
    green: 'text-emerald-300 bg-emerald-500/15',
    amber: 'text-amber-300 bg-amber-500/15',
    red: 'text-red-300 bg-red-500/15',
    blue: 'text-sky-300 bg-sky-500/15',
    gray: 'text-slate-300 bg-white/5',
    brand: 'text-brand-300 bg-brand-500/15',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-2xl bg-ink-850 p-4 text-left shadow-xl shadow-black/10 ring-1 transition-all hover:-translate-y-0.5 active:scale-[0.98]',
        active ? 'ring-2 ring-brand-400' : 'ring-white/[0.06] hover:ring-white/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-400">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', accent)}>
          <IconCmp className="size-4" />
        </span>
      </div>
      <p className={cn('mt-2 text-3xl font-bold tracking-tight tabular-nums', count ? accent.split(' ')[0] : 'text-slate-600')}>
        {count}
      </p>
    </button>
  );
}

function EmployeeRow({ item, now }: { item: TodayEmployee; now: number }) {
  const { label, tone } = presence[item.status];
  const worked = liveMinutes(item, now);
  const progress = item.expectedMinutes ? Math.min(100, (worked / item.expectedMinutes) * 100) : null;

  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-white/[0.02] sm:px-5">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        <Avatar name={item.employee.name} />
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{item.employee.name}</p>
          <p className="truncate text-xs text-slate-500">
            {item.scheduleName
              ? `${item.scheduleName}${item.expectedStart ? ` · entrada ${item.expectedStart}` : ''}`
              : 'Sem jornada'}
          </p>
        </div>
      </div>

      <div className="flex basis-40 items-center gap-2">
        <Badge tone={tone} dot>
          {item.absenceType ? absenceLabels[item.absenceType] : label}
        </Badge>
        {item.lateMinutes ? <span className="text-[11px] text-amber-300">+{formatMinutes(item.lateMinutes)}</span> : null}
      </div>

      <p className="basis-40 text-xs text-slate-400 tabular-nums">
        {item.firstPunch ? (
          <>
            Entrada <span className="font-semibold text-slate-200">{timeOf(item.firstPunch)}</span>
            {item.lastPunch && item.lastPunch !== item.firstPunch && (
              <>
                {' '}
                · última <span className="font-semibold text-slate-200">{timeOf(item.lastPunch)}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-slate-600">Nenhuma marcação</span>
        )}
      </p>

      <div className="flex basis-36 items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold text-white tabular-nums">
            {worked ? formatMinutes(worked) : <span className="text-slate-600">–</span>}
            {item.expectedMinutes ? (
              <span className="text-xs font-normal text-slate-500"> / {formatMinutes(item.expectedMinutes)}</span>
            ) : null}
          </p>
          {progress !== null && (
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn('h-full rounded-full', progress >= 100 ? 'bg-emerald-400' : 'bg-brand-400')}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <Link
          to={`/registros?funcionario=${item.employee.id}`}
          title="Ver registros"
          aria-label={`Ver registros de ${item.employee.name}`}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-brand-500/10 hover:text-brand-200"
        >
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </li>
  );
}

const STAT_ORDER: PresenceStatus[] = ['working', 'on_break', 'late', 'not_started', 'finished', 'day_off', 'away'];

export function TodayPage() {
  const today = useToday();
  // Avança a cada 30 s, para o tempo trabalhado correr na tela
  const now = useServerNow(30_000).getTime();
  const [filter, setFilter] = useState<PresenceStatus | null>(null);
  const data = today.data;

  const items = (data?.employees ?? [])
    .filter((i) => !filter || i.status === filter)
    .sort((a, b) => presence[a.status].order - presence[b.status].order || a.employee.name.localeCompare(b.employee.name));
  const present = data ? data.counts.working + data.counts.on_break : 0;
  const expected = data ? data.employees.filter((i) => i.status !== 'day_off' && i.status !== 'away').length : 0;

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Hoje"
        description={
          data
            ? `${WEEKDAYS[new Date(`${data.date}T12:00:00Z`).getUTCDay()]}, ${formatDate(data.date)} · ${present} de ${expected} presentes · atualizado às ${timeOf(data.now)}`
            : 'Quem está trabalhando agora.'
        }
        actions={
          <Button variant="secondary" icon={RefreshCw} loading={today.isFetching} onClick={() => today.refetch()}>
            Atualizar
          </Button>
        }
      />

      {today.isPending ? (
        <Loading />
      ) : today.isError || !data ? (
        <Alert>{errorMessage(today.error)}</Alert>
      ) : (
        <div className="space-y-6">
          {data.holiday && <Alert tone="info">Hoje é feriado: {data.holiday}.</Alert>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {STAT_ORDER.map((status) => (
              <StatButton
                key={status}
                status={status}
                count={data.counts[status]}
                active={filter === status}
                onClick={() => setFilter(filter === status ? null : status)}
              />
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-white">
                {filter ? presence[filter].label : 'Equipe'}{' '}
                <span className="font-normal text-slate-500">· {items.length}</span>
              </h2>
              {filter && (
                <button
                  type="button"
                  onClick={() => setFilter(null)}
                  className="text-xs font-medium text-brand-300 hover:text-brand-200"
                >
                  Mostrar todos
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <EmptyState icon={Users}>
                {filter ? 'Ninguém nesta situação agora.' : 'Nenhum funcionário ativo.'}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {items.map((item) => (
                  <EmployeeRow key={item.employee.id} item={item} now={now} />
                ))}
              </ul>
            )}
          </Card>
          <p className="text-xs text-slate-500">
            Atrasado = dia de trabalho, passou do horário de entrada mais a tolerância e ainda não marcou. Em intervalo =
            saiu e ainda não cumpriu a carga do dia. Atualiza sozinho a cada minuto.
          </p>
        </div>
      )}
    </>
  );
}
