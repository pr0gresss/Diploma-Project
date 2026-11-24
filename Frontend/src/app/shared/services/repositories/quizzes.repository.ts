import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import {
  CreateQuizRequest,
  GenerateQuizRequest,
  PageParams,
  Quiz,
  QuizForTaking,
  QuizPage,
} from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class QuizzesRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  generateQuiz(materialId: string, request: GenerateQuizRequest): Observable<Quiz> {
    return this.http.post<Quiz>(
      `${this.baseUrl}/materials/${materialId}/quizzes/generate`,
      request,
    );
  }

  listQuizzes(materialId: string, params: PageParams = {}): Observable<QuizPage> {
    return this.http.get<QuizPage>(`${this.baseUrl}/materials/${materialId}/quizzes`, {
      params: toHttpParams(params),
    });
  }

  createQuiz(materialId: string, request: CreateQuizRequest): Observable<Quiz> {
    return this.http.post<Quiz>(`${this.baseUrl}/materials/${materialId}/quizzes`, request);
  }

  getQuizForTaking(quizId: string): Observable<QuizForTaking> {
    return this.http.get<QuizForTaking>(`${this.baseUrl}/quizzes/${quizId}`);
  }

  renameQuiz(quizId: string, displayName: string): Observable<Quiz> {
    return this.http.patch<Quiz>(`${this.baseUrl}/quizzes/${quizId}`, { displayName });
  }

  deleteQuiz(quizId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/quizzes/${quizId}`);
  }
}
