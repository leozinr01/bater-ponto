import { useEffect, useState } from 'react';
import { serverNow } from './api';

/** Agora pelo relógio do servidor, atualizado a cada `intervalMs`. Use no lugar de new Date() em telas de ponto. */
export function useServerNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
