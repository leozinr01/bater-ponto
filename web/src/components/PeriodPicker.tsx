import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addDays, currentMonth, formatDate, formatMonth, shiftMonth, today } from '../lib/format';
import { Button, cn } from './ui';

/** Mesmo limite da API para consultas por período. */
export const MAX_PERIOD_DAYS = 93;

export type Period = { from: string; to: string };

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;

/** "03/11 – 20/11"; com o ano quando o período não é do ano atual. */
export function formatPeriod({ from, to }: Period) {
  const year = String(new Date().getFullYear());
  const withYear = from.slice(0, 4) !== year || to.slice(0, 4) !== year;
  return `${formatDate(from, withYear)} – ${formatDate(to, withYear)}`;
}

/** Grade do mês (semanas de domingo a sábado), com vazios antes do dia 1. */
function monthGrid(month: string) {
  // O mês inteiro (monthRange corta o mês atual em hoje; aqui os dias futuros aparecem desabilitados)
  const from = `${month}-01`;
  const to = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const offset = new Date(`${from}T12:00:00Z`).getUTCDay();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = from; d <= to; d = addDays(d, 1)) cells.push(d);
  return cells;
}

function Calendar({
  month,
  start,
  end,
  hover,
  maxDate,
  onPick,
  onHover,
}: {
  month: string;
  start: string | null;
  end: string | null;
  hover: string | null;
  maxDate: string;
  onPick: (date: string) => void;
  onHover: (date: string | null) => void;
}) {
  // Enquanto escolhe o fim, o intervalo acompanha o mouse
  const rangeEnd = end ?? (start && hover && hover > start ? hover : null);
  return (
    <div className="grid grid-cols-7 gap-y-1 text-center text-sm" onMouseLeave={() => onHover(null)}>
      {WEEKDAY_INITIALS.map((d, i) => (
        <span key={i} className="pb-1 text-[11px] font-medium text-slate-500">
          {d}
        </span>
      ))}
      {monthGrid(month).map((date, i) => {
        if (!date) return <span key={`v${i}`} />;
        const disabled = date > maxDate;
        const isStart = date === start;
        const isEnd = date === rangeEnd;
        const inRange = !!start && !!rangeEnd && date > start && date < rangeEnd;
        return (
          <button
            key={date}
            type="button"
            disabled={disabled}
            onClick={() => onPick(date)}
            onMouseEnter={() => onHover(date)}
            aria-pressed={isStart || isEnd}
            aria-label={formatDate(date)}
            className={cn(
              'mx-auto flex size-9 items-center justify-center rounded-lg tabular-nums transition-colors',
              isStart || isEnd
                ? 'bg-brand-500 font-semibold text-white'
                : inRange
                  ? 'bg-brand-500/20 text-brand-100'
                  : 'text-slate-200 hover:bg-white/10',
              date === maxDate && !isStart && !isEnd && 'ring-1 ring-brand-400/60 ring-inset',
              disabled && 'pointer-events-none text-slate-700',
            )}
          >
            {Number(date.slice(8))}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Navegação de mês (setas) com o nome do mês clicável: abre um calendário para escolher
 * o dia de início e o de fim. `period` nulo = o mês inteiro.
 */
export function PeriodPicker({
  month,
  period,
  onChange,
}: {
  month: string;
  period: Period | null;
  /** Mês inteiro (`period` nulo) ou um período escolhido no calendário, numa única mudança. */
  onChange: (next: { month: string; period: Period | null }) => void;
}) {
  const maxDate = today();
  const isCurrent = month >= currentMonth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(month);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Ao abrir, começa pelo período aplicado (ou pelo mês)
  const openPicker = () => {
    setView(period ? period.from.slice(0, 7) : month);
    setStart(period?.from ?? null);
    setEnd(period?.to ?? null);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (date: string) => {
    if (!start || end || date < start) {
      setStart(date);
      setEnd(null);
    } else {
      setEnd(date);
    }
  };

  const length = start ? daysBetween(start, end ?? start) : 0;
  const tooLong = length > MAX_PERIOD_DAYS;

  const apply = () => {
    if (!start || tooLong) return;
    onChange({ month, period: { from: start, to: end ?? start } });
    setOpen(false);
  };
  const wholeMonth = (m: string) => {
    onChange({ month: m, period: null });
    setOpen(false);
  };

  // Com período escolhido, as setas voltam a navegar por mês inteiro
  const shift = (delta: number) => {
    const base = period ? period.from.slice(0, 7) : month;
    onChange({ month: shiftMonth(base, delta), period: null });
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1 rounded-xl bg-ink-800 p-1 ring-1 ring-white/10 ring-inset">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Mês anterior"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Escolher o período no calendário"
          className={cn(
            'flex min-w-36 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-white transition-colors hover:bg-white/5',
            period && 'text-brand-200',
          )}
        >
          <CalendarRange className="size-4 text-slate-400" />
          <span className="tabular-nums">{period ? formatPeriod(period) : formatMonth(month)}</span>
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!period && isCurrent}
          aria-label="Próximo mês"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Escolher período"
          // No celular abre como folha acima da barra de abas; no computador, abaixo do botão
          className="animate-fade-in fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 rounded-2xl bg-ink-800 p-4 shadow-2xl ring-1 shadow-black/50 ring-white/10 sm:absolute sm:inset-x-auto sm:right-0 sm:bottom-auto sm:mt-2 sm:w-80"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(shiftMonth(view, -1))}
              aria-label="Mês anterior no calendário"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-white">{formatMonth(view)}</span>
            <button
              type="button"
              onClick={() => setView(shiftMonth(view, 1))}
              disabled={view >= currentMonth()}
              aria-label="Próximo mês no calendário"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <Calendar
            month={view}
            start={start}
            end={end}
            hover={hover}
            maxDate={maxDate}
            onPick={pick}
            onHover={setHover}
          />

          <p className={cn('mt-3 min-h-5 text-center text-xs', tooLong ? 'text-red-300' : 'text-slate-400')}>
            {!start
              ? 'Toque no dia de início'
              : !end
                ? `Início ${formatDate(start, false)} · toque no dia de fim`
                : tooLong
                  ? `${length} dias: o máximo é ${MAX_PERIOD_DAYS}`
                  : `${formatDate(start, false)} a ${formatDate(end, false)} · ${length} dia${length > 1 ? 's' : ''}`}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
            <button
              type="button"
              onClick={() => wholeMonth(currentMonth())}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10 ring-inset hover:bg-white/5"
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => wholeMonth(shiftMonth(currentMonth(), -1))}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10 ring-inset hover:bg-white/5"
            >
              Mês passado
            </button>
            <Button size="sm" className="ml-auto" onClick={apply} disabled={!start || tooLong}>
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
