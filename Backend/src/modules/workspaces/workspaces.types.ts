import type { PageQuery } from '../../common/pagination.js';

export interface CreateWorkspaceInput {
  name: string;
}

export interface UpdateWorkspaceInput {
  name: string;
}

export type WorkspaceListQuery = PageQuery;

export interface WorkspaceSummary {
  id: string;
  name: string;
  materialCount: number;
  createdAt: Date;
  updatedAt: Date;
}
