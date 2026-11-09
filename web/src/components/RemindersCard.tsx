import { useQuery } from '@tanstack/react-query';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, CardHeader } from './ui';

type PushConfig = { enabled: boolean; publicKey: string | null };

/** Chave VAPID (base64url) no formato que o navegador pede. */
function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const supported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// No iPhone, notificações só funcionam com o app adicionado à tela de início
const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

/** Liga e desliga os lembretes de entrada e saída neste aparelho. */
export function RemindersCard() {
  const toast = useToast();
  const config = useQuery({ queryKey: ['push-config'], queryFn: () => api<PushConfig>('/push/config') });
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [checking, setChecking] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      setSubscription((await registration?.pushManager.getSubscription()) ?? null);
      setChecking(false);
    });
  }, []);

  const enable = async () => {
    if (!config.data?.publicKey) return;
    setBusy(true);
    setError('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        throw new Error('As notificações foram bloqueadas. Libere nas configurações do navegador e tente de novo.');
      }
      const registration = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(config.data.publicKey),
        }));
      await api('/push/subscriptions', { method: 'POST', body: sub.toJSON() });
      setSubscription(sub);
      await api('/push/test', { method: 'POST' });
      toast('Lembretes ativados neste aparelho.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!subscription) return;
    setBusy(true);
    setError('');
    try {
      await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
      setSubscription(null);
      toast('Lembretes desativados neste aparelho.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const active = subscription !== null;

  return (
    <Card>
      <CardHeader
        title="Lembretes"
        subtitle="Aviso no celular na hora de bater a entrada e quando completar as horas do dia."
        icon={Bell}
        actions={active ? <Badge tone="green" dot>Ativos</Badge> : null}
      />
      <div className="space-y-3 p-5">
        {error && <Alert>{error}</Alert>}
        {!supported ? (
          <p className="text-sm text-slate-400">
            {isIos && !standalone
              ? 'No iPhone, adicione o app à tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá para ativar os lembretes.'
              : 'Este navegador não aceita notificações.'}
          </p>
        ) : config.data && !config.data.enabled ? (
          <p className="text-sm text-slate-400">Os lembretes ainda não foram configurados no servidor.</p>
        ) : !import.meta.env.PROD ? (
          <p className="text-sm text-slate-400">Os lembretes só funcionam na versão publicada do app.</p>
        ) : active ? (
          <Button variant="secondary" icon={BellOff} loading={busy} onClick={disable}>
            Desativar neste aparelho
          </Button>
        ) : (
          <Button icon={BellRing} loading={busy || checking || config.isPending} onClick={enable}>
            Ativar lembretes
          </Button>
        )}
      </div>
    </Card>
  );
}
