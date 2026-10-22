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
      title={schedule ? `Editar ${schedule.name}` : 'Nova jornada'}
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
      <form id="schedule-form" onSubmit={onSubmit} className="space-y-4">
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        {schedule && (
          <Alert tone="info">
            O espelho sempre usa a jornada atual, inclusive para períodos passados dos funcionários que a utilizam.
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
          <Field label="Entrada prevista" hint="Usada para calcular atrasos.">
            {(id) => (
              <Input id={id} type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            )}
          </Field>
          <Field label="Carga diária" hint="Horas:minutos de trabalho por dia.">
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
          <span className="mb-1 block text-sm font-medium text-slate-700">Dias de trabalho</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                aria-pressed={workDays.includes(d)}
                className={cn(
                  'w-12 rounded-lg py-1.5 text-sm font-medium ring-1 ring-inset transition-colors',
                  workDays.includes(d)
                    ? 'bg-indigo-600 text-white ring-indigo-600'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
                )}
              >
                {WEEKDAYS[d]}
              </button>
            ))}
          </div>
          {workDays.length === 0 && <p className="mt-1 text-xs text-red-600">Selecione pelo menos um dia.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tolerância de atraso" hint="Minutos (0 a 120).">
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
          <Field label="Tolerância de saldo" hint="Extra/falta diária ignorada, em minutos.">
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
        title="Jornadas de trabalho"
        description="Horário de entrada, carga diária, dias e tolerâncias usados no cálculo do espelho."
        actions={<Button onClick={() => setEditing('new')}>Nova jornada</Button>}
      />

      {schedules.isPending ? (
        <Loading />
      ) : schedules.isError ? (
        <Alert>{errorMessage(schedules.error)}</Alert>
      ) : schedules.data.data.length === 0 ? (
        <Card>
          <EmptyState>Nenhuma jornada cadastrada. Crie uma para calcular atrasos, extras e faltas.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.data.data.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{s.name}</h2>
                <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                  Editar
                </Button>
              </div>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{formatDuration(s.dailyMinutes)}</p>
              <p className="text-sm text-slate-500">por dia, entrada às {s.startTime}</p>
              <div className="mt-4 flex gap-1">
                {WEEK_ORDER.map((d) => (
                  <span
                    key={d}
                    className={cn(
                      'flex-1 rounded py-1 text-center text-xs font-medium',
                      s.workDays.includes(d) ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-300',
                    )}
                  >
                    {WEEKDAYS[d]}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Tolerâncias: {s.lateToleranceMinutes} min de atraso · {s.overtimeToleranceMinutes} min de saldo
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
