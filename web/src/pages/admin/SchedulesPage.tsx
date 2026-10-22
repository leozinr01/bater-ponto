import { CalendarClock, Clock, Hourglass, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/toast';
import { Alert, Button, Card, cn, EmptyState, Field, Input, Loading, Modal, PageHeader } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { durationInput, formatDuration, parseDuration, WEEKDAYS } from '../../lib/format';
import { useSaveSchedule, useSchedules } from '../../lib/queries';
import type { WorkSchedule } from '../../lib/types';

// Segunda primeiro, como no calendário comercial
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function ScheduleFormModal({ schedule, onClose }: { schedule: WorkSchedule | null; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveSchedule();
  const [name, setName] = useState(schedule?.name ?? '');
  const [startTime, setStartTime] = useState(schedule?.startTime ?? '08:00');
  const [daily, setDaily] = useState(durationInput(schedule?.dailyMinutes ?? 480));
  const [workDays, setWorkDays] = useState<number[]>(schedule?.workDays ?? [1, 2, 3, 4, 5]);
  const [lateTolerance, setLateTolerance] = useState(schedule?.lateToleranceMinutes ?? 10);
  const [overtimeTolerance, setOvertimeTolerance] = useState(schedule?.overtimeToleranceMinutes ?? 10);

  const toggleDay = (d: number) =>
    setWorkDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: schedule?.id,
        name: name.trim(),
        startTime,
        dailyMinutes: parseDuration(daily),
        workDays,
        lateToleranceMinutes: lateTolerance,
        overtimeToleranceMinutes: overtimeTolerance,
      },
      {
        onSuccess: () => {
          toast(schedule ? 'Jornada atualizada.' : 'Jornada cadastrada.');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={schedule ? Pencil : CalendarClock}
      title={schedule ? `Editar ${schedule.name}` : 'Nova jornada'}
      description="Usada nos registros para calcular atrasos, horas extras e faltas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="schedule-form" loading={save.isPending} disabled={workDays.length === 0}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={onSubmit} className="space-y-5">
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        {schedule && (
          <Alert tone="info">
            Os registros sempre usam a jornada atual, inclusive nos meses passados de quem a utiliza.
          </Alert>
        )}
        <Field label="Nome">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={80}
              placeholder="Ex: Comercial 44h"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entrada prevista" hint="Base para calcular atrasos.">
            {(id) => (
              <Input id={id} type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            )}
          </Field>
          <Field label="Carga diária" hint="Horas:minutos por dia.">
            {(id) => (
              <Input
                id={id}
                required
                pattern="\d{1,2}:[0-5]\d"
                placeholder="08:00"
                value={daily}
                onChange={(e) => setDaily(e.target.value)}
              />
            )}
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-300">Dias de trabalho</span>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={workDays.includes(d)}
                className={cn(
                  'rounded-xl py-2.5 text-sm font-medium ring-1 ring-inset transition-all active:scale-95',
                  workDays.includes(d)
                    ? 'bg-brand-500 text-white ring-brand-400 shadow-lg shadow-brand-500/20'
                    : 'bg-ink-800 text-slate-400 ring-white/10 hover:text-white',
                )}
              >
                {WEEKDAYS[d]}
              </button>
            ))}
          </div>
          {workDays.length === 0 && <p className="mt-1.5 text-xs text-red-400">Selecione pelo menos um dia.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tolerância de atraso" hint="Em minutos (0 a 120).">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={120}
                required
                value={lateTolerance}
                onChange={(e) => setLateTolerance(Number(e.target.value))}
              />
            )}
          </Field>
          <Field label="Tolerância de saldo" hint="Extra ou falta diária ignorada.">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                max={120}
                required
                value={overtimeTolerance}
                onChange={(e) => setOvertimeTolerance(Number(e.target.value))}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function SchedulesPage() {
  const schedules = useSchedules();
  const [editing, setEditing] = useState<WorkSchedule | 'new' | null>(null);

  return (
    <>
      <PageHeader
        icon={CalendarClock}
        title="Jornadas de trabalho"
        description="Entrada, carga diária, dias e tolerâncias usados no cálculo dos registros."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Nova jornada
          </Button>
        }
      />

      {schedules.isPending ? (
        <Loading rows={3} />
      ) : schedules.isError ? (
        <Alert>{errorMessage(schedules.error)}</Alert>
      ) : schedules.data.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarClock}
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
                Criar primeira jornada
              </Button>
            }
          >
            Nenhuma jornada cadastrada. Crie uma para calcular atrasos, extras e faltas.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.data.data.map((s) => (
            <Card
              key={s.id}
              className="group relative flex flex-col overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:ring-brand-400/30"
            >
              <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-brand-500/10 blur-2xl transition-opacity group-hover:opacity-100 sm:opacity-0" />
              <div className="relative flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-white">{s.name}</h2>
                  <p className="text-xs text-slate-500">{s.workDays.length} dias por semana</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  title="Editar jornada"
                  aria-label={`Editar ${s.name}`}
                  className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Pencil className="size-4" />
                </button>
              </div>

              <div className="relative mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-white">{formatDuration(s.dailyMinutes)}</span>
                <span className="text-sm text-slate-500">por dia</span>
              </div>

              <div className="relative mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
                  <Clock className="size-4 text-slate-500" />
                  <span className="text-slate-300">
                    Entrada <span className="font-semibold text-white tabular-nums">{s.startTime}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 ring-1 ring-white/[0.06]">
                  <Hourglass className="size-4 text-slate-500" />
                  <span className="text-slate-300">
                    <span className="font-semibold text-white">{s.lateToleranceMinutes}</span> min tol.
                  </span>
                </div>
              </div>

              <div className="relative mt-4 flex gap-1">
                {WEEK_ORDER.map((d) => (
                  <span
                    key={d}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-center text-xs font-medium',
                      s.workDays.includes(d)
                        ? 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-400/20'
                        : 'bg-white/[0.02] text-slate-600',
                    )}
                  >
                    {WEEKDAYS[d]}
                  </span>
                ))}
              </div>
              <p className="relative mt-4 text-xs text-slate-500">
                Saldo diário de até {s.overtimeToleranceMinutes} min é ignorado.
              </p>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <ScheduleFormModal schedule={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
