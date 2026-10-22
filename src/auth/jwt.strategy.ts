import { PrismaService } from '@/infra/database/prisma.service';
import { EnvService } from '@/infra/env/env.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { z } from 'zod';
import { AuthUser } from './decorators';

export const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  type: z.enum(['access', 'refresh']),
  ver: z.number().int(),
});

export type TokenPayload = z.infer<typeof tokenPayloadSchema>;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    env: EnvService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.get('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /**
   * O papel e o status vêm do banco, não do token: desativar um usuário ou
   * mudar seu papel tem efeito imediato.
   */
  async validate(raw: unknown): Promise<AuthUser> {
    const parsed = tokenPayloadSchema.safeParse(raw);
    if (!parsed.success || parsed.data.type !== 'access') {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: parsed.data.sub },
      select: { id: true, role: true, active: true, tokenVersion: true },
    });

    if (!user || !user.active || user.tokenVersion !== parsed.data.ver) {
      throw new UnauthorizedException('Token inválido');
    }

    return { id: user.id, role: user.role };
  }
}
