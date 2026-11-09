import type { PresenceStatus } from '@/punches/punches.service';

/** Até quanto tempo depois do horário de entrada o lembrete ainda é enviado. */
export const ENTRY_REMINDER_WINDOW_MINUTES = 120;

export type ReminderKind = 'entry' | 'exit';

/** O que o painel "Hoje" sabe de cada funcionário e os lembretes usam. */
export interface PresenceItem {
  employee: { id: string; name: string };
  status: PresenceStatus;
  /** Início previsto da jornada (HH:MM). */
  expectedStart: string | null;
  expectedMinutes: number | null;
  /** Início do período em aberto (horário local ISO). */
  workingSince: string | null;
  workedMinutes: number;
}

export interface Reminder {
  userId: string;
  kind: ReminderKind;
  title: string;
  body: string;
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Lembretes devidos agora:
 * - entrada: dia de trabalho, ainda sem marcação, já passou do horário de entrada (até 2h depois);
 * - saída: trabalhando e já cumpriu a carga prevista do dia.
 * Quem está de folga, feriado, abono ou no intervalo não recebe nada. O envio repetido no mesmo
 * dia é barrado por quem chama (tabela push_reminders).
 */
export function dueReminders(
  items: PresenceItem[],
  now: Date,
  /** Horário local agora, HH:MM. */
  localTime: string,
): Reminder[] {
  const reminders: Reminder[] = [];
  const nowMinutes = toMinutes(localTime);

  for (const item of items) {
    const firstName = item.employee.name.split(' ')[0];

    if (
      (item.status === 'not_started' || item.status === 'late') &&
      item.expectedStart
    ) {
      const since = nowMinutes - toMinutes(item.expectedStart);
      if (since >= 0 && since <= ENTRY_REMINDER_WINDOW_MINUTES) {
        reminders.push({
          userId: item.employee.id,
          kind: 'entry',
          title: 'Hora de bater o ponto',
          body: `${firstName}, sua jornada começa às ${item.expectedStart}. Registre a entrada.`,
        });
      }
    }

    if (
      item.status === 'working' &&
      item.expectedMinutes &&
      item.workingSince
    ) {
      const open = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(item.workingSince).getTime()) / 60_000,
        ),
      );
      if (item.workedMinutes + open >= item.expectedMinutes) {
        reminders.push({
          userId: item.employee.id,
          kind: 'exit',
          title: 'Jornada cumprida',
          body: `${firstName}, você já completou as horas de hoje. Não esqueça de registrar a saída.`,
        });
      }
    }
  }
  return reminders;
}
