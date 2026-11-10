import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useServerNow } from './clock';
import { addDays, currentMonth, formatDate, monthRange, today } from './format';
import { usePendingPunches } from './offline-queue';
import { useTimesheet, useToday } from './queries';
import type { Timesheet, TodayOverview } from './types';

/** Até quanto tempo depois do horário de entrada o aviso "bater a entrada" vale. */
const ENTRY_WINDOW_MINUTES = 120;
/** Faltas mais antigas que isso não viram aviso (já estão nos Registros). */
const ABSENCE_LOOKBACK_DAYS = 7;
const SEEN_KEY = 'ponto.avisos-vistos';
const SEEN_EVENT = 'ponto:avisos-vistos';

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
      id: `offline-${pendingOffline}`,
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
  const late = overview.employees.filter((e) => e.status === 'late');
  if (late.length) {
    list.push({
      id: `atrasados-${overview.date}-${late.map((e) => e.employee.id).join(',')}`,
      tone: 'red',
      title: late.length === 1 ? '1 funcionário atrasado' : `${late.length} funcionários atrasados`,
      text: late
        .map((e) => e.employee.name.split(' ')[0])
        .slice(0, 5)
        .join(', ')
        .concat(late.length > 5 ? '…' : ''),
      to: '/admin/hoje',
    });
  }
  const outside = overview.employees.filter((e) => e.outsideLocationPunches > 0);
  if (outside.length) {
    const total = outside.reduce((sum, e) => sum + e.outsideLocationPunches, 0);
    list.push({
      id: `fora-${overview.date}-${total}`,
      tone: 'amber',
      title: total === 1 ? '1 batida fora do local' : `${total} batidas fora do local`,
      text: outside
        .map((e) => e.employee.name.split(' ')[0])
        .slice(0, 5)
        .join(', '),
      to: '/admin/hoje',
    });
  }
  return list;
}

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/**
 * Avisos do usuário logado, gerados a partir dos dados do site (nada fica guardado no servidor).
 * `unseen` são os que ainda não foram vistos neste aparelho; `markAllSeen` zera o contador.
 */
export function useNotifications() {
  const { isAdmin } = useAuth();
  const now = useServerNow(30_000);
  const { from } = monthRange(currentMonth());
  const sheet = useTimesheet({ from, to: today() });
  const overview = useToday(isAdmin);
  const pending = usePendingPunches();
  const [seen, setSeen] = useState<string[]>(readSeen);

  const items = useMemo(
    () => [
      ...(sheet.data ? ownNotifications(sheet.data, now, pending.length) : []),
      ...(isAdmin && overview.data ? adminNotifications(overview.data) : []),
    ],
    [sheet.data, overview.data, isAdmin, now, pending.length],
  );
  const unseen = items.filter((n) => !seen.includes(n.id));

  // Outro sininho desta tela (ou outra aba) marcou como visto
  useEffect(() => {
    const sync = () => setSeen(readSeen());
    const onStorage = (e: StorageEvent) => e.key === SEEN_KEY && sync();
    window.addEventListener('storage', onStorage);
    window.addEventListener(SEEN_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SEEN_EVENT, sync);
    };
  }, []);

  const markAllSeen = useCallback(() => {
    // Guarda só os atuais: avisos que sumiram não precisam ficar no armazenamento
    const ids = items.map((n) => n.id);
    setSeen(ids);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
    } catch {
      // sem armazenamento: vale só nesta aba
    }
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, [items]);

  const ready = sheet.isSuccess && (!isAdmin || overview.isSuccess);
  return { items, unseen, markAllSeen, ready };
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
