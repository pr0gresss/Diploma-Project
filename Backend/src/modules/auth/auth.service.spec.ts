import { PasswordHasher, TokenService } from '@nestjs/authentication';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UsersRepository } from '../users/users.repository.js';
import {
  ConflictError,
  InvalidCredentialsError,
  ValidationError,
} from '../../common/errors/index.js';

describe('AuthService', () => {
  const user = {
    id: 'user',
    email: 'student@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let users: {
    findCredentialsByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updatePasswordHash: ReturnType<typeof vi.fn>;
  };
  let hasher: {
    hash: ReturnType<typeof vi.fn>;
    verify: ReturnType<typeof vi.fn>;
    needsRehash: ReturnType<typeof vi.fn>;
  };
  let tokens: { issue: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    users = {
      findCredentialsByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(user),
      updatePasswordHash: vi.fn().mockResolvedValue(undefined),
    };
    hasher = {
      hash: vi.fn().mockResolvedValue('$scrypt$new'),
      verify: vi.fn().mockResolvedValue(true),
      needsRehash: vi.fn().mockReturnValue(false),
    };
    tokens = {
      issue: vi.fn().mockResolvedValue({ accessToken: 'jwt', expiresIn: 900 }),
    };
    service = new AuthService(
      users as unknown as UsersRepository,
      hasher as unknown as PasswordHasher,
      tokens as unknown as TokenService,
    );
  });

  it('normalizes email and returns no password hash', async () => {
    const result = await service.register({
      email: ' STUDENT@EXAMPLE.COM ',
      password: 'StrongPassword!123',
    });
    expect(users.create).toHaveBeenCalledWith(
      'student@example.com',
      '$scrypt$new',
    );
    expect(result).toEqual({
      user,
      accessToken: 'jwt',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
  });

  it.each(['', 'invalid', 'a'.repeat(321)])(
    'rejects invalid email %s',
    async (email) => {
      await expect(
        service.register({ email, password: 'StrongPassword!123' }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(users.create).not.toHaveBeenCalled();
    },
  );

  it.each(['short', 'a'.repeat(129), undefined])(
    'rejects invalid password',
    async (password) => {
      await expect(
        service.register({ email: user.email, password: password as string }),
      ).rejects.toBeInstanceOf(ValidationError);
    },
  );

  it('reports an existing account as a conflict', async () => {
    users.findCredentialsByEmail.mockResolvedValue({
      user,
      passwordHash: 'hash',
    });
    await expect(
      service.register({ email: user.email, password: 'StrongPassword!123' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('uses dummy verification for an unknown account', async () => {
    await expect(
      service.signIn({ email: user.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.verify).toHaveBeenCalledWith('wrong', undefined);
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('performs dummy work for blank passwords', async () => {
    await expect(
      service.signIn({ email: user.email, password: '' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(hasher.verify).toHaveBeenCalledWith(expect.any(String), undefined);
  });

  it('rejects wrong passwords', async () => {
    users.findCredentialsByEmail.mockResolvedValue({
      user,
      passwordHash: '$scrypt$old',
    });
    hasher.verify.mockResolvedValue(false);
    await expect(
      service.signIn({ email: user.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it.each([false, true])(
    'signs in and rehashes only when needed: %s',
    async (rehash) => {
      users.findCredentialsByEmail.mockResolvedValue({
        user,
        passwordHash: '$scrypt$old',
      });
      hasher.needsRehash.mockReturnValue(rehash);
      expect(
        (await service.signIn({ email: user.email, password: 'password' }))
          .accessToken,
      ).toBe('jwt');
      expect(users.updatePasswordHash).toHaveBeenCalledTimes(rehash ? 1 : 0);
    },
  );

  it('allows a valid sign-in when a rehash update fails', async () => {
    users.findCredentialsByEmail.mockResolvedValue({
      user,
      passwordHash: '$scrypt$old',
    });
    hasher.needsRehash.mockReturnValue(true);
    users.updatePasswordHash.mockRejectedValue(
      new Error('database unavailable'),
    );
    expect(
      (await service.signIn({ email: user.email, password: 'password' })).user,
    ).toEqual(user);
  });

  it('verifies and upgrades seeded bcrypt accounts', async () => {
    users.findCredentialsByEmail.mockResolvedValue({
      user,
      passwordHash: await hash('StudyDemo!2026', 4),
    });
    await service.signIn({ email: user.email, password: 'StudyDemo!2026' });
    expect(users.updatePasswordHash).toHaveBeenCalledWith(
      'user',
      '$scrypt$new',
    );
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});
