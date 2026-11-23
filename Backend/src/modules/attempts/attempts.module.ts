import { Module } from '@nestjs/common';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController } from './attempts.controller.js';

@Module({
  imports: [QuizzesModule],
  providers: [AttemptsRepository, AttemptsService],
  controllers: [AttemptsController],
  exports: [AttemptsRepository, AttemptsService],
})
export class AttemptsModule {}
