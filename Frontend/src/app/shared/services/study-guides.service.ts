import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateStudyGuideRequest,
  PageParams,
  StudyGuide,
  StudyGuideContent,
  StudyGuidePage,
  UpdateStudyGuideContentRequest,
} from './api.models';
import { StudyGuidesRepository } from './repositories/study-guides.repository';

@Injectable({ providedIn: 'root' })
export class StudyGuidesService {
  private readonly repository = inject(StudyGuidesRepository);

  listStudyGuides(materialId: string, params: PageParams = {}): Observable<StudyGuidePage> {
    return this.repository.listStudyGuides(materialId, params);
  }

  createStudyGuide(
    materialId: string,
    request: CreateStudyGuideRequest,
  ): Observable<StudyGuide> {
    return this.repository.createStudyGuide(materialId, request);
  }

  getStudyGuide(guideId: string): Observable<StudyGuideContent> {
    return this.repository.getStudyGuide(guideId);
  }

  updateStudyGuideContent(
    guideId: string,
    request: UpdateStudyGuideContentRequest,
  ): Observable<StudyGuide> {
    return this.repository.updateStudyGuideContent(guideId, request);
  }

  renameStudyGuide(guideId: string, displayName: string): Observable<StudyGuide> {
    return this.repository.renameStudyGuide(guideId, displayName);
  }

  deleteStudyGuide(guideId: string): Observable<void> {
    return this.repository.deleteStudyGuide(guideId);
  }
}
