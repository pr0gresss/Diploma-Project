import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import type { AuthUser, UserCredentials } from './auth-user.js';

const publicUserSelect = {
  id: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AuthUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });
  }

  /**
   * `users.email` is unique through a functional index on `lower(email)`, so
   * every lookup must be case-insensitive.
   */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        ...publicUserSelect,
        passwordHash: true,
      },
    });

    if (!row) {
      return null;
    }

    const { passwordHash, ...user } = row;
    return { user, passwordHash };
  }

  async create(email: string, passwordHash: string): Promise<AuthUser> {
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash },
        select: publicUserSelect,
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict: 'An account with this email address already exists',
      });
    }
  }

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
        select: { id: true },
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'User not found',
      });
    }
  }
}
