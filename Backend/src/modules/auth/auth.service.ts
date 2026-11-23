import { compare as compareBcrypt } from 'bcryptjs';
import { Injectable, Logger } from '@nestjs/common';
import { PasswordHasher, TokenService } from '@nestjs/authentication';
import {
  ConflictError,
  InvalidCredentialsError,
  ValidationError,
} from '../../common/errors/index.js';
import { logEvent } from '../../common/logging/log-event.js';
import { UsersRepository } from '../users/users.repository.js';
import type { AuthSession, RegisterInput, SignInInput } from './auth.types.js';

const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const BCRYPT_HASH_PATTERN = /^\$2[abxy]\$/;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthSession> {
    const email = this.normalizeEmail(input.email);
    this.validatePassword(input.password);

    if (await this.usersRepository.findCredentialsByEmail(email)) {
      throw new ConflictError(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.usersRepository.create(email, passwordHash);

    logEvent(this.logger, 'log', 'user_registered', { userId: user.id });

    return this.createSession(user);
  }

  async signIn(input: SignInInput): Promise<AuthSession> {
    const email = this.normalizeEmail(input.email);
    if (!input.password) {
      // A non-empty placeholder makes the hasher do the same work it would for
      // an existing account, so a blank password does not answer faster.
      await this.passwordHasher.verify(
        'invalid-password-placeholder',
        undefined,
      );
      throw new InvalidCredentialsError();
    }

    const credentials =
      await this.usersRepository.findCredentialsByEmail(email);
    const storedHash = credentials?.passwordHash;

    const valid = await this.verifyPassword(input.password, storedHash);
    if (!valid || !credentials) {
      throw new InvalidCredentialsError();
    }

    // The seeded demo accounts use bcrypt. A successful sign-in is the only
    // moment the plaintext is available, so upgrade them to the current hasher.
    if (storedHash && BCRYPT_HASH_PATTERN.test(storedHash)) {
      try {
        const upgraded = await this.passwordHasher.hash(input.password);
        await this.usersRepository.updatePasswordHash(
          credentials.user.id,
          upgraded,
        );
        logEvent(this.logger, 'log', 'password_hash_upgraded', {
          userId: credentials.user.id,
          from: 'bcrypt',
          to: 'scrypt',
        });
      } catch {
        // An upgrade failure must not reject an otherwise valid sign-in.
        logEvent(this.logger, 'warn', 'password_hash_upgrade_failed', {
          userId: credentials.user.id,
        });
      }
    } else if (storedHash && this.passwordHasher.needsRehash(storedHash)) {
      try {
        const upgraded = await this.passwordHasher.hash(input.password);
        await this.usersRepository.updatePasswordHash(
          credentials.user.id,
          upgraded,
        );
        logEvent(this.logger, 'log', 'password_hash_upgraded', {
          userId: credentials.user.id,
          from: 'scrypt',
          to: 'scrypt',
        });
      } catch {
        logEvent(this.logger, 'warn', 'password_hash_upgrade_failed', {
          userId: credentials.user.id,
        });
      }
    }

    logEvent(this.logger, 'log', 'user_signed_in', {
      userId: credentials.user.id,
    });

    return this.createSession(credentials.user);
  }

  private async createSession(user: AuthSession['user']): Promise<AuthSession> {
    const tokens = await this.tokenService.issue(user.id, {
      method: 'password',
      claims: { amr: ['pwd'] },
    });

    return {
      user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
    };
  }

  private async verifyPassword(
    password: string,
    storedHash: string | null | undefined,
  ): Promise<boolean> {
    if (storedHash && BCRYPT_HASH_PATTERN.test(storedHash)) {
      return compareBcrypt(password, storedHash);
    }

    // Passing undefined makes the hasher check a dummy hash, so an unknown
    // account and a wrong password look identical in timing.
    return this.passwordHasher.verify(password, storedHash);
  }

  private normalizeEmail(email: string): string {
    const normalized = email?.trim().normalize('NFC').toLowerCase();

    if (!normalized || normalized.length > EMAIL_MAX_LENGTH) {
      throw new ValidationError('A valid email address is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('A valid email address is required');
    }

    return normalized;
  }

  private validatePassword(password: string): void {
    if (typeof password !== 'string') {
      throw new ValidationError('A password is required');
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new ValidationError(
        `The password must contain at least ${PASSWORD_MIN_LENGTH} characters`,
      );
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new ValidationError(
        `The password must not exceed ${PASSWORD_MAX_LENGTH} characters`,
      );
    }
  }
}
