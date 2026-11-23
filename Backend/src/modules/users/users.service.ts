import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/index.js';
import type { AuthUser } from './auth-user.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
