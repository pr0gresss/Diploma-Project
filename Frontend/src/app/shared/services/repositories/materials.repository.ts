import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import {
  Material,
  MaterialDetails,
  MaterialPage,
  MaterialPageParams,
  ProcessingJobSummary,
} from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class MaterialsRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listMaterials(workspaceId: string, params: MaterialPageParams = {}): Observable<MaterialPage> {
    return this.http.get<MaterialPage>(`${this.baseUrl}/workspaces/${workspaceId}/materials`, {
      params: toHttpParams(params),
    });
  }

  uploadMaterial(workspaceId: string, file: File, displayName?: string): Observable<MaterialDetails> {
    const body = new FormData();
    body.append('file', file);
    if (displayName) {
      body.append('displayName', displayName);
    }
    return this.http.post<MaterialDetails>(
      `${this.baseUrl}/workspaces/${workspaceId}/materials`,
      body,
    );
  }

  getMaterial(materialId: string): Observable<MaterialDetails> {
    return this.http.get<MaterialDetails>(`${this.baseUrl}/materials/${materialId}`);
  }

  renameMaterial(materialId: string, displayName: string): Observable<Material> {
    return this.http.patch<Material>(`${this.baseUrl}/materials/${materialId}`, { displayName });
  }

  deleteMaterial(materialId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/materials/${materialId}`);
  }

  getMaterialText(materialId: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/materials/${materialId}/text`, {
      responseType: 'text',
    });
  }

  retryExtraction(materialId: string): Observable<ProcessingJobSummary> {
    return this.http.post<ProcessingJobSummary>(
      `${this.baseUrl}/materials/${materialId}/extraction/retry`,
      {},
    );
  }
}
