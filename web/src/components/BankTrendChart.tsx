import { useState } from 'react';
import { formatMinutes, formatMonth } from '../lib/format';

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

const signed = (m: number) => `${m > 0 ? '+' : ''}${formatMinutes(m)}`;

/** Passo "bonito" do eixo em minutos: múltiplos de 30 min, 1h, 2h, 5h, 10h... */
function niceStep(range: number) {
  const steps = [30, 60, 120, 300, 600, 1200, 3000, 6000];
  return steps.find((s) => range / s <= 4) ?? 12000;
}

/**
 * Tendência do banco de horas: saldo acumulado no fim de cada mês.
 * Uma série só (sem legenda); a linha tracejada marca o zero. A tabela do extrato é a versão em texto.
 */
export function BankTrendChart({ months }: { months: { month: string; accumulatedMinutes: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (months.length < 2) return null;

  const values = months.map((m) => m.accumulatedMinutes);
  const step = niceStep(Math.max(...values, 0) - Math.min(...values, 0) || 60);
  const max = Math.ceil(Math.max(...values, 0) / step) * step || step;
  const min = Math.floor(Math.min(...values, 0) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / (months.length - 1);
  const y = (v: number) => PAD.top + innerH * (1 - (v - min) / (max - min));
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  // Rótulos do eixo X sem encavalar: no máximo ~6
  const every = Math.ceil(months.length / 6);
  const active = hover ?? months.length - 1;
  const current = months[active];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Saldo acumulado do banco de horas por mês, de ${formatMonth(months[0].month)} a ${formatMonth(months.at(-1)!.month)}. Atual: ${signed(values.at(-1)!)}.`}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className={t === 0 ? 'stroke-slate-500' : 'stroke-white/[0.06]'}
              strokeDasharray={t === 0 ? '4 4' : undefined}
            />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[11px] tabular-nums">
              {signed(t)}
            </text>
          </g>
        ))}
        {months.map((m, i) =>
          i % every === 0 || i === months.length - 1 ? (
            <text key={m.month} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {formatMonth(m.month).slice(0, 3)}/{m.month.slice(2, 4)}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-white/20" />
        )}
        <polyline points={points} fill="none" className="stroke-brand-400" strokeWidth={2} strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle
            key={months[i].month}
            cx={x(i)}
            cy={y(v)}
            r={i === active ? 5 : 3}
            className="fill-brand-400 stroke-ink-900"
            strokeWidth={2}
          />
        ))}

        {/* Alvos de toque maiores que os pontos: uma faixa vertical por mês */}
        {months.map((m, i) => (
          <rect
            key={m.month}
            x={x(i) - innerW / (months.length - 1) / 2}
            y={PAD.top}
            width={innerW / (months.length - 1)}
            height={innerH}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        ))}
      </svg>

      <div
        className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-white/10"
        // Preso entre as bordas para a dica não sair do cartão no primeiro e no último mês
        style={{ left: `${Math.min(88, Math.max(12, (x(active) / W) * 100))}%` }}
        aria-hidden
      >
        <p className="whitespace-nowrap text-slate-400">{formatMonth(current.month)}</p>
        <p className="font-semibold whitespace-nowrap text-white tabular-nums">{signed(current.accumulatedMinutes)}</p>
      </div>
    </div>
  );
}
