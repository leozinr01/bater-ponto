import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellRing, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useToast } from './toast';
import { Alert, Badge, Button, Card, CardHeader } from './ui';

type PushConfig = {
  enabled: boolean;
  publicKey: string | null;
  /** O servidor tem SMTP configurado. */
  emailEnabled: boolean;
  /** Preferência do usuário (ligada por padrão). */
  emailReminders: boolean;
  email: string | null;
};

/** Chave VAPID (base64url) no formato que o navegador pede. */
function keyBytes(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

const supported =
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Lembretes de entrada e saída: notificação no navegador deste aparelho e/ou e-mail. */
export function RemindersCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['push-config'], queryFn: () => api<PushConfig>('/push/config') });
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [checking, setChecking] = useState(supported);
  const [busy, setBusy] = useState<'push' | 'email' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.getRegistration().then(async (registration) => {
      setSubscription((await registration?.pushManager.getSubscription()) ?? null);
      setChecking(false);
    });
  }, []);

  const enablePush = async () => {
    if (!config.data?.publicKey) return;
    setBusy('push');
    setError('');
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        throw new Error('As notificações foram bloqueadas. Libere nas configurações do navegador e tente de novo.');
      }
      const registration =
        (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
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
      toast('Notificações ativadas neste aparelho.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const disablePush = async () => {
    if (!subscription) return;
    setBusy('push');
    setError('');
    try {
      await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
      setSubscription(null);
      toast('Notificações desativadas neste aparelho.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleEmail = async (enabled: boolean) => {
    setBusy('email');
    setError('');
    try {
      await api('/push/email', { method: 'PATCH', body: { enabled } });
      await queryClient.invalidateQueries({ queryKey: ['push-config'] });
      toast(enabled ? 'Lembretes por e-mail ligados.' : 'Lembretes por e-mail desligados.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const data = config.data;
  const pushActive = subscription !== null;
  const emailActive = !!data?.emailEnabled && data.emailReminders;

  return (
    <Card>
      <CardHeader
        title="Lembretes"
        subtitle="Aviso na hora de bater a entrada e quando completar as horas do dia."
        icon={Bell}
        actions={pushActive || emailActive ? <Badge tone="green" dot>Ativos</Badge> : null}
      />
      <div className="divide-y divide-white/[0.06]">
        {error && (
          <div className="p-5">
            <Alert>{error}</Alert>
          </div>
        )}

        {/* E-mail: funciona em qualquer aparelho, inclusive iPhone, sem instalar nada */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Por e-mail</p>
              <p className="truncate text-xs text-slate-500">
                {!data
                  ? 'Carregando…'
                  : !data.emailEnabled
                    ? 'O envio de e-mail ainda não foi configurado no servidor.'
                    : data.emailReminders
                      ? `Enviado para ${data.email}. Funciona em qualquer celular.`
                      : 'Desligado.'}
              </p>
            </div>
          </div>
          {data?.emailEnabled && (
            <Button
              size="sm"
              variant={data.emailReminders ? 'secondary' : 'primary'}
              loading={busy === 'email'}
              onClick={() => toggleEmail(!data.emailReminders)}
            >
              {data.emailReminders ? 'Desligar' : 'Ligar'}
            </Button>
          )}
        </div>

        {/* Notificação no navegador deste aparelho */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Notificação neste aparelho</p>
              <p className="text-xs text-slate-500">
                {!supported
                  ? isIos
                    ? 'No iPhone, o navegador só mostra notificações com o app na tela de início. Use o e-mail.'
                    : 'Este navegador não aceita notificações. Use o e-mail.'
                  : data && !data.enabled
                    ? 'As notificações ainda não foram configuradas no servidor.'
                    : !import.meta.env.PROD
                      ? 'Só funciona na versão publicada do app.'
                      : pushActive
                        ? 'Ativa neste navegador (Android e computador).'
                        : 'Android e computador: aparece mesmo com o site fechado.'}
              </p>
            </div>
          </div>
          {supported && data?.enabled && import.meta.env.PROD && (
            <Button
              size="sm"
              variant={pushActive ? 'secondary' : 'primary'}
              icon={pushActive ? BellOff : BellRing}
              loading={busy === 'push' || checking}
              onClick={pushActive ? disablePush : enablePush}
            >
              {pushActive ? 'Desativar' : 'Ativar'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
