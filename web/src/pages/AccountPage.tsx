import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useToast } from '../components/toast';
import { Alert, Badge, Button, Card, Field, Input, PageHeader } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatDate, formatDuration, today, WEEKDAYS } from '../lib/format';
import { useTimesheet } from '../lib/queries';
import type { Tokens } from '../lib/types';

export function AccountPage() {
  const { user, replaceTokens } = useAuth();
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

  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Dados</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Nome</dt>
              <dd className="font-medium">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">E-mail</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Perfil</dt>
              <dd>
                <Badge tone={user.role === 'ADMIN' ? 'indigo' : 'gray'}>
                  {user.role === 'ADMIN' ? 'Administrador' : 'Funcionário'}
                </Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cadastrado em</dt>
              <dd>{formatDate(user.createdAt.slice(0, 10))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Jornada</dt>
              <dd className="text-right">
                {schedule ? (
                  <>
                    <span className="font-medium">{schedule.name}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDuration(schedule.dailyMinutes)}/dia a partir de {schedule.startTime} ·{' '}
                      {schedule.workDays
                        .slice()
                        .sort()
                        .map((d) => WEEKDAYS[d])
                        .join(', ')}
                    </span>
                  </>
                ) : sheet.isPending ? (
                  '…'
                ) : (
                  <span className="text-slate-500">Não definida</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Trocar senha</h2>
          <form onSubmit={onSubmit} className="space-y-4">
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
            <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
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
            <Button type="submit" loading={change.isPending}>
              Alterar senha
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
