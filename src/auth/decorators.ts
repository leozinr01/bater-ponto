import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
/** Libera a rota de autenticação. Por padrão todas as rotas exigem token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe a rota (ou controller) aos papéis informados. */
export const Roles = Reflector.createDecorator<UserRole[]>();

export interface AuthUser {
  id: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
