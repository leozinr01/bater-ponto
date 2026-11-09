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

  config() {
    return { enabled: this.publicKey !== null, publicKey: this.publicKey };
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

  /** Chamado pelo agendador: envia os lembretes devidos agora. */
  async tick(authorization: string | undefined) {
    this.assertCronSecret(authorization);
    if (!this.publicKey) return { enabled: false, sent: 0 };

    const today = await this.punches.today();
    const subscribed = new Set(
      (
        await this.prisma.pushSubscription.findMany({
          select: { userId: true },
          distinct: ['userId'],
        })
      ).map((s) => s.userId),
    );
    const due = dueReminders(
      today.employees.filter((e) => subscribed.has(e.employee.id)),
      new Date(),
      today.now.slice(11, 16),
    );

    let sent = 0;
    for (const reminder of due) {
      if (!(await this.claim(reminder, today.date))) continue;
      sent += await this.sendToUser(reminder.userId, {
        title: reminder.title,
        body: reminder.body,
        tag: `lembrete-${reminder.kind}`,
      });
    }
    return { enabled: true, due: due.length, sent };
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
