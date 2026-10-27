import { CalendarHeart, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useToast } from '../../components/toast';
import { Alert, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader } from '../../components/ui';
import { errorMessage } from '../../lib/api';
import { formatDate, today, WEEKDAYS } from '../../lib/format';
import { useCreateHoliday, useDeleteHoliday, useHolidays, useImportNationalHolidays } from '../../lib/queries';
import type { Holiday } from '../../lib/types';

const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];

function HolidayFormModal({ year, onClose }: { year: number; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateHoliday();
  const [date, setDate] = useState(String(year) === today().slice(0, 4) ? today() : `${year}-01-01`);
  const [name, setName] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { date, name: name.trim() },
      {
        onSuccess: () => {
          toast('Feriado cadastrado.');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      icon={CalendarHeart}
      title="Novo feriado"
      description="Feriados estaduais, municipais ou folgas da empresa."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="holiday-form" loading={create.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="holiday-form" onSubmit={onSubmit} className="space-y-5">
        {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
        <Field label="Data">
          {(id) => <Input id={id} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Nome" hint="Ex: Aniversário da cidade, Carnaval, Corpus Christi.">
          {(id) => (
            <Input
              id={id}
              required
              maxLength={80}
              placeholder="Nome do feriado"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

function DeleteHolidayModal({ holiday, onClose }: { holiday: Holiday; onClose: () => void }) {
  const toast = useToast();
  const remove = useDeleteHoliday();
  return (
    <Modal
      open
      onClose={onClose}
      icon={Trash2}
      title={`Remover ${holiday.name}?`}
      description={`${weekdayOf(holiday.date)}, ${formatDate(holiday.date)} volta a ser dia normal: quem não trabalhou passa a ter falta.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(holiday.id, {
                onSuccess: () => {
                  toast('Feriado removido.');
                  onClose();
                },
              })
            }
          >
            Remover
          </Button>
        </>
      }
    >
      {remove.isError ? <Alert>{errorMessage(remove.error)}</Alert> : null}
    </Modal>
  );
}

export function HolidaysPage() {
  const toast = useToast();
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const holidays = useHolidays(year);
  const importNational = useImportNationalHolidays();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Holiday | null>(null);
  const todayDate = today();

  const onImport = () =>
    importNational.mutate(year, {
      onSuccess: ({ created }) =>
        toast(created ? `${created} feriado(s) nacional(is) incluído(s).` : 'Os feriados nacionais já estavam cadastrados.'),
      onError: (error) => toast(errorMessage(error), 'error'),
    });

  return (
    <>
      <PageHeader
        icon={CalendarHeart}
        title="Feriados"
        description="Em dia de trabalho, feriado não gera falta e o tempo trabalhado conta como hora extra."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl bg-ink-800 p-1 ring-1 ring-white/10 ring-inset">
              <button
                type="button"
                onClick={() => setYear(year - 1)}
                aria-label="Ano anterior"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-16 text-center text-sm font-semibold text-white tabular-nums">{year}</span>
              <button
                type="button"
                onClick={() => setYear(year + 1)}
                aria-label="Próximo ano"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <Button variant="secondary" icon={Download} loading={importNational.isPending} onClick={onImport}>
              Incluir nacionais
            </Button>
            <Button icon={Plus} onClick={() => setAdding(true)}>
              Novo feriado
            </Button>
          </>
        }
      />

      {holidays.isPending ? (
        <Loading rows={6} />
      ) : holidays.isError ? (
        <Alert>{errorMessage(holidays.error)}</Alert>
      ) : holidays.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarHeart}
            action={
              <Button size="sm" icon={Download} loading={importNational.isPending} onClick={onImport}>
                Incluir feriados nacionais de {year}
              </Button>
            }
          >
            Nenhum feriado em {year}. Sem eles, um feriado em dia útil aparece como falta nos registros.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-white/[0.04]">
            {holidays.data.map((h) => {
              const past = h.date < todayDate;
              return (
                <li key={h.id} className="group flex items-center gap-4 px-4 py-3 sm:px-5">
                  <span
                    className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-xl leading-none ring-1 ring-white/[0.08] ${past ? 'bg-ink-800 text-slate-400' : 'bg-brand-500/15 text-white'}`}
                  >
                    <span className="text-base font-bold">{h.date.slice(8)}</span>
                    <span className="mt-0.5 text-[10px] text-slate-500 uppercase">{weekdayOf(h.date)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${past ? 'text-slate-400' : 'text-white'}`}>{h.name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">{formatDate(h.date)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleting(h)}
                    title="Remover feriado"
                    aria-label={`Remover ${h.name}`}
                    className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {adding && <HolidayFormModal year={year} onClose={() => setAdding(false)} />}
      {deleting && <DeleteHolidayModal holiday={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}
