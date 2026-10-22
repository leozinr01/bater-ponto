import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, Roles } from './decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) {
      return true;
    }

    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar esta rota',
      );
    }

    return true;
  }
}
