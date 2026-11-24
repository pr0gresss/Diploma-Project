import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import { PageParams, ProgressReport } from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class ProgressRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getMyProgress(params: PageParams = {}): Observable<ProgressReport> {
    return this.http.get<ProgressReport>(`${this.baseUrl}/me/progress`, {
      params: toHttpParams(params),
    });
  }

  getMyProgressOverview(): Observable<ProgressReport> {
    return this.http.get<ProgressReport>(`${this.baseUrl}/me/progress/overview`);
  }
}
