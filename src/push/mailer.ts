import { EnvService } from '@/infra/env/env.service';
import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

/**
 * Envio dos lembretes por e-mail via SMTP (qualquer provedor; no Gmail, com senha de app).
 * Serve para quem não recebe notificação no navegador, como o iPhone sem o app na tela de início.
 * Sem SMTP_HOST, fica desligado e `send` não faz nada.
 */
@Injectable()
export class ReminderMailer {
  private readonly logger = new Logger(ReminderMailer.name);
  private readonly transport: Transporter | null;
  private readonly from: string | undefined;
  private readonly appUrl: string | undefined;

  constructor(env: EnvService) {
    const host = env.get('SMTP_HOST');
    const port = env.get('SMTP_PORT');
    const user = env.get('SMTP_USER');
    this.from = env.get('EMAIL_FROM') || user;
    this.appUrl = env.get('APP_URL');
    this.transport =
      host && this.from
        ? createTransport({
            host,
            port,
            secure: port === 465,
            auth: user ? { user, pass: env.get('SMTP_PASS') } : undefined,
            // Uma função serverless não pode ficar presa num servidor lento
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
          })
        : null;
  }

  get enabled() {
    return this.transport !== null;
  }

  /** true se enviou. Falhas são registradas no log e não interrompem os outros lembretes. */
  async send(to: string, title: string, body: string): Promise<boolean> {
    if (!this.transport) return false;
    const link = this.appUrl ? `\n\nBater ponto: ${this.appUrl}` : '';
    try {
      await this.transport.sendMail({
        from: this.from,
        to,
        subject: title,
        text: `${body}${link}\n\n—\nLembrete automático do sistema de ponto. Para não receber mais, desligue em Minha conta → Lembretes.`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`E-mail não enviado: ${(err as Error).message}`);
      return false;
    }
  }
}
