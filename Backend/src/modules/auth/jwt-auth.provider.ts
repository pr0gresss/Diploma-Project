import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import type { AuthUser } from '../users/auth-user.js';
import { UsersRepository } from '../users/users.repository.js';

/**
 * Verifies `Authorization: Bearer <jwt>` tokens issued by `TokenService`.
 * Returning `null` for a deleted account rejects a still-valid token.
 */
@Injectable()
export class JwtAuthProvider extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super({ realm: 'ai-study-workspace' });
    registry.registerProvider(this);
  }

  protected async validate(claims: JwtClaims): Promise<AuthUser | null> {
    return claims.sub ? this.usersRepository.findById(claims.sub) : null;
  }
}
