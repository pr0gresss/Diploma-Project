import type { PageQuery } from '../../common/pagination.js';

export type GuideListQuery = PageQuery;

export interface CreateGuideInput {
  displayName?: string;
  content: string;
}

export interface RenameGuideInput {
  displayName: string;
}

export interface GuideSummary {
  id: string;
  materialId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuideWithContent extends GuideSummary {
  content: string;
}
