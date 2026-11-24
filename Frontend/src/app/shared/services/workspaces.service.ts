import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PageParams, Workspace, WorkspacePage } from './api.models';
import { WorkspacesRepository } from './repositories/workspaces.repository';

@Injectable({ providedIn: 'root' })
export class WorkspacesService {
  private readonly repository = inject(WorkspacesRepository);

  listWorkspaces(params: PageParams = {}): Observable<WorkspacePage> {
    return this.repository.listWorkspaces(params);
  }

  createWorkspace(name: string): Observable<Workspace> {
    return this.repository.createWorkspace(name);
  }

  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.repository.getWorkspace(workspaceId);
  }

  renameWorkspace(workspaceId: string, name: string): Observable<Workspace> {
    return this.repository.renameWorkspace(workspaceId, name);
  }

  deleteWorkspace(workspaceId: string): Observable<void> {
    return this.repository.deleteWorkspace(workspaceId);
  }
}
