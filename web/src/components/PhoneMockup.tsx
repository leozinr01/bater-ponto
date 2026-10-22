import { ClipboardList, Fingerprint, LogIn, LogOut, Timer, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from './ui';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function greeting(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Item da linha do tempo, em miniatura. */
function MiniEvent({ kind, time }: { kind: 'in' | 'out' | 'now'; time: string }) {
  const tone = {
    in: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    out: 'bg-red-500/15 text-red-300 ring-red-500/30',
    now: 'bg-brand-500/20 text-brand-300 ring-brand-400/40',
  }[kind];
  const label = { in: 'Entrada', out: 'Saída', now: 'Trabalhando' }[kind];
  return (
    <div className="flex items-center gap-2">
      <span className={cn('relative flex size-5 items-center justify-center rounded-full ring-1', tone)}>
        {kind === 'now' && <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/30" />}
        {kind === 'in' ? <LogIn className="size-2.5" /> : kind === 'out' ? <LogOut className="size-2.5" /> : <Timer className="size-2.5" />}
      </span>
      <span className={cn('flex-1 text-[9px]', kind === 'now' ? 'text-brand-300' : 'text-slate-400')}>{label}</span>
      <span className={cn('text-[11px] font-bold tabular-nums', kind === 'now' ? 'text-brand-200' : 'text-white')}>{time}</span>
    </div>
  );
}

/**
 * Celular de demonstração com a tela de bater ponto (dados de exemplo, relógio real).
 * Usado no painel da marca na tela de login.
 */
export function PhoneMockup() {
  const now = useNow();
  const [hh, mm, ss] = now.toLocaleTimeString('pt-BR').split(':');
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const statusTime = `${hh}:${mm}`;

  // Exemplo: entrou 08:02, almoço 12:00–13:00, trabalhando desde então (progresso anima com os segundos)
  const progress = 0.62 + (Number(ss) / 60) * 0.01;
  const r = 15;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative mx-auto w-[260px] animate-phone-float select-none" aria-hidden>
      {/* Brilho atrás do aparelho */}
      <div className="absolute inset-x-6 top-16 bottom-10 rounded-full bg-brand-500/40 blur-3xl" />

      {/* Moldura */}
      <div className="relative rounded-[2.75rem] bg-gradient-to-b from-slate-600 to-slate-800 p-[3px] shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-[2.6rem] bg-ink-900 ring-1 ring-black">
          {/* Barra de status + ilha */}
          <div className="relative flex h-9 items-center justify-between px-6 text-[10px] font-semibold text-white">
            <span className="tabular-nums">{statusTime}</span>
            <span className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-px">
                {[3, 5, 7, 9].map((h) => (
                  <span key={h} className="w-[3px] rounded-sm bg-white" style={{ height: h }} />
                ))}
              </span>
              <span className="ml-1 h-2.5 w-5 rounded-[3px] border border-white/70 p-px">
                <span className="block h-full w-3/4 rounded-[1px] bg-white" />
              </span>
            </span>
          </div>

          {/* Topo do app */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 pb-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-brand-700 text-[8px] font-black text-white">
              TAI
            </span>
            <span className="text-[10px] font-semibold text-white">Sistema de Ponto</span>
          </div>

          <div className="space-y-2.5 p-3">
            {/* Card do relógio */}
            <div className="relative overflow-hidden rounded-2xl bg-ink-950 px-3 py-4 text-center ring-1 ring-white/[0.06]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,109,255,0.4),transparent_70%)]" />
              <div className="relative">
                <p className="text-[9px] text-slate-400">
                  {greeting(now.getHours())}, <span className="font-medium text-white">bem-vindo</span>
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[8px] font-medium text-emerald-300 ring-1 ring-emerald-400/20">
                  <span className="size-1 rounded-full bg-emerald-400" />
                  Em expediente desde 08:02
                </span>
                <p className="mt-2 font-semibold tracking-tight text-white tabular-nums">
                  <span className="text-4xl">
                    {hh}:{mm}
                  </span>
                  <span className="ml-0.5 text-base text-slate-500">{ss}</span>
                </p>
                <p className="text-[9px] text-slate-400 first-letter:uppercase">{date}</p>
                <div className="mx-auto mt-3 flex h-9 w-40 animate-pulse-ring items-center justify-center gap-1.5 rounded-xl bg-brand-500 text-[11px] font-semibold text-white">
                  <Fingerprint className="size-4" />
                  Registrar saída
                </div>
              </div>
            </div>

            {/* Card de hoje */}
            <div className="rounded-2xl bg-ink-850 p-3 ring-1 ring-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="relative size-11 shrink-0">
                  <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                    <circle cx="18" cy="18" r={r} fill="none" stroke="white" strokeOpacity="0.08" strokeWidth="4" />
                    <circle
                      cx="18"
                      cy="18"
                      r={r}
                      fill="none"
                      stroke="#3b6dff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={c}
                      strokeDashoffset={c * (1 - progress)}
                      className="transition-[stroke-dashoffset] duration-700"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div>
                  <p className="text-lg leading-none font-bold text-white tabular-nums">5:02</p>
                  <p className="mt-0.5 text-[9px] text-slate-500">trabalhadas de 8h</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <MiniEvent kind="in" time="08:02" />
                <MiniEvent kind="out" time="12:00" />
                <MiniEvent kind="in" time="13:00" />
                <MiniEvent kind="now" time="1:04" />
              </div>
            </div>
          </div>

          {/* Barra de abas */}
          <div className="flex border-t border-white/[0.06] bg-ink-950/90 px-2 pt-1.5 pb-4">
            {[
              { icon: Fingerprint, label: 'Ponto', active: true },
              { icon: ClipboardList, label: 'Registros' },
              { icon: UserRound, label: 'Conta' },
            ].map(({ icon: IconCmp, label, active }) => (
              <div
                key={label}
                className={cn('flex flex-1 flex-col items-center gap-0.5 text-[8px]', active ? 'text-white' : 'text-slate-500')}
              >
                <span className={cn('flex h-5 w-9 items-center justify-center rounded-full', active && 'bg-brand-500/20')}>
                  <IconCmp className={cn('size-3', active && 'text-brand-300')} />
                </span>
                {label}
              </div>
            ))}
          </div>
          {/* Barra de gestos */}
          <span className="absolute bottom-1.5 left-1/2 h-1 w-20 -translate-x-1/2 rounded-full bg-white/60" />
        </div>
      </div>
    </div>
  );
}
