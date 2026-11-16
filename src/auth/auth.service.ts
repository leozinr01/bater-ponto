import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { tokenPayloadSchema } from './jwt.strategy';

const BCRYPT_ROUNDS = 10;
// Comparado quando o e-mail não existe, para o tempo de resposta não revelar quais e-mails estão cadastrados.
const DUMMY_HASH =
  '$2b$10$kSfo.sSkNpD/L8WDWqoMQelgnoe4TNRwLl3f92x8qCVFO0NbUw.yW';

export const hashPassword = (password: string) => hash(password, BCRYPT_ROUNDS);

/** Senhas erradas seguidas que bloqueiam o login da conta, e por quanto tempo. */
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MINUTES = 15;

const lockedError = (until: Date) => {
  const minutes = Math.max(
    1,
    Math.ceil((until.getTime() - Date.now()) / 60_000),
  );
  return new HttpException(
    `Muitas senhas erradas seguidas. Tente de novo em ${minutes} min ou peça ao administrador para redefinir a senha.`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private env: EnvService,
  ) {}

  /**
   * O limite por minuto (ThrottlerGuard) fica na memória de cada instância da Vercel; este
   * contador fica no banco e vale para todas: 5 senhas erradas seguidas bloqueiam a conta por 15 min.
   */
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Durante o bloqueio nem a senha certa entra, senão o bloqueio não segura quem está adivinhando
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw lockedError(user.lockedUntil);
    }

    const valid = await compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !valid || !user.active) {
      if (user && !valid) await this.registerFailedLogin(user.id);
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    if (user.failedLogins > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }
    return this.issueTokens(user);
  }

  private async registerFailedLogin(userId: string) {
    const { failedLogins } = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLogins: { increment: 1 } },
      select: { failedLogins: true },
    });
    if (failedLogins >= MAX_FAILED_LOGINS) {
      const until = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { failedLogins: 0, lockedUntil: until },
      });
      throw lockedError(until);
    }
  }

  async refresh(refreshToken: string) {
    const invalid = new UnauthorizedException(
      'Refresh token inválido ou expirado',
    );

    let payload: unknown;
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw invalid;
    }

    const parsed = tokenPayloadSchema.safeParse(payload);
    if (!parsed.success || parsed.data.type !== 'refresh') throw invalid;

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.data.sub },
    });

    if (!user || !user.active || user.tokenVersion !== parsed.data.ver) {
      throw invalid;
    }

    return this.issueTokens(user);
  }

  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!(await compare(currentPassword, user.password))) {
      throw new BadRequestException('Senha atual incorreta');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await hashPassword(newPassword),
        tokenVersion: { increment: 1 },
      },
    });

    // Os tokens antigos deixam de valer; devolve um par novo para a sessão atual.
    return this.issueTokens(updated);
  }

  private issueTokens(user: Pick<User, 'id' | 'tokenVersion'>) {
    const ver = user.tokenVersion;

    return {
      accessToken: this.jwt.sign(
        { sub: user.id, type: 'access', ver },
        { expiresIn: this.env.get('JWT_ACCESS_EXPIRES_IN') },
      ),
      refreshToken: this.jwt.sign(
        { sub: user.id, type: 'refresh', ver },
        { expiresIn: this.env.get('JWT_REFRESH_EXPIRES_IN') },
      ),
    };
  }
}
