import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  registerSchema,
  signInSchema,
  type RegisterBody,
} from '../../common/http/request.schemas.js';
import { AuthService } from './auth.service.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiEndpoint({
    id: 'registerAccount',
    summary: 'Register an account and receive an access token',
    description:
      'Public operation. Emails are unique case-insensitively. Passwords require 12–128 characters. No refresh token is issued.',
    status: 201,
    response: 'AuthSession',
    body: registerSchema,
    errors: [409],
    public: true,
    example: {
      email: 'student@example.com',
      password: 'StrongStudyPassword!2026',
    },
  })
  register(@Body({ schema: registerSchema }) body: RegisterBody) {
    return this.auth.register(body);
  }

  @Public()
  @Post('sign-in')
  @HttpCode(200)
  @ApiEndpoint({
    id: 'signIn',
    summary: 'Sign in using email and password',
    description:
      'Public operation. Returns a short-lived bearer access token. Sign in again after expiry; refresh/logout endpoints are not provided.',
    response: 'AuthSession',
    body: signInSchema,
    public: true,
    example: { email: 'alice@example.com', password: 'StudyDemo!2026' },
  })
  signIn(@Body({ schema: signInSchema }) body: RegisterBody) {
    return this.auth.signIn(body);
  }
}
