import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Material,
  MaterialDetails,
  MaterialPage,
  MaterialPageParams,
  ProcessingJobSummary,
} from './api.models';
import { MaterialsRepository } from './repositories/materials.repository';

@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly repository = inject(MaterialsRepository);

  listMaterials(workspaceId: string, params: MaterialPageParams = {}): Observable<MaterialPage> {
    return this.repository.listMaterials(workspaceId, params);
  }

  uploadMaterial(workspaceId: string, file: File, displayName?: string): Observable<MaterialDetails> {
    return this.repository.uploadMaterial(workspaceId, file, displayName);
  }

  getMaterial(materialId: string): Observable<MaterialDetails> {
    return this.repository.getMaterial(materialId);
  }

  renameMaterial(materialId: string, displayName: string): Observable<Material> {
    return this.repository.renameMaterial(materialId, displayName);
  }

  deleteMaterial(materialId: string): Observable<void> {
    return this.repository.deleteMaterial(materialId);
  }

  getMaterialText(materialId: string): Observable<string> {
    return this.repository.getMaterialText(materialId);
  }

  retryExtraction(materialId: string): Observable<ProcessingJobSummary> {
    return this.repository.retryExtraction(materialId);
  }
}
