import { BellRing, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useServerNow } from '../lib/clock';
import { today } from '../lib/format';
import { usePendingPunches } from '../lib/offline-queue';
import { useTimesheet } from '../lib/queries';

/** Mesma janela do lembrete por push/e-mail: até 2h depois do horário de entrada. */
const ENTRY_WINDOW_MINUTES = 120;

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function dismissedKey(date: string, kind: string) {
  return `ponto.lembrete-dispensado.${date}.${kind}`;
}

/**
 * Faixa no topo de qualquer tela: "hora de bater a entrada" ou "registre a saída".
 * Funciona em qualquer aparelho, sem permissão de notificação, para quem está com o site aberto.
 * Pode ser dispensada; volta no dia seguinte.
 */
export function ReminderBanner() {
  const { pathname } = useLocation();
  const now = useServerNow(30_000);
  const date = today();
  const sheet = useTimesheet({ from: date, to: date });
  const pending = usePendingPunches();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const data = sheet.data;
  const todayDate = today(data?.timezone);
  // Sem batida, o dia de hoje ainda não aparece no espelho (só feriado/abono aparecem)
  const day = data?.days.find((d) => d.date === todayDate);
  const schedule = data?.schedule;
  if (!data || !schedule || pending.length > 0) return null;

  const localTime = now.toLocaleTimeString('pt-BR', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' });
  const sinceStart = toMinutes(localTime) - toMinutes(schedule.startTime);
  const workDay = schedule.workDays.includes(new Date(`${todayDate}T12:00:00Z`).getUTCDay());
  const noPunchYet = !day || day.punches.length === 0;
  const excused = !!day && (!!day.holiday || !!day.absence);

  const open = day?.periods.find((p) => p.end === null);
  const worked =
    (day?.workedMinutes ?? 0) +
    (open ? Math.max(0, Math.floor((now.getTime() - new Date(open.start).getTime()) / 60_000)) : 0);

  const reminder =
    workDay && !excused && noPunchYet && sinceStart >= 0 && sinceStart <= ENTRY_WINDOW_MINUTES
      ? { kind: 'entry', text: `Hora de bater a entrada: sua jornada começa às ${schedule.startTime}.` }
      : open && day?.expectedMinutes && worked >= day.expectedMinutes
        ? { kind: 'exit', text: 'Você já completou as horas de hoje. Não esqueça de registrar a saída.' }
        : null;
  if (!reminder) return null;

  const key = dismissedKey(todayDate, reminder.kind);
  let hidden = dismissed.includes(key);
  try {
    hidden ||= localStorage.getItem(key) === '1';
  } catch {
    // sem armazenamento: vale só nesta tela
  }
  if (hidden) return null;

  const dismiss = () => {
    setDismissed((list) => [...list, key]);
    try {
      localStorage.setItem(key, '1');
    } catch {
      // ignora
    }
  };

  return (
    <div
      role="status"
      className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-400/25 print:hidden"
    >
      <BellRing className="size-4 shrink-0 text-amber-300" />
      <p className="min-w-0 flex-1">{reminder.text}</p>
      {pathname !== '/' && (
        <Link
          to="/"
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-amber-300"
        >
          Bater ponto
        </Link>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar aviso"
        className="shrink-0 rounded-lg p-1 text-amber-200/70 transition hover:bg-white/5 hover:text-amber-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
