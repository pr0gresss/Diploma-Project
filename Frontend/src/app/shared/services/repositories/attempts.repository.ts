import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import {
  AttemptPage,
  AttemptPageParams,
  AttemptResult,
  PageParams,
  SubmitAttemptRequest,
} from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class AttemptsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  submitQuizAttempt(quizId: string, request: SubmitAttemptRequest): Observable<AttemptResult> {
    return this.http.post<AttemptResult>(`${this.baseUrl}/quizzes/${quizId}/attempts`, request);
  }

  listQuizAttempts(quizId: string, params: AttemptPageParams = {}): Observable<AttemptPage> {
    return this.http.get<AttemptPage>(`${this.baseUrl}/quizzes/${quizId}/attempts`, {
      params: toHttpParams(params),
    });
  }

  listMyAttempts(params: PageParams = {}): Observable<AttemptPage> {
    return this.http.get<AttemptPage>(`${this.baseUrl}/me/attempts`, {
      params: toHttpParams(params),
    });
  }

  getAttemptResult(attemptId: string): Observable<AttemptResult> {
    return this.http.get<AttemptResult>(`${this.baseUrl}/attempts/${attemptId}`);
  }
}
