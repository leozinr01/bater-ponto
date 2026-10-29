import { Ban, History, PencilLine, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { LocationBadge } from '../../components/location';
import { Alert, Badge, Card, cn, EmptyState, Loading, Pagination, Segmented } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { dateOf, formatDate, formatDateTime, monthRange, timeOf, WEEKDAYS } from '../../lib/format';
import { usePunches } from '../../lib/queries';
import type { Punch } from '../../lib/types';

/** Agrupa as marcações (já em ordem decrescente) pela data local. */
function groupByDate(punches: Punch[]) {
  const groups: { date: string; punches: Punch[] }[] = [];
  for (const p of punches) {
    const date = dateOf(p.localTime);
    const last = groups.at(-1);
    if (last?.date === date) last.punches.push(p);
    else groups.push({ date, punches: [p] });
  }
  return groups;
}

function PunchRow({ punch }: { punch: Punch }) {
  const isCorrection = punch.source === 'ADMIN';
  const IconCmp = punch.voided ? Ban : isCorrection ? PencilLine : ShieldCheck;
  return (
    <li className={cn('flex items-center gap-4 px-5 py-3', punch.voided && 'opacity-60')}>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
          punch.voided
            ? 'bg-red-500/10 text-red-300 ring-red-500/20'
            : isCorrection
              ? 'bg-brand-500/10 text-brand-300 ring-brand-500/20'
              : 'bg-white/5 text-slate-400 ring-white/10',
        )}
      >
        <IconCmp className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-lg font-semibold text-white tabular-nums', punch.voided && 'line-through')}>
            {timeOf(punch.localTime)}
          </span>
          {isCorrection && (
            <Badge tone="brand">{punch.replacesId ? 'Correção: troca de horário' : 'Correção: inclusão'}</Badge>
          )}
          {punch.voided && (
            <Badge tone="red" dot>
              Desconsiderada
            </Badge>
          )}
          {punch.location && <LocationBadge location={punch.location} />}
        </div>
        {(punch.reason || punch.voided) && (
          <div className="mt-1 space-y-0.5 text-xs text-slate-400">
            {punch.reason && <p>Motivo: {punch.reason}</p>}
            {punch.voided && (
              <p>
                Desconsiderada em {punch.voidedAt && formatDateTime(punch.voidedAt)}: {punch.voidReason}
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Todas as marcações do mês, inclusive correções e desconsideradas, agrupadas por dia. */
export function PunchesView({ employeeId, month }: { employeeId: string; month: string }) {
  const { from, to } = monthRange(month);
  const [show, setShow] = useState<'all' | 'valid'>('all');
  const [page, setPage] = useState(1);

  const punches = usePunches({
    employeeId: employeeId || undefined,
    from,
    to,
    includeVoided: show === 'all',
    page,
    pageSize: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Segmented
          value={show}
          onChange={(v) => {
            setShow(v);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'valid', label: 'Só válidas' },
          ]}
        />
      </div>

      {punches.isPending ? (
        <Loading rows={8} />
      ) : punches.isError ? (
        <Alert>{errorMessage(punches.error)}</Alert>
      ) : punches.data.data.length === 0 ? (
        <Card>
          <EmptyState icon={History}>Nenhuma marcação neste mês.</EmptyState>
        </Card>
      ) : (
        <div className={cn('space-y-4 transition-opacity', punches.isFetching && 'opacity-60')}>
          {groupByDate(punches.data.data).map(({ date, punches: dayPunches }) => {
            const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
            return (
              <Card key={date} className="overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 flex-col items-center justify-center rounded-xl bg-ink-800 leading-none ring-1 ring-white/10">
                      <span className="text-sm font-bold text-white">{date.slice(8)}</span>
                      <span className="mt-0.5 text-[10px] text-slate-500 uppercase">{WEEKDAYS[weekday]}</span>
                    </span>
                    <span className="text-sm font-medium text-slate-200">{formatDate(date)}</span>
                  </div>
                </div>
                <ul className="divide-y divide-white/[0.04]">
                  {dayPunches.map((p) => (
                    <PunchRow key={p.id} punch={p} />
                  ))}
                </ul>
              </Card>
            );
          })}
          <Card>
            <Pagination
              page={punches.data.meta.page}
              totalPages={punches.data.meta.totalPages}
              total={punches.data.meta.total}
              onChange={setPage}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
