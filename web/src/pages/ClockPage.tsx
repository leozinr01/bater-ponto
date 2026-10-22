import { Coffee, DoorOpen, Fingerprint, Hourglass, LogIn, LogOut, Timer } from 'lucide-react';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { InstallApp } from '../components/PwaPrompts';
import { DayStatusBadge } from '../components/timesheet';
import { useToast } from '../components/toast';
import { Card, cn, Skeleton, Spinner } from '../components/ui';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { currentMonth, formatDuration, formatMinutes, monthRange, timeOf, today } from '../lib/format';
import { useOnline } from '../lib/pwa';
import { useRegisterPunch, useTimesheet } from '../lib/queries';
import type { RegisteredPunch } from '../lib/types';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function greeting(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const minutesBetween = (from: string, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 60_000));

/**
 * Anel de progresso compacto, no estilo dos anéis de atividade.
 * Enquanto `working`, solta uma onda verde a cada minuto trabalhado (dupla na hora cheia).
 */
function Ring({
  progress,
  done,
  workedMinutes,
  working,
}: {
  progress: number | null;
  done: boolean;
  workedMinutes: number;
  working: boolean;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const [wave, setWave] = useState<{ id: number; hour: boolean } | null>(null);
  const previous = useRef(workedMinutes);

  useEffect(() => {
    const before = previous.current;
    previous.current = workedMinutes;
    // Só anima quando o minuto sobe trabalhando (não no carregamento nem em correções)
    if (!working || workedMinutes !== before + 1) return;
    setWave({ id: workedMinutes, hour: workedMinutes % 60 === 0 });
    const id = setTimeout(() => setWave(null), 2300);
    return () => clearTimeout(id);
  }, [workedMinutes, working]);

  return (
    <div className="relative size-24 shrink-0">
      {wave && (
        <>
          <span
            key={`a${wave.id}`}
            className={cn(
              'pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400',
              wave.hour ? 'animate-hour-wave' : 'animate-minute-wave',
            )}
          />
          {wave.hour && (
            <span
              key={`b${wave.id}`}
              className="pointer-events-none absolute inset-0 animate-hour-wave rounded-full border-2 border-emerald-300 [animation-delay:450ms]"
            />
          )}
        </>
      )}
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <defs>
          <linearGradient id="today-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={done ? '#6ee7b7' : '#93b4ff'} />
            <stop offset="1" stopColor={done ? '#10b981' : '#2f56f5'} />
          </linearGradient>
        </defs>
        <circle cx="40" cy="40" r={r} fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="8" />
        {progress !== null && progress > 0 && (
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="url(#today-ring)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {progress === null ? (
          <Timer className="size-6 text-slate-500" />
        ) : (
          <span
            key={wave?.id}
            className={cn(
              'text-base font-bold tabular-nums',
              done ? 'text-emerald-300' : 'text-white',
              wave && 'animate-flash-green',
            )}
          >
            {Math.round(progress * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

/** Um evento da linha do tempo: entrada (verde), saída (vermelha) ou trabalhando agora. */
function TimelineEvent({ kind, time, live }: { kind: 'in' | 'out' | 'now'; time: string; live?: string }) {
  const tones = {
    in: { dot: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', label: 'Entrada' },
    out: { dot: 'bg-red-500/15 text-red-300 ring-red-500/30', label: 'Saída' },
    now: { dot: 'bg-brand-500/20 text-brand-300 ring-brand-400/40', label: 'Trabalhando agora' },
  }[kind];
  return (
    <li className="relative flex items-center gap-4">
      <span className={cn('relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full ring-1', tones.dot)}>
        {kind === 'now' && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />}
        {kind === 'in' ? <LogIn className="size-4" /> : kind === 'out' ? <LogOut className="size-4" /> : <Timer className="size-4" />}
      </span>
      <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
        <span className={cn('text-sm', kind === 'now' ? 'font-medium text-brand-300' : 'text-slate-400')}>
          {tones.label}
        </span>
        <span className={cn('text-xl font-bold tabular-nums', kind === 'now' ? 'text-brand-200' : 'text-white')}>
          {kind === 'now' ? live : time}
        </span>
      </div>
    </li>
  );
}

/** O trecho entre dois eventos: tempo trabalhado ou intervalo. */
function TimelineGap({ kind, minutes }: { kind: 'work' | 'break'; minutes: number }) {
  return (
    <li className="flex items-center gap-4 py-1.5">
      <span className="flex w-10 shrink-0 justify-center">
        <span
          className={cn(
            'h-6 w-0.5 rounded-full',
            kind === 'work' ? 'bg-gradient-to-b from-emerald-500/50 to-red-500/50' : 'bg-[repeating-linear-gradient(to_bottom,rgb(148_163_184/0.35)_0_3px,transparent_3px_6px)]',
          )}
        />
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums',
          kind === 'work' ? 'bg-white/[0.04] text-slate-400' : 'bg-amber-500/10 text-amber-300',
        )}
      >
        {kind === 'work' ? <Timer className="size-3" /> : <Coffee className="size-3" />}
        {kind === 'work' ? `${formatMinutes(minutes)} trabalhadas` : `Intervalo de ${formatMinutes(minutes)}`}
      </span>
    </li>
  );
}

function FooterStat({ icon: IconCmp, label, value }: { icon: typeof Timer; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2 py-3">
      <IconCmp className="size-4 text-slate-500" />
      <span className="text-sm font-semibold text-white tabular-nums">{value}</span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

export function ClockPage() {
  const { user } = useAuth();
  const now = useNow();
  const toast = useToast();
  const { from, to } = monthRange(currentMonth());
  const sheet = useTimesheet({ from, to });
  const register = useRegisterPunch();
  const [last, setLast] = useState<RegisteredPunch | null>(null);
  const online = useOnline();

  const tz = sheet.data?.timezone;
  const todayDate = today(tz);
  const day = sheet.data?.days.find((d) => d.date === todayDate);
  const openPeriod = day?.periods.find((p) => p.end === null);
  // Uma jornada noturna aberta ontem também faz a próxima marcação ser saída
  const activeDay = sheet.data?.days.findLast((d) => d.status === 'in_progress');
  const workingSince = activeDay?.periods.find((p) => p.end === null)?.start;
  const nextAction = activeDay ? 'saída' : 'entrada';

  // Minutos trabalhados até agora, contando o período em aberto
  const workedNow = (day?.workedMinutes ?? 0) + (openPeriod ? minutesBetween(openPeriod.start, now) : 0);
  const expected = day?.expectedMinutes || null;
  const remaining = expected !== null ? expected - workedNow : null;
  const progress = expected ? Math.min(1, workedNow / expected) : null;
  const done = remaining !== null && remaining <= 0;
  // Saída prevista: só faz sentido trabalhando e com horas a cumprir
  const expectedExit =
    openPeriod && remaining !== null && remaining > 0
      ? new Date(now.getTime() + remaining * 60_000).toLocaleTimeString('pt-BR', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

  const onPunch = () =>
    register.mutate(undefined, {
      onSuccess: (punch) => {
        setLast(punch);
        toast(`${punch.interpretedAs === 'entrada' ? 'Entrada' : 'Saída'} registrada às ${timeOf(punch.localTime)}`);
      },
    });

  const hour = Number(now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }));
  const [hh, mm, ss] = now.toLocaleTimeString('pt-BR', { timeZone: tz }).split(':');
  const clockDate = now.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = now.toLocaleDateString('pt-BR', { timeZone: tz, weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="space-y-5">
      <InstallApp variant="card" />
      <div className="grid gap-5 xl:grid-cols-12">
        {/* Relógio e botão */}
        <div className="xl:col-span-7">
          <div className="relative h-full overflow-hidden rounded-3xl bg-ink-950 px-6 py-10 text-center shadow-2xl shadow-black/30 ring-1 ring-white/[0.06] sm:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,109,255,0.35),transparent_65%)]" />
            <div className="relative flex flex-col items-center">
              <p className="text-sm text-slate-400">
                {greeting(hour)}, <span className="font-medium text-white">{user?.name.split(' ')[0]}</span>
              </p>

              <div className="mt-3 h-7">
                {sheet.data &&
                  (workingSince ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                      <span className="relative flex size-2">
                        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative size-2 rounded-full bg-emerald-400" />
                      </span>
                      Em expediente desde {timeOf(workingSince)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10">
                      <span className="size-2 rounded-full bg-slate-500" />
                      Fora do expediente
                    </span>
                  ))}
              </div>

              <p className="mt-6 font-semibold tracking-tight text-white tabular-nums">
                <span className="text-7xl sm:text-8xl">
                  {hh}:{mm}
                </span>
                <span className="ml-1 text-3xl text-slate-500 sm:text-4xl">{ss}</span>
              </p>
              <p className="mt-2 text-sm text-slate-400 first-letter:uppercase">{clockDate}</p>

              <button
                type="button"
                onClick={onPunch}
                disabled={register.isPending || !online}
                className="group mt-10 flex h-16 w-full max-w-xs animate-pulse-ring items-center justify-center gap-3 rounded-2xl bg-brand-500 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-400 active:scale-[0.98] disabled:animate-none disabled:opacity-70"
              >
                {register.isPending ? (
                  <Spinner className="size-5" />
                ) : (
                  <Fingerprint className="size-6 transition-transform group-hover:scale-110" />
                )}
                {!online ? 'Sem conexão' : sheet.data ? `Registrar ${nextAction}` : 'Registrar ponto'}
              </button>

              <div className="mt-5 min-h-6 text-sm">
                {register.isError ? (
                  <p className="text-red-300">{errorMessage(register.error)}</p>
                ) : last ? (
                  <p className="text-emerald-300">
                    ✓ {last.interpretedAs === 'entrada' ? 'Entrada' : 'Saída'} registrada às{' '}
                    <strong className="text-white">{timeOf(last.localTime)}</strong>
                  </p>
                ) : null}
              </div>

              <p className="mt-4 max-w-sm text-xs text-slate-500">
                O horário registrado é sempre o do servidor. Entrada e saída são definidas pela ordem das marcações.
              </p>
            </div>
          </div>
        </div>

        {/* Resumo de hoje */}
        <div className="xl:col-span-5">
          <Card className="flex h-full flex-col overflow-hidden">
            {sheet.isPending ? (
              <div className="space-y-5 p-6">
                <div className="flex items-center gap-5">
                  <Skeleton className="size-24 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : sheet.isError ? (
              <p className="p-6 text-sm text-red-300">{errorMessage(sheet.error)}</p>
            ) : (
              <>
                {/* Cabeçalho */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Hoje</h2>
                    <p className="text-xs text-slate-500 first-letter:uppercase">{shortDate}</p>
                  </div>
                  {day && <DayStatusBadge day={day} />}
                </div>

                {/* Progresso */}
                <div className="flex items-center gap-5 px-6 pt-6">
                  <Ring progress={progress} done={done} workedMinutes={workedNow} working={!!openPeriod} />
                  <div className="min-w-0">
                    <p className="text-4xl font-bold tracking-tight text-white tabular-nums">{formatMinutes(workedNow)}</p>
                    <p className="text-sm text-slate-500">
                      {expected ? `trabalhadas de ${formatDuration(expected)}` : 'trabalhadas hoje'}
                    </p>
                    {remaining !== null && (
                      <p
                        className={cn(
                          'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ring-1',
                          done
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                            : 'bg-white/5 text-slate-300 ring-white/10',
                        )}
                      >
                        {done ? (
                          remaining === 0 ? (
                            'Jornada completa'
                          ) : (
                            `+${formatMinutes(-remaining)} de hora extra`
                          )
                        ) : (
                          <>
                            <Hourglass className="size-3" /> Faltam {formatMinutes(remaining)}
                            {expectedExit && <span className="text-slate-500">· saída às {expectedExit}</span>}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Linha do tempo */}
                <div className="flex-1 px-6 py-6">
                  {day?.periods.length ? (
                    <ol>
                      {day.periods.map((p, i) => {
                        const next = day.periods[i + 1];
                        return (
                          <Fragment key={p.start}>
                            <TimelineEvent kind="in" time={timeOf(p.start)} />
                            <TimelineGap kind="work" minutes={p.end ? p.minutes : minutesBetween(p.start, now)} />
                            {p.end ? (
                              <TimelineEvent kind="out" time={timeOf(p.end)} />
                            ) : (
                              <TimelineEvent kind="now" time="" live={formatMinutes(minutesBetween(p.start, now))} />
                            )}
                            {p.end && next && (
                              <TimelineGap
                                kind="break"
                                minutes={Math.round((new Date(next.start).getTime() - new Date(p.end).getTime()) / 60_000)}
                              />
                            )}
                          </Fragment>
                        );
                      })}
                    </ol>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center">
                      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.08]">
                        <Fingerprint className="size-7" />
                      </span>
                      <p className="text-sm text-slate-400">Nenhuma marcação hoje.</p>
                      <p className="text-xs text-slate-500">
                        {day?.scheduled === false
                          ? 'Hoje não é dia de trabalho.'
                          : sheet.data?.schedule
                            ? `Sua jornada começa às ${sheet.data.schedule.startTime}.`
                            : 'Registre a entrada para começar o dia.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Rodapé */}
                <div className="flex divide-x divide-white/[0.06] border-t border-white/[0.06] bg-white/[0.015]">
                  <FooterStat icon={Coffee} label="Intervalo" value={formatMinutes(day?.breakMinutes ?? 0)} />
                  <FooterStat
                    icon={LogIn}
                    label="Primeira entrada"
                    value={day?.periods[0] ? timeOf(day.periods[0].start) : '–'}
                  />
                  <FooterStat icon={DoorOpen} label="Saída prevista" value={expectedExit ?? '–'} />
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
