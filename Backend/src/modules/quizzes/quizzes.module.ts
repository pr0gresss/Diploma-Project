import { Module } from '@nestjs/common';
import { MaterialsModule } from '../materials/materials.module.js';
import { QuizzesRepository } from './quizzes.repository.js';
import { QuizzesService } from './quizzes.service.js';
import { QuizzesController } from './quizzes.controller.js';
import { AiCompletionsModule } from '../../infrastructure/ai/ai.module.js';
import { QuizGenerationService } from './quiz-generation.service.js';

@Module({
  imports: [MaterialsModule, AiCompletionsModule],
  providers: [QuizzesRepository, QuizzesService, QuizGenerationService],
  controllers: [QuizzesController],
  exports: [QuizzesRepository, QuizzesService],
})
export class QuizzesModule {}
