import type { PageQuery } from '../../common/pagination.js';
import type { MaterialProcessingStatus } from '../../generated/prisma/enums.js';
import type { UploadedMaterialFile } from '../../infrastructure/files/material-file.validator.js';
import type { ProcessingJobSummary } from '../processing-jobs/processing-jobs.types.js';

export interface UploadMaterialInput {
  file: UploadedMaterialFile;
  displayName?: string;
}

export interface MaterialListQuery extends PageQuery {
  status?: MaterialProcessingStatus;
}

export interface MaterialSummary {
  id: string;
  workspaceId: string;
  originalFilename: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  processingStatus: MaterialProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
  jobCount: number;
  guideCount: number;
  quizCount: number;
}

export interface MaterialDetails extends MaterialSummary {
  processingJobs: ProcessingJobSummary[];
}

export interface MaterialRenameInput {
  displayName: string;
}
