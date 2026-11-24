import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AttemptPage,
  AttemptPageParams,
  AttemptResult,
  PageParams,
  SubmitAttemptRequest,
} from './api.models';
import { AttemptsRepository } from './repositories/attempts.repository';

@Injectable({ providedIn: 'root' })
export class AttemptsService {
  private readonly repository = inject(AttemptsRepository);

  submitQuizAttempt(quizId: string, request: SubmitAttemptRequest): Observable<AttemptResult> {
    return this.repository.submitQuizAttempt(quizId, request);
  }

  listQuizAttempts(quizId: string, params: AttemptPageParams = {}): Observable<AttemptPage> {
    return this.repository.listQuizAttempts(quizId, params);
  }

  listMyAttempts(params: PageParams = {}): Observable<AttemptPage> {
    return this.repository.listMyAttempts(params);
  }

  getAttemptResult(attemptId: string): Observable<AttemptResult> {
    return this.repository.getAttemptResult(attemptId);
  }
}
