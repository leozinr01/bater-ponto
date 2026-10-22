import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import {
  BadRequestException,
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

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private env: EnvService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const valid = await compare(password, user?.password ?? DUMMY_HASH);

    if (!user || !valid || !user.active) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    return this.issueTokens(user);
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
