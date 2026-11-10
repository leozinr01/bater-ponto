import { CalendarDays, Lock, LogIn, ShieldCheck, Zap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { APP_NAME, COMPANY, Logo } from '../components/Layout';
import { requestLoginAlert } from '../components/NotificationBell';
import { Alert, Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';

const features = [
  { icon: Zap, title: 'Ponto em um clique', text: 'Registre entrada e saída com o horário oficial do servidor.' },
  { icon: CalendarDays, title: 'Espelho sempre em dia', text: 'Horas trabalhadas, atrasos, extras e faltas calculados.' },
  { icon: ShieldCheck, title: 'Correções auditáveis', text: 'Nada é apagado: toda correção guarda autor e motivo.' },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Depois do login, sempre a tela de bater ponto
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // Marca antes do login: ao entrar, o layout mostra os avisos pendentes com som
      requestLoginAlert();
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.25fr_1fr]">
      {/* Painel da marca */}
      <div className="relative hidden overflow-hidden bg-ink-950 p-10 lg:flex lg:flex-col xl:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,109,255,0.35),transparent_60%),radial-gradient(ellipse_at_bottom_right,rgba(36,67,216,0.25),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative my-auto py-8">
          <div className="max-w-md">
            <h1 className="text-4xl leading-tight font-bold tracking-tight text-white">
              Controle de ponto simples, preciso e confiável.
            </h1>
            <p className="mt-4 text-base text-slate-400">
              Tudo o que a equipe da {COMPANY} precisa para registrar e acompanhar a jornada de trabalho.
            </p>
            <ul className="mt-10 space-y-6">
              {features.map(({ icon: IconCmp, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-brand-300 ring-1 ring-white/10">
                    <IconCmp className="size-5" />
                  </span>
                  <span>
                    <span className="block font-medium text-white">{title}</span>
                    <span className="text-sm text-slate-400">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          © {new Date().getFullYear()} {COMPANY} · {APP_NAME}
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center bg-ink-900 bg-[radial-gradient(ellipse_at_top,rgba(59,109,255,0.12),transparent_60%)] px-6 py-12 lg:border-l lg:border-white/[0.06]">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo size="lg" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Bem-vindo de volta</h2>
          <p className="mt-1 text-sm text-slate-400">Entre com seu e-mail e senha para continuar.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && <Alert>{error}</Alert>}
            <Field label="E-mail">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="username"
                  placeholder="voce@empresa.com"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              )}
            </Field>
            <Field label="Senha">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              )}
            </Field>
            <Button type="submit" icon={LogIn} className="h-11 w-full" loading={submitting}>
              Entrar
            </Button>
          </form>

          <p className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="size-3.5" />
            Não tem acesso? Peça ao administrador do sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
