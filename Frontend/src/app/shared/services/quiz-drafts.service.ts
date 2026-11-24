import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';
import { AttemptResult, QuizDraft, SaveQuizDraft } from './api.models';
@Injectable({providedIn: 'root'})
export class QuizDraftsService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  open(quizId: string) { return this.http.post<QuizDraft>(this.base + '/quizzes/' + quizId + '/drafts', {}); }
  get(id: string) { return this.http.get<QuizDraft>(this.base + '/quiz-drafts/' + id); }
  save(id: string, body: SaveQuizDraft) { return this.http.put<QuizDraft>(this.base + '/quiz-drafts/' + id, body); }
  submit(id: string, revision: number) { return this.http.post<AttemptResult>(this.base + '/quiz-drafts/' + id + '/submit', {revision}); }
}
