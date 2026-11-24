import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import { PageParams, Workspace, WorkspacePage } from '../api.models';
import { toHttpParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class WorkspacesRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listWorkspaces(params: PageParams = {}): Observable<WorkspacePage> {
    return this.http.get<WorkspacePage>(`${this.baseUrl}/workspaces`, {
      params: toHttpParams(params),
    });
  }

  createWorkspace(name: string): Observable<Workspace> {
    return this.http.post<Workspace>(`${this.baseUrl}/workspaces`, { name });
  }

  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.baseUrl}/workspaces/${workspaceId}`);
  }

  renameWorkspace(workspaceId: string, name: string): Observable<Workspace> {
    return this.http.patch<Workspace>(`${this.baseUrl}/workspaces/${workspaceId}`, { name });
  }

  deleteWorkspace(workspaceId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/workspaces/${workspaceId}`);
  }
}
