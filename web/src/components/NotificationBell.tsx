import { Bell, BellRing } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { playChime, useNotifications, type AppNotification } from '../lib/notifications';
import { useToast } from './toast';
import { Button, cn, Modal } from './ui';

const LOGIN_FLAG = 'ponto.alerta-login';
const DAY_KEY = 'ponto.alerta-dia';

/** A tela de login chama depois de entrar: o alerta de avisos aparece uma vez. */
export function requestLoginAlert() {
  try {
    sessionStorage.setItem(LOGIN_FLAG, '1');
  } catch {
    // ignora
  }
}

const dot: Record<AppNotification['tone'], string> = {
  brand: 'bg-brand-400',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
};

/** Lista de avisos não lidos: tocar num aviso abre a tela dele e o marca como lido. */
function NotificationList({ items, onOpen }: { items: AppNotification[]; onOpen: (n: AppNotification) => void }) {
  if (!items.length) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhum aviso pendente.</p>;
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((n) => (
        <li key={n.id}>
          <Link
            to={n.to}
            onClick={() => onOpen(n)}
            className="group flex gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
          >
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-white">{n.title}</span>
              <span className="block text-xs text-slate-400">{n.text}</span>
            </span>
            <span className="self-center text-[11px] font-medium text-brand-300 opacity-0 transition-opacity group-hover:opacity-100">
              Abrir
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Sininho com o número de avisos não lidos (em vermelho) e a lista deles ao tocar. */
export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha a lista ao tocar fora ou apertar Esc
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

  // Abrir o sininho não marca nada como lido: cada aviso sai da lista quando é aberto
  const toggle = () => setOpen((o) => !o);
  const count = unread.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `Avisos: ${count} não lido(s)` : 'Avisos'}
        className="relative flex size-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        {count ? <BellRing className="size-5" /> : <Bell className="size-5" />}
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-ink-950 tabular-nums">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos"
          className={cn(
            'animate-fade-in absolute z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-ink-800 shadow-2xl ring-1 shadow-black/50 ring-white/10',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-white">
              Avisos{count > 0 && <span className="ml-1 font-normal text-slate-500">· {count}</span>}
            </p>
            {count > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-brand-300 transition-colors hover:text-brand-200"
              >
                Marcar todos como lidos
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            <NotificationList
              items={unread}
              onOpen={(n) => {
                markRead([n.id]);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alertas dos avisos (monte uma vez só, no layout):
 * - ao entrar (depois do login ou na primeira abertura do dia), uma janela com os avisos não lidos
 *   que ainda não foram mostrados, e um som. Fechar não marca como lido: eles seguem no sininho,
 *   mas não reaparecem nesta janela;
 * - com o site aberto, quando surge um aviso novo (ex.: chegou a hora da entrada), som e mensagem rápida.
 */
export function NotificationAlerts() {
  const { items, unread, notAlerted, markRead, markAlerted, ready } = useNotifications();
  const [shown, setShown] = useState<AppNotification[]>([]);
  const toast = useToast();
  const navigate = useNavigate();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) return;

    // Primeira vez com os dados: decide se mostra o alerta de entrada
    if (!known.current) {
      known.current = new Set(items.map((n) => n.id));
      let show = false;
      try {
        const date = new Date().toLocaleDateString('sv');
        show = sessionStorage.getItem(LOGIN_FLAG) === '1' || localStorage.getItem(DAY_KEY) !== date;
        sessionStorage.removeItem(LOGIN_FLAG);
        localStorage.setItem(DAY_KEY, date);
      } catch {
        // sem armazenamento: não mostra
      }
      if (show && notAlerted.length) {
        setShown(notAlerted);
        markAlerted(notAlerted.map((n) => n.id));
        playChime();
      }
      return;
    }

    // Depois: aviso que não existia antes e ainda não foi lido
    const fresh = unread.filter((n) => !known.current!.has(n.id));
    for (const n of items) known.current.add(n.id);
    if (fresh.length) {
      playChime();
      toast(fresh[0].title + (fresh.length > 1 ? ` (+${fresh.length - 1})` : ''));
    }
  }, [ready, items, unread, notAlerted, markAlerted, toast]);

  // Só os que continuam não lidos (abrir um pelo sininho também o tira daqui)
  const pending = shown.filter((n) => unread.some((u) => u.id === n.id));
  const close = () => setShown([]);
  const open = (n: AppNotification) => {
    markRead([n.id]);
    close();
  };

  return (
    <Modal
      open={pending.length > 0}
      onClose={close}
      icon={BellRing}
      title={pending.length === 1 ? 'Você tem 1 aviso' : `Você tem ${pending.length} avisos`}
      description="Toque num aviso para abrir. Os que ficarem para depois continuam no sininho."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Ver depois
          </Button>
          {pending[0] && (
            <Button
              onClick={() => {
                const first = pending[0];
                open(first);
                navigate(first.to);
              }}
            >
              Abrir o primeiro
            </Button>
          )}
        </>
      }
    >
      <div className="overflow-hidden rounded-xl ring-1 ring-white/[0.06]">
        <NotificationList items={pending} onOpen={open} />
      </div>
    </Modal>
  );
}
