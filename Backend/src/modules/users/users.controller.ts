import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiEndpoint({
    id: 'getMyProfile',
    summary: 'Read the current account profile',
    response: 'User',
    errors: [404],
  })
  getProfile(@CurrentUser('id') userId: string) {
    return this.users.getProfile(userId);
  }
}
