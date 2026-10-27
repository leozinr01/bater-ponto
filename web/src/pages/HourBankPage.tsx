import { Ban, PiggyBank, Plus, SlidersHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmployeePicker } from '../components/EmployeePicker';
import { useToast } from '../components/toast';
import {
  Alert,
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Segmented,
  table,
  Textarea,
} from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatMinutes, formatMonth, parseDuration, today } from '../lib/format';
import { useCancelHourBankEntry, useCreateHourBankEntry, useHourBank } from '../lib/queries';
import type { HourBankEntry } from '../lib/types';

/** Minutos com sinal e cor: verde = crédito, vermelho = débito. */
function Signed({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span
      className={cn(
        'tabular-nums',
        minutes > 0 ? 'text-emerald-300' : minutes < 0 ? 'text-red-300' : 'text-slate-400',
        className,
      )}
    >
      {minutes > 0 ? '+' : ''}
      {formatMinutes(minutes)}
    </span>
  );
}

function EntryModal({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateHourBankEntry();
  const [kind, setKind] = useState<'debit' | 'credit'>('debit');
  const [date, setDate] = useState(today());
  const [duration, setDuration] = useState('');
  const [reason, setReason] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(duration) * (kind === 'debit' ? -1 : 1);
    create.mutate(
      { employeeId, date, minutes, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Ajuste de ${minutes > 0 ? '+' : ''}${formatMinutes(minutes)} lançado.`);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={SlidersHorizontal}
      title="Ajustar banco de horas"
      description={`Crédito ou débito manual para ${employeeName}, com justificativa.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="hour-bank-entry" loading={create.isPending}>
            Lançar ajuste
          </Button>
        </>
      }
    >
      <form id="hour-bank-entry" onSubmit={onSubmit} className="space-y-4">
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
        <Segmented
          value={kind}
          onChange={setKind}
          className="flex w-full"
          options={[
            { value: 'debit', label: 'Débito (ex.: horas pagas)' },
            { value: 'credit', label: 'Crédito' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" hint="Mês em que entra no saldo.">
            {(id) => <Input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Horas" hint="Horas:minutos.">
            {(id) => (
              <Input
                id={id}
                required
                pattern="\d{1,4}:[0-5]\d"
                placeholder="10:00"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Justificativa" hint="Obrigatória (mínimo de 5 caracteres).">
          {(id) => (
            <Textarea
              id={id}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                kind === 'debit' ? 'Ex: 10h extras pagas na folha de outubro' : 'Ex: crédito acordado com a gestão'
              }
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function CancelEntryModal({ entry, onClose }: { entry: HourBankEntry; onClose: () => void }) {
  const toast = useToast();
  const cancel = useCancelHourBankEntry();
  return (
    <Modal
      open
      onClose={onClose}
      icon={Ban}
      title="Cancelar ajuste?"
      description={`${entry.minutes > 0 ? '+' : ''}${formatMinutes(entry.minutes)} em ${formatDate(entry.date)}: sai do saldo, mas continua no extrato como cancelado.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() =>
              cancel.mutate(entry.id, {
                onSuccess: () => {
                  toast('Ajuste cancelado.');
                  onClose();
                },
              })
            }
          >
            Cancelar ajuste
          </Button>
        </>
      }
    >
      {cancel.isError ? <Alert>{errorMessage(cancel.error)}</Alert> : null}
    </Modal>
  );
}

export function HourBankPage() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const employeeId = (isAdmin && params.get('funcionario')) || '';
  const bank = useHourBank({ employeeId: employeeId || undefined });
  const [adding, setAdding] = useState(false);
  const [canceling, setCanceling] = useState<HourBankEntry | null>(null);
  const data = bank.data;
  const canManage = isAdmin && !!data && data.employee.id !== user?.id;

  return (
    <>
      <PageHeader
        icon={PiggyBank}
        title="Banco de horas"
        description="Saldo acumulado: horas extras − falta de horas − folgas de banco ± ajustes."
        actions={
          <>
            {isAdmin && (
              <EmployeePicker
                value={employeeId}
                onChange={(id) =>
                  setParams(
                    (p) => {
                      if (id) p.set('funcionario', id);
                      else p.delete('funcionario');
                      return p;
                    },
                    { replace: true },
                  )
                }
              />
            )}
            {canManage && (
              <Button icon={Plus} onClick={() => setAdding(true)}>
                Ajustar
              </Button>
            )}
          </>
        }
      />

      {bank.isPending ? (
        <Loading rows={6} />
      ) : bank.isError || !data ? (
        <Alert>{errorMessage(bank.error)}</Alert>
      ) : (
        <div className={cn('space-y-6 transition-opacity', bank.isFetching && 'opacity-60')}>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-4 bg-[radial-gradient(ellipse_at_top_left,rgba(59,109,255,0.15),transparent_60%)] px-5 py-6">
              <div>
                <p className="text-sm text-slate-400">
                  Saldo de {data.employee.name} em {formatDate(data.until)}
                </p>
                <Signed minutes={data.totals.balanceMinutes} className="mt-1 block text-5xl font-bold tracking-tight" />
                <p className="mt-1 text-xs text-slate-500">Desde {formatDate(data.since)}</p>
              </div>
              {data.pendingDays > 0 && (
                <Badge tone="amber" dot>
                  {data.pendingDays} dia(s) incompleto(s) fora do saldo
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 divide-white/[0.06] border-t border-white/[0.06] sm:grid-cols-4 sm:divide-x">
              {(
                [
                  ['Horas extras', data.totals.overtimeMinutes],
                  ['Falta de horas', -data.totals.deficitMinutes],
                  ['Folgas de banco', -data.totals.compensatedMinutes],
                  ['Ajustes', data.totals.adjustmentMinutes],
                ] as const
              ).map(([label, minutes]) => (
                <div key={label} className="px-5 py-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <Signed minutes={minutes} className="text-lg font-semibold" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3">
              <h2 className="text-sm font-semibold text-white">Extrato mensal</h2>
            </div>
            {data.months.length === 0 ? (
              <EmptyState icon={PiggyBank}>Nenhum movimento ainda.</EmptyState>
            ) : (
              <div className={table.wrap}>
                <table className={table.table}>
                  <thead className={table.thead}>
                    <tr>
                      <th className={table.th}>Mês</th>
                      <th className={cn(table.th, 'text-right')}>Extras</th>
                      <th className={cn(table.th, 'text-right')}>Falta</th>
                      <th className={cn(table.th, 'text-right')}>Folgas</th>
                      <th className={cn(table.th, 'text-right')}>Ajustes</th>
                      <th className={cn(table.th, 'text-right')}>No mês</th>
                      <th className={cn(table.th, 'text-right')}>Acumulado</th>
                    </tr>
                  </thead>
                  <tbody className={table.tbody}>
                    {[...data.months].reverse().map((m) => (
                      <tr key={m.month} className={table.tr}>
                        <td className={cn(table.td, 'font-medium whitespace-nowrap text-white')}>
                          {formatMonth(m.month)}
                          {m.pendingDays > 0 && (
                            <span className="ml-2 text-[11px] font-normal text-amber-300">{m.pendingDays} pendente(s)</span>
                          )}
                        </td>
                        <td className={cn(table.td, 'text-right')}>
                          <Signed minutes={m.overtimeMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right')}>
                          <Signed minutes={-m.deficitMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right')}>
                          <Signed minutes={-m.compensatedMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right')}>
                          <Signed minutes={m.adjustmentMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right font-medium')}>
                          <Signed minutes={m.balanceMinutes} />
                        </td>
                        <td className={cn(table.td, 'text-right font-bold')}>
                          <Signed minutes={m.accumulatedMinutes} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.entries.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3">
                <h2 className="text-sm font-semibold text-white">Ajustes</h2>
              </div>
              <ul className="divide-y divide-white/[0.04]">
                {data.entries.map((e) => (
                  <li key={e.id} className={cn('flex items-center gap-3 px-5 py-3', e.canceled && 'opacity-50')}>
                    <Signed minutes={e.minutes} className={cn('w-16 font-semibold', e.canceled && 'line-through')} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white" title={e.reason}>
                        {e.reason}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(e.date)}
                        {e.createdByName && ` · por ${e.createdByName}`}
                        {e.canceled && ' · cancelado'}
                      </p>
                    </div>
                    {canManage && !e.canceled && (
                      <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCanceling(e)}>
                        Cancelar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <p className="text-xs text-slate-500">
            Dias incompletos só entram no saldo depois de corrigidos. Faltas não descontam do banco: aparecem nos registros.
            Para compensar horas com uma folga, lance uma "Folga de banco" nos Registros.
          </p>
        </div>
      )}

      {adding && data && (
        <EntryModal employeeId={data.employee.id} employeeName={data.employee.name} onClose={() => setAdding(false)} />
      )}
      {canceling && <CancelEntryModal entry={canceling} onClose={() => setCanceling(null)} />}
    </>
  );
}
