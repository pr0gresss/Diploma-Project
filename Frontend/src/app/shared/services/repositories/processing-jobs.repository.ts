import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import { ProcessingJobSummary } from '../api.models';

@Injectable({ providedIn: 'root' })
export class ProcessingJobsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMaterialJobs(materialId: string): Observable<ProcessingJobSummary[]> {
    return this.http.get<ProcessingJobSummary[]>(`${this.baseUrl}/materials/${materialId}/jobs`);
  }
}
