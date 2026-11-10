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

function NotificationList({ items, onPick }: { items: AppNotification[]; onPick: () => void }) {
  if (!items.length) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">Nenhum aviso no momento.</p>;
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {items.map((n) => (
        <li key={n.id}>
          <Link to={n.to} onClick={onPick} className="flex gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[n.tone])} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">{n.title}</span>
              <span className="block text-xs text-slate-400">{n.text}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Sininho com o número de avisos não vistos (em vermelho) e a lista ao tocar. */
export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { items, unseen, markAllSeen } = useNotifications();
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

  const toggle = () => {
    if (!open) markAllSeen();
    setOpen((o) => !o);
  };
  const count = unseen.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `Avisos: ${count} novo(s)` : 'Avisos'}
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
          <p className="border-b border-white/[0.06] px-4 py-3 text-sm font-semibold text-white">Avisos</p>
          <div className="max-h-[60vh] overflow-y-auto">
            <NotificationList items={items} onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alertas dos avisos (monte uma vez só, no layout):
 * - ao entrar (depois do login ou na primeira abertura do dia), uma janela com os avisos não vistos e um som;
 * - com o site aberto, quando surge um aviso novo (ex.: chegou a hora da entrada), som e mensagem rápida.
 */
export function NotificationAlerts() {
  const { items, unseen, markAllSeen, ready } = useNotifications();
  const [alertOpen, setAlertOpen] = useState(false);
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
      if (show && unseen.length) {
        setAlertOpen(true);
        playChime();
      }
      return;
    }

    // Depois: aviso que não existia antes e ainda não foi visto
    const fresh = unseen.filter((n) => !known.current!.has(n.id));
    for (const n of items) known.current.add(n.id);
    if (fresh.length) {
      playChime();
      toast(fresh[0].title + (fresh.length > 1 ? ` (+${fresh.length - 1})` : ''));
    }
  }, [ready, items, unseen, toast]);

  const close = () => {
    setAlertOpen(false);
    markAllSeen();
  };

  return (
    <Modal
      open={alertOpen}
      onClose={close}
      icon={BellRing}
      title={unseen.length === 1 ? 'Você tem 1 aviso' : `Você tem ${unseen.length} avisos`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Fechar
          </Button>
          {unseen[0] && (
            <Button
              onClick={() => {
                const to = unseen[0].to;
                close();
                navigate(to);
              }}
            >
              Ver
            </Button>
          )}
        </>
      }
    >
      <div className="overflow-hidden rounded-xl ring-1 ring-white/[0.06]">
        <NotificationList items={unseen} onPick={close} />
      </div>
    </Modal>
  );
}
