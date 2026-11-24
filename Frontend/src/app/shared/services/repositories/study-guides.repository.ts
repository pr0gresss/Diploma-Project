import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import {
  CreateStudyGuideRequest,
  PageParams,
  StudyGuide,
  StudyGuideContent,
  StudyGuidePage,
  UpdateStudyGuideContentRequest,
} from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class StudyGuidesRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listStudyGuides(materialId: string, params: PageParams = {}): Observable<StudyGuidePage> {
    return this.http.get<StudyGuidePage>(`${this.baseUrl}/materials/${materialId}/study-guides`, {
      params: toHttpParams(params),
    });
  }

  createStudyGuide(
    materialId: string,
    request: CreateStudyGuideRequest,
  ): Observable<StudyGuide> {
    return this.http.post<StudyGuide>(
      `${this.baseUrl}/materials/${materialId}/study-guides`,
      request,
    );
  }

  getStudyGuide(guideId: string): Observable<StudyGuideContent> {
    return this.http.get<StudyGuideContent>(`${this.baseUrl}/study-guides/${guideId}`);
  }

  updateStudyGuideContent(
    guideId: string,
    request: UpdateStudyGuideContentRequest,
  ): Observable<StudyGuide> {
    return this.http.patch<StudyGuide>(
      `${this.baseUrl}/study-guides/${guideId}/content`,
      request,
    );
  }

  renameStudyGuide(guideId: string, displayName: string): Observable<StudyGuide> {
    return this.http.patch<StudyGuide>(`${this.baseUrl}/study-guides/${guideId}`, { displayName });
  }

  deleteStudyGuide(guideId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/study-guides/${guideId}`);
  }
}
