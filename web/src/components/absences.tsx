import { Ban, HeartPulse } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/api';
import { formatDate } from '../lib/format';
import { useAbsences, useCancelAbsence, useCreateAbsence } from '../lib/queries';
import type { Absence, AbsenceType } from '../lib/types';
import { absenceLabels } from './timesheet';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, cn, Field, Input, Modal, Segmented, Textarea } from './ui';

const TYPE_OPTIONS = (Object.keys(absenceLabels) as AbsenceType[]).map((value) => ({
  value,
  label: absenceLabels[value],
}));

const PLACEHOLDERS: Record<AbsenceType, string> = {
  MEDICAL: 'Ex: atestado médico de 2 dias apresentado ao RH',
  VACATION: 'Ex: férias do período aquisitivo 2025/2026',
  LEAVE: 'Ex: licença-paternidade',
  ALLOWANCE: 'Ex: dispensa autorizada pela gestão para doação de sangue',
  COMPENSATION: 'Ex: folga para compensar as horas extras de setembro',
};

const period = (a: { startDate: string; endDate: string }) =>
  a.startDate === a.endDate ? formatDate(a.startDate) : `${formatDate(a.startDate)} a ${formatDate(a.endDate)}`;

/** Lançamento de atestado, férias, afastamento ou abono de dias inteiros. */
export function AbsenceModal({
  employeeId,
  employeeName,
  defaultDate,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateAbsence();
  const [type, setType] = useState<AbsenceType>('MEDICAL');
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [reason, setReason] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { employeeId, type, startDate, endDate, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(`${absenceLabels[type]} lançado: ${period({ startDate, endDate })}.`);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={HeartPulse}
      title="Lançar abono"
      description={`Dias inteiros para ${employeeName}: não geram falta nem horas previstas.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="absence-form" loading={create.isPending}>
            Lançar
          </Button>
        </>
      }
    >
      <form id="absence-form" onSubmit={onSubmit} className="space-y-4">
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-slate-300">Tipo</span>
          <Segmented value={type} onChange={setType} options={TYPE_OPTIONS} className="flex w-full flex-wrap" />
          {type === 'COMPENSATION' && (
            <p className="mt-1.5 text-xs text-slate-500">Não gera falta e desconta a carga do dia do banco de horas.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De">
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Até" hint="Inclusive.">
            {(id) => (
              <Input
                id={id}
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Justificativa" hint="Obrigatória (mínimo de 5 caracteres). Fica registrada com o lançamento.">
          {(id) => (
            <Textarea
              id={id}
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={PLACEHOLDERS[type]}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function CancelAbsenceModal({ absence, onClose }: { absence: Absence; onClose: () => void }) {
  const toast = useToast();
  const cancel = useCancelAbsence();
  return (
    <Modal
      open
      onClose={onClose}
      icon={Ban}
      title={`Cancelar ${absenceLabels[absence.type].toLowerCase()}?`}
      description={`${period(absence)}: os dias de trabalho voltam a contar como falta se não houver marcação. O lançamento fica no histórico como cancelado.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="danger"
            loading={cancel.isPending}
            onClick={() =>
              cancel.mutate(absence.id, {
                onSuccess: () => {
                  toast('Lançamento cancelado.');
                  onClose();
                },
              })
            }
          >
            Cancelar lançamento
          </Button>
        </>
      }
    >
      {cancel.isError ? <Alert>{errorMessage(cancel.error)}</Alert> : null}
    </Modal>
  );
}

/** Abonos que tocam o período; some quando não há nenhum. */
export function AbsencesCard({
  employeeId,
  from,
  to,
  canManage,
}: {
  employeeId?: string;
  from: string;
  to: string;
  canManage: boolean;
}) {
  const absences = useAbsences({ employeeId, from, to });
  const [canceling, setCanceling] = useState<Absence | null>(null);
  if (!absences.data?.length) return null;

  return (
    <Card className="overflow-hidden print:hidden">
      <div className="border-b border-white/[0.06] px-4 py-2.5 sm:px-5">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Abonos e afastamentos</p>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {absences.data.map((a) => (
          <li key={a.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', a.canceled && 'opacity-50')}>
            <Badge tone={a.canceled ? 'gray' : 'blue'} dot>
              {absenceLabels[a.type]}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm text-white tabular-nums', a.canceled && 'line-through')}>{period(a)}</p>
              <p className="truncate text-xs text-slate-500" title={a.reason}>
                {a.reason}
                {a.createdByName && ` · por ${a.createdByName}`}
                {a.canceled && ' · cancelado'}
              </p>
            </div>
            {canManage && !a.canceled && (
              <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCanceling(a)}>
                Cancelar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canceling && <CancelAbsenceModal absence={canceling} onClose={() => setCanceling(null)} />}
    </Card>
  );
}
