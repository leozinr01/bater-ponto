import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useServerNow } from './clock';
import { addDays, currentMonth, dateOf, formatDate, monthRange, timeOf, today } from './format';
import { usePendingPunches } from './offline-queue';
import { useTimesheet, useToday } from './queries';
import type { Timesheet, TodayOverview } from './types';

/** Até quanto tempo depois do horário de entrada o aviso "bater a entrada" vale. */
const ENTRY_WINDOW_MINUTES = 120;
/** Faltas mais antigas que isso não viram aviso (já estão nos Registros). */
const ABSENCE_LOOKBACK_DAYS = 7;
/** Avisos lidos (abertos ou marcados) e avisos já mostrados no alerta de entrada, por usuário. */
const READ_KEY = 'ponto.avisos-lidos';
const ALERTED_KEY = 'ponto.avisos-alertados';
const CHANGED_EVENT = 'ponto:avisos-lidos';
/** Lidos mais antigos que isso saem do armazenamento (o aviso já não existe mais). */
const KEEP_DAYS = 45;

export type NotificationTone = 'brand' | 'amber' | 'red';

export interface AppNotification {
  /** Estável enquanto a situação for a mesma: é o que marca o aviso como visto. */
  id: string;
  tone: NotificationTone;
  title: string;
  text: string;
  /** Tela que resolve o aviso. */
  to: string;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Avisos do próprio funcionário a partir do espelho do mês. */
export function ownNotifications(sheet: Timesheet, now: Date, pendingOffline: number): AppNotification[] {
  const list: AppNotification[] = [];
  const tz = sheet.timezone;
  const date = today(tz);
  const day = sheet.days.find((d) => d.date === date);
  const schedule = sheet.schedule;

  if (pendingOffline > 0) {
    list.push({
      id: `offline-${date}`,
      tone: 'amber',
      title: 'Batida aguardando internet',
      text:
        pendingOffline === 1
          ? '1 batida foi guardada sem internet e será enviada quando a conexão voltar.'
          : `${pendingOffline} batidas foram guardadas sem internet e serão enviadas quando a conexão voltar.`,
      to: '/',
    });
  }

  if (schedule) {
    const localTime = now.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const sinceStart = toMinutes(localTime) - toMinutes(schedule.startTime);
    const workDay = schedule.workDays.includes(new Date(`${date}T12:00:00Z`).getUTCDay());
    const excused = !!day && (!!day.holiday || !!day.absence);
    const noPunchYet = (!day || day.punches.length === 0) && pendingOffline === 0;
    if (workDay && !excused && noPunchYet && sinceStart >= 0 && sinceStart <= ENTRY_WINDOW_MINUTES) {
      list.push({
        id: `entrada-${date}`,
        tone: 'brand',
        title: 'Hora de bater a entrada',
        text: `Sua jornada começa às ${schedule.startTime}.`,
        to: '/',
      });
    }

    const open = day?.periods.find((p) => p.end === null);
    const worked =
      (day?.workedMinutes ?? 0) +
      (open ? Math.max(0, Math.floor((now.getTime() - new Date(open.start).getTime()) / 60_000)) : 0);
    if (open && day?.expectedMinutes && worked >= day.expectedMinutes) {
      list.push({
        id: `saida-${date}`,
        tone: 'brand',
        title: 'Jornada cumprida',
        text: 'Você já completou as horas de hoje. Não esqueça de registrar a saída.',
        to: '/',
      });
    }
  }

  const since = addDays(date, -ABSENCE_LOOKBACK_DAYS);
  for (const d of [...sheet.days].reverse()) {
    if (d.status === 'incomplete') {
      list.push({
        id: `incompleto-${d.date}`,
        tone: 'amber',
        title: 'Marcação faltando',
        text: `O dia ${formatDate(d.date, false)} tem uma entrada sem saída (ou o contrário). Peça a correção ao administrador.`,
        to: `/registros?mes=${d.date.slice(0, 7)}`,
      });
    } else if (d.status === 'absent' && d.date >= since) {
      list.push({
        id: `falta-${d.date}`,
        tone: 'red',
        title: 'Falta registrada',
        text: `Nenhuma marcação em ${formatDate(d.date, false)}, dia de trabalho.`,
        to: `/registros?mes=${d.date.slice(0, 7)}`,
      });
    }
  }
  return list;
}

/** Avisos do administrador a partir do painel do dia. */
export function adminNotifications(overview: TodayOverview): AppNotification[] {
  const list: AppNotification[] = [];
  // Um aviso por pessoa: ler o atraso de uma não esconde o de quem se atrasar depois
  for (const e of overview.employees.filter((e) => e.status === 'late')) {
    list.push({
      id: `atraso-${overview.date}-${e.employee.id}`,
      tone: 'red',
      title: `${e.employee.name.split(' ')[0]} está atrasado(a)`,
      text: e.expectedStart
        ? `Entrada prevista às ${e.expectedStart} e ainda sem marcação hoje.`
        : 'Ainda sem marcação hoje.',
      to: '/admin/hoje',
    });
  }
  // Por pessoa e quantidade: uma nova batida fora do local volta a avisar
  for (const e of overview.employees.filter((e) => e.outsideLocationPunches > 0)) {
    const times = e.outsideLocationTimes.join(', ');
    list.push({
      id: `fora-${overview.date}-${e.employee.id}-${e.outsideLocationPunches}`,
      tone: 'amber',
      title: `Batida fora do local: ${e.employee.name.split(' ')[0]}`,
      text: times ? `Marcação longe dos locais de trabalho às ${times}.` : 'Marcação longe dos locais de trabalho.',
      to: `/registros?funcionario=${e.employee.id}`,
    });
  }
  // O horário da batida offline vem do celular: o admin confere se faz sentido
  for (const p of overview.offlinePunches ?? []) {
    list.push({
      id: `batida-offline-${p.id}`,
      tone: 'amber',
      title: `Batida offline de ${p.employee.name.split(' ')[0]}`,
      text: `Horário informado pelo celular: ${formatDate(dateOf(p.localTime), false)} às ${timeOf(p.localTime)} (recebida às ${timeOf(p.receivedAt)}). Confira se está correta.`,
      to: `/registros?funcionario=${p.employee.id}&mes=${p.localTime.slice(0, 7)}`,
    });
  }
  return list;
}

type Marks = Record<string, number>;

function readMarks(key: string): Marks {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Marks) : {};
  } catch {
    return {};
  }
}

