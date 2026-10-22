import { QrCode, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from './ui';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/**
 * Endereço público do app para o QR code. Use VITE_PUBLIC_URL no build se o front
 * for acessado por um endereço diferente do que está aberto (ex.: domínio próprio).
 */
export function publicAppUrl() {
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  return {
    // ?instalar=1 faz o app abrir já mostrando o convite de instalação
    url: `${base}/?instalar=1`,
    local: LOCAL_HOSTS.includes(new URL(base).hostname),
  };
}

/** QR code que abre o app no celular para instalar. `className` vai no invólucro (ex.: margens, esconder). */
export function QrInstall({ className }: { className?: string }) {
  const { url, local } = publicAppUrl();

  return (
    <div className={className}>
      <div className="flex items-center gap-5 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur-sm">
        <div className={cn('relative shrink-0 rounded-xl bg-white p-2 shadow-lg', local && 'opacity-40')}>
          <QRCodeSVG
            value={url}
            size={108}
            level="M"
            bgColor="#ffffff"
            fgColor="#0a1020"
            imageSettings={{ src: '/pwa-64x64.png', height: 24, width: 24, excavate: true }}
          />
          {local && (
            <span className="absolute inset-0 flex items-center justify-center">
              <QrCode className="size-8 text-ink-950" />
            </span>
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="flex items-center gap-2 font-semibold text-white">
            <Smartphone className="size-4 text-brand-300" />
            Instale no celular
          </p>
          {local ? (
            <p className="mt-1 text-xs text-amber-300/90">
              Disponível após publicar o app: em <span className="font-mono">localhost</span> o celular não consegue abrir.
            </p>
          ) : (
            <ol className="mt-1.5 space-y-0.5 text-xs text-slate-400">
              <li>1. Aponte a câmera do celular para o código.</li>
              <li>2. Abra o link e toque em "Instalar".</li>
              <li>3. Pronto: o Ponto TAI fica na sua tela inicial.</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
