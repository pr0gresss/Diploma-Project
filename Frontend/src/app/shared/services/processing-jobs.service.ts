import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ProcessingJobSummary } from './api.models';
import { ProcessingJobsRepository } from './repositories/processing-jobs.repository';

@Injectable({ providedIn: 'root' })
export class ProcessingJobsService {
  private readonly repository = inject(ProcessingJobsRepository);

  listMaterialJobs(materialId: string): Observable<ProcessingJobSummary[]> {
    return this.repository.listMaterialJobs(materialId);
  }
}
