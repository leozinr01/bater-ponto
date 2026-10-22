import { Download, RefreshCw, Share, SquarePlus, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useInstall, useOnline } from '../lib/pwa';
import { Button, cn, Modal } from './ui';

const DISMISS_KEY = 'ponto.install-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Faixa de "sem conexão" e aviso de nova versão do app. Fica uma vez na raiz. */
export function PwaPrompts() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-center text-[13px] font-medium text-amber-950 print:hidden"
        >
          <WifiOff className="size-4 shrink-0" />
          Sem conexão. Para bater o ponto é preciso internet.
        </div>
      )}

      {needRefresh && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 flex justify-center px-4 lg:bottom-6 lg:justify-end lg:px-6 print:hidden">
          <div className="flex w-full max-w-sm animate-fade-in items-center gap-3 rounded-2xl bg-ink-700/95 p-3 pl-4 shadow-2xl ring-1 ring-white/10 backdrop-blur">
            <RefreshCw className="size-5 shrink-0 text-brand-300" />
            <p className="flex-1 text-sm text-slate-200">Nova versão do app disponível.</p>
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              Atualizar
            </Button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"
              aria-label="Depois"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Passo a passo do Safari (iPhone não tem instalação com um toque). */
function IosSteps({ onClose }: { onClose: () => void }) {
  return (
    <Modal open onClose={onClose} icon={Download} title="Instalar no iPhone" description="Leva 10 segundos, pelo Safari.">
      <ol className="space-y-4 text-sm text-slate-300">
        <li className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-semibold text-white">1</span>
          <span>
            Toque em <Share className="inline size-4 text-brand-300" /> <strong className="text-white">Compartilhar</strong> na
            barra do Safari.
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-semibold text-white">2</span>
          <span>
            Role e toque em <SquarePlus className="inline size-4 text-brand-300" />{' '}
            <strong className="text-white">Adicionar à Tela de Início</strong>.
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 font-semibold text-white">3</span>
          <span>
            Toque em <strong className="text-white">Adicionar</strong>. O app <strong className="text-white">Ponto TAI</strong>{' '}
            aparece junto dos outros.
          </span>
        </li>
      </ol>
    </Modal>
  );
}

/**
 * Convite para instalar o app. `variant="card"` para a tela inicial (pode ser dispensado),
 * `variant="button"` para o menu lateral.
 */
export function InstallApp({ variant, force }: { variant: 'card' | 'button'; force?: boolean }) {
  const { canPrompt, ios, install } = useInstall();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showIos, setShowIos] = useState(false);

  if (!canPrompt && !ios) return null;
  // `force`: veio pelo QR code de instalação, mostra mesmo se já foi dispensado antes
  if (variant === 'card' && dismissed && !force) return null;

  const onInstall = () => (ios ? setShowIos(true) : install());
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // armazenamento indisponível: só some nesta sessão
    }
  };

  return (
    <>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={onInstall}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-300 transition-colors hover:bg-white/5 hover:text-brand-200"
        >
          <Download className="size-[18px]" />
          Instalar app
        </button>
      ) : (
        <div
          className={cn(
            'relative flex animate-fade-in items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600/30 to-brand-500/10 p-4 pr-10 ring-1 ring-brand-400/25',
          )}
        >
          <img src="/pwa-192x192.png" alt="" className="size-12 shrink-0 rounded-xl shadow-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Instale o Ponto TAI</p>
            <p className="text-xs text-slate-400">Bata o ponto direto da tela inicial, como um app.</p>
          </div>
          <Button size="sm" icon={Download} onClick={onInstall}>
            Instalar
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-2 right-2 rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-white"
            aria-label="Agora não"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {showIos && <IosSteps onClose={() => setShowIos(false)} />}
    </>
  );
}
