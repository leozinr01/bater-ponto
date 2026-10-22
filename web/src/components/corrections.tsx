import { useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { dateOf, formatDate, timeOf, today, zonedIso } from '../lib/format';
import { useManualPunch, useReplacePunch, useVoidPunch } from '../lib/queries';
import { useToast } from './toast';
import { Alert, Button, cn, Field, Input, Modal, Textarea } from './ui';

const REASON_HINT = 'Obrigatória (mínimo de 5 caracteres). Fica registrada junto com a correção.';

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Justificativa" hint={REASON_HINT}>
      {(id) => (
        <Textarea
          id={id}
          required
          minLength={5}
          maxLength={500}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: funcionário esqueceu de marcar a saída (confirmado pelo gestor)"
        />
      )}
    </Field>
  );
}

function DateTimeFields({
  date,
  time,
  onDate,
  onTime,
  timezone,
}: {
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  timezone: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Data">
        {(id) => (
          <Input id={id} type="date" required max={today(timezone)} value={date} onChange={(e) => onDate(e.target.value)} />
        )}
      </Field>
      <Field label="Horário" hint={`Fuso ${timezone}`}>
        {(id) => <Input id={id} type="time" required value={time} onChange={(e) => onTime(e.target.value)} />}
      </Field>
    </div>
  );
}

/** Inclusão de uma marcação faltante. */
export function AddPunchModal({
  open,
  onClose,
  employeeId,
  employeeName,
  defaultDate,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  defaultDate: string;
  timezone: string;
}) {
  const toast = useToast();
  const manual = useManualPunch();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    manual.mutate(
      { employeeId, timestamp: zonedIso(date, time, timezone), reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`Marcação das ${time} de ${formatDate(date)} incluída.`);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Incluir marcação"
      description={`Inclui uma marcação faltante para ${employeeName}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="add-punch" loading={manual.isPending}>
            Incluir marcação
          </Button>
        </>
      }
    >
      <form id="add-punch" onSubmit={onSubmit} className="space-y-4">
        {manual.isError && <Alert>{errorMessage(manual.error)}</Alert>}
        <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} timezone={timezone} />
        <ReasonField value={reason} onChange={setReason} />
      </form>
    </Modal>
  );
}

/** Troca de horário ou desconsideração de uma marcação existente. */
export function EditPunchModal({
  open,
  onClose,
  punch,
  employeeName,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  punch: { id: string; localTime: string };
  employeeName: string;
  timezone: string;
}) {
  const toast = useToast();
  const replace = useReplacePunch();
  const voidPunch = useVoidPunch();
  const [mode, setMode] = useState<'replace' | 'void'>('replace');
  const [date, setDate] = useState(dateOf(punch.localTime));
  const [time, setTime] = useState(timeOf(punch.localTime));
  const [reason, setReason] = useState('');

  const mutation = mode === 'replace' ? replace : voidPunch;
  const original = `${timeOf(punch.localTime)} de ${formatDate(dateOf(punch.localTime))}`;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const done = (message: string) => {
      toast(message);
      onClose();
    };
    if (mode === 'replace') {
      replace.mutate(
        { id: punch.id, timestamp: zonedIso(date, time, timezone), reason: reason.trim() },
        { onSuccess: () => done(`Marcação das ${original} trocada para ${time}.`) },
      );
    } else {
      voidPunch.mutate(
        { id: punch.id, reason: reason.trim() },
        { onSuccess: () => done(`Marcação das ${original} desconsiderada.`) },
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Marcação das ${original}`}
      description={`${employeeName}. A marcação original é mantida no histórico.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-punch"
            variant={mode === 'void' ? 'danger' : 'primary'}
            loading={mutation.isPending}
          >
            {mode === 'replace' ? 'Trocar horário' : 'Desconsiderar'}
          </Button>
        </>
      }
    >
      <form id="edit-punch" onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {(
            [
              ['replace', 'Trocar horário'],
              ['void', 'Desconsiderar'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mutation.isError && <Alert>{errorMessage(mutation.error)}</Alert>}
        {mode === 'replace' ? (
          <DateTimeFields date={date} time={time} onDate={setDate} onTime={setTime} timezone={timezone} />
        ) : (
          <Alert tone="warning">
            A marcação deixa de contar no cálculo. Use quando ela foi feita por engano (ex: duplicada).
          </Alert>
        )}
        <ReasonField value={reason} onChange={setReason} />
      </form>
    </Modal>
  );
}