/**
 * Acrescenta ids às marcas (nunca apaga os que não estão na tela agora: um aviso que some
 * por um instante, como numa recarga dos dados, não pode voltar como novo) e descarta os antigos.
 */
function addMarks(key: string, ids: string[]) {
  const marks = readMarks(key);
  const now = Date.now();
  for (const id of ids) marks[id] ??= now;
  const limit = now - KEEP_DAYS * 86_400_000;
  for (const [id, at] of Object.entries(marks)) if (at < limit) delete marks[id];
  try {
    localStorage.setItem(key, JSON.stringify(marks));
  } catch {
    // sem armazenamento: vale só enquanto a página estiver aberta
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
  return marks;
}

/**
 * Avisos do usuário logado, gerados a partir dos dados do site (nada fica guardado no servidor).
 * `unread` são os ainda não lidos neste aparelho por este usuário: abrir um aviso (`markRead`)
 * o tira da lista de vez. `notAlerted` são os não lidos que o alerta de entrada ainda não mostrou.
 */
export function useNotifications() {
  const { user, isAdmin } = useAuth();
  const now = useServerNow(30_000);
  const { from } = monthRange(currentMonth());
  const sheet = useTimesheet({ from, to: today() });
  const overview = useToday(isAdmin);
  const pending = usePendingPunches();
  const readKey = `${READ_KEY}.${user?.id ?? ''}`;
  const alertedKey = `${ALERTED_KEY}.${user?.id ?? ''}`;
  const [read, setRead] = useState<Marks>(() => readMarks(readKey));
  const [alerted, setAlerted] = useState<Marks>(() => readMarks(alertedKey));

  const items = useMemo(
    () => [
      ...(sheet.data ? ownNotifications(sheet.data, now, pending.length) : []),
      ...(isAdmin && overview.data ? adminNotifications(overview.data) : []),
    ],
    [sheet.data, overview.data, isAdmin, now, pending.length],
  );
  const unread = items.filter((n) => !(n.id in read));
  const notAlerted = unread.filter((n) => !(n.id in alerted));

  // Outro sininho desta tela (ou outra aba) marcou como lido; ou trocou o usuário
  useEffect(() => {
    const sync = () => {
      setRead(readMarks(readKey));
      setAlerted(readMarks(alertedKey));
    };
    sync();
    const onStorage = (e: StorageEvent) => (e.key === readKey || e.key === alertedKey) && sync();
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGED_EVENT, sync);
    };
  }, [readKey, alertedKey]);

  const markRead = useCallback((ids: string[]) => setRead(addMarks(readKey, ids)), [readKey]);
  const markAllRead = useCallback(() => setRead(addMarks(readKey, items.map((n) => n.id))), [readKey, items]);
  const markAlerted = useCallback((ids: string[]) => setAlerted(addMarks(alertedKey, ids)), [alertedKey]);

  const ready = sheet.isSuccess && (!isAdmin || overview.isSuccess);
  return { items, unread, notAlerted, markRead, markAllRead, markAlerted, ready };
}

/** Som curto de aviso (dois tons), sem arquivo de áudio. Silencioso se o navegador bloquear. */
export function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.16;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // áudio indisponível: o aviso visual basta
  }
}
