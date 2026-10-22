import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

// ---- Botões ----

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-400 focus-visible:outline-brand-400 disabled:bg-brand-500/40 disabled:text-white/60 disabled:shadow-none',
  secondary:
    'bg-ink-800 text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-ink-700 hover:text-white disabled:text-slate-500',
  danger:
    'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-400 focus-visible:outline-red-400 disabled:bg-red-500/40',
  ghost: 'text-slate-400 hover:bg-white/5 hover:text-white disabled:text-slate-600',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon: IconCmp,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: Icon;
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : IconCmp && <IconCmp className="size-4" strokeWidth={2.2} />}
      {children}
    </button>
  );
}

// ---- Formulários ----

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-300">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputClass =
  'block h-10 w-full rounded-xl border-0 bg-ink-800 px-3 text-sm text-slate-100 ring-1 ring-inset ring-white/10 transition placeholder:text-slate-500 hover:ring-white/20 focus:bg-ink-800 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'pr-8', className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto py-2.5', className)} rows={3} {...props} />;
}

/** Botões lado a lado para escolher uma opção (substitui select curto). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl bg-ink-800 p-1 ring-1 ring-white/10 ring-inset', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
            value === o.value ? 'bg-ink-600 text-white shadow-sm' : 'text-slate-400 hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Feedback ----

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-white/[0.06]', className)} />;
}

/** Esqueleto de página: cards de números + lista. */
export function Loading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2 rounded-2xl bg-ink-850 p-4 ring-1 ring-white/[0.06]">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}

const alertTones = {
  error: { cls: 'bg-red-500/10 text-red-200 ring-red-500/25', icon: CircleAlert, iconCls: 'text-red-400' },
  info: { cls: 'bg-brand-500/10 text-brand-100 ring-brand-500/25', icon: Info, iconCls: 'text-brand-400' },
  warning: { cls: 'bg-amber-500/10 text-amber-100 ring-amber-500/25', icon: TriangleAlert, iconCls: 'text-amber-400' },
  success: { cls: 'bg-emerald-500/10 text-emerald-100 ring-emerald-500/25', icon: CircleCheck, iconCls: 'text-emerald-400' },
};

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: keyof typeof alertTones }) {
  const { cls, icon: IconCmp, iconCls } = alertTones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm whitespace-pre-line ring-1 ring-inset', cls)}
    >
      <IconCmp className={cn('mt-0.5 size-4 shrink-0', iconCls)} />
      <div>{children}</div>
    </div>
  );
}

type BadgeTone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'brand';

const badgeTones: Record<BadgeTone, { cls: string; dot: string }> = {
  gray: { cls: 'bg-white/5 text-slate-400 ring-white/10', dot: 'bg-slate-500' },
  green: { cls: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20', dot: 'bg-emerald-400' },
  red: { cls: 'bg-red-500/10 text-red-300 ring-red-500/20', dot: 'bg-red-400' },
  amber: { cls: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', dot: 'bg-amber-400' },
  blue: { cls: 'bg-sky-500/10 text-sky-300 ring-sky-500/20', dot: 'bg-sky-400' },
  brand: { cls: 'bg-brand-500/10 text-brand-300 ring-brand-500/25', dot: 'bg-brand-400' },
};

export function Badge({ children, tone = 'gray', dot }: { children: ReactNode; tone?: BadgeTone; dot?: boolean }) {
  const t = badgeTones[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        t.cls,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

/** Iniciais do nome num círculo; a cor vem do nome, então é sempre a mesma para a pessoa. */
const avatarColors = [
  'from-brand-400 to-brand-700',
  'from-sky-400 to-cyan-700',
  'from-violet-400 to-purple-700',
  'from-emerald-400 to-teal-700',
  'from-amber-400 to-orange-700',
  'from-rose-400 to-pink-700',
];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-inner ring-1 ring-white/10',
        avatarColors[hash % avatarColors.length],
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-9 text-xs',
        size === 'lg' && 'size-16 text-xl',
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

// ---- Estrutura ----

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-ink-850 shadow-xl shadow-black/10 ring-1 ring-white/[0.06]', className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: IconCmp,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: Icon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <div className="flex items-center gap-3">
        {IconCmp && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-slate-400">
            <IconCmp className="size-4" />
          </span>
        )}
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  icon: IconCmp,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: Icon;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {IconCmp && (
          <span className="hidden size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/25 to-brand-700/10 text-brand-300 ring-1 ring-brand-400/20 sm:flex print:hidden">
            <IconCmp className="size-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

const statTones = {
  brand: { value: 'text-white', chip: 'bg-brand-500/15 text-brand-300' },
  green: { value: 'text-emerald-300', chip: 'bg-emerald-500/15 text-emerald-300' },
  red: { value: 'text-red-300', chip: 'bg-red-500/15 text-red-300' },
  amber: { value: 'text-amber-300', chip: 'bg-amber-500/15 text-amber-300' },
  gray: { value: 'text-white', chip: 'bg-white/5 text-slate-400' },
};

export function Stat({
  label,
  value,
  tone,
  hint,
  icon: IconCmp,
}: {
  label: string;
  value: ReactNode;
  tone?: 'green' | 'red' | 'amber' | 'brand';
  hint?: ReactNode;
  icon?: Icon;
}) {
  const t = statTones[tone ?? 'gray'];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-slate-400">{label}</p>
        {IconCmp && (
          <span className={cn('flex size-8 items-center justify-center rounded-lg', t.chip)}>
            <IconCmp className="size-4" />
          </span>
        )}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight tabular-nums', t.value)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

export function EmptyState({
  children,
  icon: IconCmp,
  action,
}: {
  children: ReactNode;
  icon?: Icon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center text-sm text-slate-400">
      {IconCmp && (
        <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] text-slate-400 ring-1 ring-white/10">
          <IconCmp className="size-6" />
        </span>
      )}
      <div className="max-w-sm">{children}</div>
      {action}
    </div>
  );
}

/** Estilos compartilhados das tabelas. */
export const table = {
  wrap: 'overflow-x-auto',
  table: 'w-full text-sm',
  thead: 'border-b border-white/[0.06] text-left text-xs font-medium text-slate-500',
  th: 'px-4 py-3 font-medium whitespace-nowrap',
  tbody: 'divide-y divide-white/[0.04]',
  tr: 'transition-colors hover:bg-white/[0.02]',
  td: 'px-4 py-3',
};

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3">
      <p className="text-xs text-slate-500">
        {totalPages > 1 && `Página ${page} de ${totalPages} · `}
        {total} registro(s)
      </p>
      {totalPages > 1 && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            Anterior
          </Button>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Modal ----

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: IconCmp,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: Icon;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-ink-850 p-0 text-slate-100 shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="flex max-h-[85vh] animate-fade-in flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div className="flex items-start gap-4">
              {IconCmp && (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                  <IconCmp className="size-5" />
                </span>
              )}
              <div>
                <h2 className="text-base font-semibold text-white">{title}</h2>
                {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-1 -mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"
              aria-label="Fechar"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 pb-6">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 rounded-b-2xl border-t border-white/[0.06] bg-black/10 px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
