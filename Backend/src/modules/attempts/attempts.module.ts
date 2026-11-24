import { QuizDraftsController } from './quiz-drafts.controller.js';
import { QuizDraftsService } from './quiz-drafts.service.js';
import { Module } from '@nestjs/common';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { AttemptsRepository } from './attempts.repository.js';
import { AttemptsService } from './attempts.service.js';
import { AttemptsController } from './attempts.controller.js';

@Module({
  imports: [QuizzesModule],
  providers: [QuizDraftsService, AttemptsRepository, AttemptsService],
  controllers: [QuizDraftsController, AttemptsController],
  exports: [AttemptsRepository, AttemptsService],
})
export class AttemptsModule {}
