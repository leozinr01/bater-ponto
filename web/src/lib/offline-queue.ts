import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError, serverNow } from './api';
import { useAuth } from './auth';
import type { DeviceLocation } from './geo';
import type { QueuedPunch, RegisteredPunch } from './types';

const KEY = 'ponto.fila-batidas';
const CHANGED = 'ponto:fila-batidas';

type Stored = QueuedPunch & { userId: string };

function read(): Stored[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Stored[];
  } catch {
    return [];
  }
}

function write(list: Stored[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
    else localStorage.removeItem(KEY);
  } catch {
    // armazenamento cheio ou bloqueado: não há onde guardar
  }
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * Guarda uma batida feita sem internet. O horário é o do relógio do servidor estimado
 * pelo app (a diferença medida na última conexão), e o clientId evita duplicar no reenvio.
 */
export function enqueuePunch(userId: string, location: DeviceLocation | null): QueuedPunch {
  const punch: Stored = {
    userId,
    clientId: crypto.randomUUID(),
    at: serverNow().toISOString(),
    ...(location ?? {}),
  };
  write([...read(), punch]);
  return punch;
}

let flushing: Promise<void> | null = null;

/**
 * Envia as batidas guardadas do usuário, em ordem. Para no primeiro erro de rede (tenta de
 * novo depois). Batidas recusadas pela API (duplicada, antiga demais) saem da fila e são
 * avisadas por `onRejected`.
 */
function flush(userId: string, onRejected: (punch: QueuedPunch, message: string) => void) {
  flushing ??= (async () => {
    try {
      for (const punch of read().filter((p) => p.userId === userId)) {
        const { userId: _owner, clientId, at, ...location } = punch;
        try {
          await api<RegisteredPunch>('/punches', {
            method: 'POST',
            body: { ...location, offline: { clientId, at } },
          });
        } catch (err) {
          if (!(err instanceof ApiError) || err.kind !== 'http') break; // sem rede ou sessão expirada: fica para a próxima
          // 409 = a mesma batida já tinha chegado (a resposta se perdeu no caminho): nada a avisar
          if (err.status !== 409) onRejected(punch, err.message);
        }
        write(read().filter((p) => p.clientId !== clientId));
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/** Batidas guardadas do usuário logado, atualizadas quando a fila muda. */
export function usePendingPunches() {
  const { user } = useAuth();
  const userId = user?.id;
  const [pending, setPending] = useState<QueuedPunch[]>([]);

  useEffect(() => {
    const update = () => setPending(userId ? read().filter((p) => p.userId === userId) : []);
    update();
    window.addEventListener(CHANGED, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CHANGED, update);
      window.removeEventListener('storage', update);
    };
  }, [userId]);

  return pending;
}

/**
 * Envia a fila sozinho: ao abrir o app, quando a conexão volta, quando entra uma batida
 * nova e a cada 30 s. Monte uma vez só (no layout). `onRejected` avisa batidas recusadas.
 */
export function useOfflineSync(onRejected: (punch: QueuedPunch, message: string) => void) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const rejected = useRef(onRejected);
  useEffect(() => {
    rejected.current = onRejected;
  });

  const sync = useCallback(async () => {
    if (!userId || !navigator.onLine || !read().some((p) => p.userId === userId)) return;
    await flush(userId, (punch, message) => rejected.current(punch, message));
    await queryClient.invalidateQueries();
  }, [userId, queryClient]);

  useEffect(() => {
    void sync();
    window.addEventListener('online', sync);
    window.addEventListener(CHANGED, sync);
    const id = setInterval(sync, 30_000);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener(CHANGED, sync);
      clearInterval(id);
    };
  }, [sync]);
}
