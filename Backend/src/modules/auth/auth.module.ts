import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationModule, type Duration } from '@nestjs/authentication';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { JwtAuthProvider } from './jwt-auth.provider.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    UsersModule,
    AuthenticationModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        accessToken: {
          key: config.getOrThrow<string>('JWT_SECRET'),
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          ttl: config.getOrThrow<Duration>('JWT_ACCESS_TTL'),
        },
        // Stateless access tokens; no refresh-token table is needed.
        refreshToken: false,
      }),
    }),
  ],
  providers: [JwtAuthProvider, AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
