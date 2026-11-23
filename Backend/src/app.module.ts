import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnvironment } from './config/environment.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { AttemptsModule } from './modules/attempts/attempts.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { ProcessingJobsModule } from './modules/processing-jobs/processing-jobs.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { QuizzesModule } from './modules/quizzes/quizzes.module.js';
import { StudyGuidesModule } from './modules/study-guides/study-guides.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ApplicationErrorFilter } from './common/http/application-error.filter.js';
import { ValidationError } from './common/errors/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    StorageModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProcessingJobsModule,
    MaterialsModule,
    StudyGuidesModule,
    QuizzesModule,
    AttemptsModule,
    ProgressModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: ApplicationErrorFilter },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new StandardSchemaValidationPipe({
          exceptionFactory: () =>
            new ValidationError('Request validation failed'),
        }),
    },
  ],
})
export class AppModule {}
