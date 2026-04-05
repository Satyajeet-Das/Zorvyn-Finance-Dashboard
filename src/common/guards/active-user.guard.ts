// src/common/guards/active-user.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { User, UserStatus } from '../../../generated/prisma/client';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user: User }>();

    if (!user) return true; // Let JwtAuthGuard handle unauthenticated

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('Your account has been deactivated. Contact an administrator.');
    }

    return true;
  }
}
