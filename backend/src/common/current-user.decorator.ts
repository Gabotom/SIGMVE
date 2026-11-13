import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from './roles';

/** Usuario autenticado tal como lo deja JwtStrategy.validate(). */
export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
}

/** Inyecta el usuario autenticado: `me(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
