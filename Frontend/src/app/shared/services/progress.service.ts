import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PageParams, ProgressReport } from './api.models';
import { ProgressRepository } from './repositories/progress.repository';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly repository = inject(ProgressRepository);

  getMyProgress(params: PageParams = {}): Observable<ProgressReport> {
    return this.repository.getMyProgress(params);
  }

  getMyProgressOverview(): Observable<ProgressReport> {
    return this.repository.getMyProgressOverview();
  }
}
