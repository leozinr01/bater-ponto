import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import { PunchesService } from '@/punches/punches.service';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import webpush, { WebPushError } from 'web-push';
import { ReminderMailer } from './mailer';
import { SubscribeDto } from './push.dto';
import { dueReminders, Reminder } from './reminders';

/**
 * Lembretes de entrada e saída por notificação push (Web Push com chaves VAPID).
 * Quem dispara é um agendador externo chamando POST /api/push/tick a cada poucos minutos
 * (veja o workflow .github/workflows/lembretes.yml); cada lembrete sai uma vez por dia.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string | null;
  private readonly cronSecret: string | undefined;

  constructor(
    private prisma: PrismaService,
    private punches: PunchesService,
    private mailer: ReminderMailer,
    env: EnvService,
  ) {
    const publicKey = env.get('VAPID_PUBLIC_KEY');
    const privateKey = env.get('VAPID_PRIVATE_KEY');
    this.publicKey = publicKey && privateKey ? publicKey : null;
    if (this.publicKey && privateKey) {
      webpush.setVapidDetails(
        env.get('VAPID_SUBJECT') || 'mailto:admin@localhost',
        this.publicKey,
        privateKey,
      );
    }
    this.cronSecret = env.get('CRON_SECRET');
  }

  /** O que está ligado no servidor e a preferência de e-mail do usuário. */
  async config(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailReminders: true, email: true },
    });
    return {
      enabled: this.publicKey !== null,
      publicKey: this.publicKey,
      emailEnabled: this.mailer.enabled,
      emailReminders: user?.emailReminders ?? false,
      email: user?.email ?? null,
    };
  }

  /** Liga ou desliga os lembretes por e-mail do próprio usuário. */
  async setEmailReminders(userId: string, enabled: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailReminders: enabled },
    });
    return { emailReminders: enabled };
  }

  /** Guarda o aparelho. O mesmo endereço reenviado (ou de outro usuário no aparelho) é atualizado. */
  async subscribe(userId: string, dto: SubscribeDto) {
    this.assertEnabled();
    const data = {
      userId,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { endpoint: dto.endpoint, ...data },
      update: data,
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { subscribed: false };
  }

  /** Notificação de teste para os aparelhos do próprio usuário. */
  async test(userId: string) {
    this.assertEnabled();
    const sent = await this.sendToUser(userId, {
      title: 'Lembretes ativados',
      body: 'Você vai receber um aviso na hora de bater a entrada e a saída.',
      tag: 'teste',
    });
    return { sent };
  }

  /**
   * Chamado pelo agendador: envia os lembretes devidos agora, por push (aparelhos inscritos)
   * e por e-mail (quem não desligou, com o SMTP configurado).
   */
  async tick(authorization: string | undefined) {
    this.assertCronSecret(authorization);
    const pushOn = this.publicKey !== null;
    const emailOn = this.mailer.enabled;
    if (!pushOn && !emailOn) return { enabled: false, sent: 0 };

    const today = await this.punches.today();
    const [subscriptions, emailUsers] = await Promise.all([
      pushOn
        ? this.prisma.pushSubscription.findMany({
            select: { userId: true },
            distinct: ['userId'],
          })
        : Promise.resolve<{ userId: string }[]>([]),
      emailOn
        ? this.prisma.user.findMany({
            where: { active: true, emailReminders: true },
            select: { id: true, email: true },
          })
        : Promise.resolve<{ id: string; email: string }[]>([]),
    ]);
    const subscribed = new Set(subscriptions.map((s) => s.userId));
    const emailOf = new Map(emailUsers.map((u) => [u.id, u.email] as const));
    const due = dueReminders(
      today.employees.filter(
        (e) => subscribed.has(e.employee.id) || emailOf.has(e.employee.id),
      ),
      new Date(),
      today.now.slice(11, 16),
    );

    let sent = 0;
    let emails = 0;
    for (const reminder of due) {
      if (!(await this.claim(reminder, today.date))) continue;
      if (subscribed.has(reminder.userId)) {
        sent += await this.sendToUser(reminder.userId, {
          title: reminder.title,
          body: reminder.body,
          tag: `lembrete-${reminder.kind}`,
        });
      }
      const email = emailOf.get(reminder.userId);
      if (
        email &&
        (await this.mailer.send(email, reminder.title, reminder.body))
      ) {
        emails++;
      }
    }
    return {
      enabled: true,
      push: pushOn,
      email: emailOn,
      due: due.length,
      sent,
      emails,
    };
  }

  /** Marca o lembrete como enviado; false se outro disparo já mandou hoje. */
  private async claim(reminder: Reminder, date: string) {
    try {
      await this.prisma.pushReminder.create({
        data: { userId: reminder.userId, date, kind: reminder.kind },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }
  }

  /** Envia para todos os aparelhos do usuário; remove os que o serviço de push diz não existirem mais. */
  private async sendToUser(
    userId: string,
    payload: { title: string; body: string; tag: string },
  ) {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    let sent = 0;
    for (const s of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, url: '/' }),
          { TTL: 60 * 60 },
        );
        sent++;
      } catch (err) {
        if (
          err instanceof WebPushError &&
          (err.statusCode === 404 || err.statusCode === 410)
        ) {
          await this.prisma.pushSubscription.delete({ where: { id: s.id } });
        } else {
          this.logger.warn(`Push não enviado: ${(err as Error).message}`);
        }
      }
    }
    return sent;
  }

  private assertEnabled() {
    if (!this.publicKey) {
      throw new ServiceUnavailableException(
        'Lembretes não configurados no servidor (faltam as chaves VAPID)',
      );
    }
  }

  /** Compara o segredo em tempo constante (hash dos dois lados para igualar o tamanho). */
  private assertCronSecret(authorization: string | undefined) {
    const given = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const hash = (v: string) => createHash('sha256').update(v).digest();
    if (
      !this.cronSecret ||
      !given ||
      !timingSafeEqual(hash(given), hash(this.cronSecret))
    ) {
      throw new UnauthorizedException();
    }
  }
}
