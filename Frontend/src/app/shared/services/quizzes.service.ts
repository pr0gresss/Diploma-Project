import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateQuizRequest,
  GenerateQuizRequest,
  PageParams,
  Quiz,
  QuizForTaking,
  QuizPage,
} from './api.models';
import { QuizzesRepository } from './repositories/quizzes.repository';

@Injectable({ providedIn: 'root' })
export class QuizzesService {
  private readonly repository = inject(QuizzesRepository);

  generateQuiz(materialId: string, request: GenerateQuizRequest): Observable<Quiz> {
    return this.repository.generateQuiz(materialId, request);
  }

  listQuizzes(materialId: string, params: PageParams = {}): Observable<QuizPage> {
    return this.repository.listQuizzes(materialId, params);
  }

  createQuiz(materialId: string, request: CreateQuizRequest): Observable<Quiz> {
    return this.repository.createQuiz(materialId, request);
  }

  getQuizForTaking(quizId: string): Observable<QuizForTaking> {
    return this.repository.getQuizForTaking(quizId);
  }

  renameQuiz(quizId: string, displayName: string): Observable<Quiz> {
    return this.repository.renameQuiz(quizId, displayName);
  }

  deleteQuiz(quizId: string): Observable<void> {
    return this.repository.deleteQuiz(quizId);
  }
}
