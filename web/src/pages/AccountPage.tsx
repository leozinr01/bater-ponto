import { useMutation } from '@tanstack/react-query';
import { CalendarClock, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { QrInstall } from '../components/QrInstall';
import { useToast } from '../components/toast';
import { Alert, Avatar, Badge, Button, Card, CardHeader, cn, Field, Input, PageHeader, Skeleton } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatDuration, today, WEEKDAYS } from '../lib/format';
import { useTimesheet } from '../lib/queries';
import type { Tokens } from '../lib/types';

export function AccountPage() {
  const { user, isAdmin, replaceTokens } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  // O espelho traz a jornada do próprio usuário (a rota de jornadas é só para admin)
  const day = today();
  const sheet = useTimesheet({ from: day, to: day });
  const schedule = sheet.data?.schedule;

  const change = useMutation({
    mutationFn: () =>
      api<Tokens>('/auth/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      }),
    onSuccess: (tokens) => {
      replaceTokens(tokens);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Senha alterada. Outras sessões foram encerradas.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (next !== confirm) return setLocalError('A confirmação não confere com a nova senha.');
    change.mutate();
  };

  if (!user) return null;

  // Força da senha: só um guia visual, a regra real (mínimo de 8) é da API
  const strength = next.length === 0 ? 0 : next.length < 8 ? 1 : next.length < 12 ? 2 : 3;

  return (
    <>
      <PageHeader icon={UserRound} title="Minha conta" description="Seus dados, sua jornada e sua senha." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Perfil */}
          <Card className="relative overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-brand-700/50 via-brand-500/30 to-transparent" />
            <div className="-mt-10 px-6 pb-6">
              <div className="rounded-full ring-4 ring-ink-850 w-fit">
                <Avatar name={user.name} size="lg" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">{user.name}</h2>
                <Badge tone={isAdmin ? 'brand' : 'gray'}>{isAdmin ? 'Administrador' : 'Funcionário'}</Badge>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <Mail className="size-4 text-slate-500" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500">E-mail</dt>
                    <dd className="truncate text-slate-200">{user.email}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <ShieldCheck className="size-4 text-slate-500" />
                  <div>
                    <dt className="text-xs text-slate-500">Cadastrado em</dt>
                    <dd className="text-slate-200">{formatDate(user.createdAt.slice(0, 10))}</dd>
                  </div>
                </div>
              </dl>
            </div>
          </Card>

          {/* Jornada */}
          <Card>
            <CardHeader title="Minha jornada" icon={CalendarClock} />
            <div className="p-5">
              {sheet.isPending ? (
                <Skeleton className="h-20" />
              ) : schedule ? (
                <>
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <p className="text-xs text-slate-500">Jornada</p>
                      <p className="font-semibold text-white">{schedule.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Carga diária</p>
                      <p className="font-semibold text-white">{formatDuration(schedule.dailyMinutes)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Entrada</p>
                      <p className="font-semibold text-white tabular-nums">{schedule.startTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tolerância</p>
                      <p className="font-semibold text-white">{schedule.lateToleranceMinutes} min</p>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                      <span
                        key={d}
                        className={cn(
                          'flex-1 rounded-lg py-2 text-center text-xs font-medium',
                          schedule.workDays.includes(d)
                            ? 'bg-brand-500/15 text-brand-200 ring-1 ring-brand-400/20'
                            : 'bg-white/[0.02] text-slate-600',
                        )}
                      >
                        {WEEKDAYS[d]}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400">Nenhuma jornada definida. Fale com o administrador.</p>
              )}
            </div>
          </Card>

          {/* No computador: QR para levar o app para o celular */}
          <QrInstall className="hidden lg:block" />
        </div>

        {/* Senha */}
        <Card className="h-fit lg:col-span-2">
          <CardHeader title="Trocar senha" subtitle="As outras sessões serão encerradas." icon={KeyRound} />
          <form onSubmit={onSubmit} className="space-y-4 p-5">
            {(localError || change.isError) && <Alert>{localError || errorMessage(change.error)}</Alert>}
            <Field label="Senha atual">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              )}
            </Field>
            <Field label="Nova senha">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              )}
            </Field>
            <div>
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      strength >= i ? ['', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400'][strength] : 'bg-white/10',
                    )}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                {['Mínimo de 8 caracteres.', 'Curta demais.', 'Boa. Mais longa é ainda melhor.', 'Senha forte.'][strength]}
              </p>
            </div>
            <Field label="Confirmar nova senha">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" className="w-full" loading={change.isPending}>
              Alterar senha
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
