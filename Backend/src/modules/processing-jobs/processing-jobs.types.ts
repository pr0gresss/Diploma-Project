import type {
  ProcessingJobStatus,
  ProcessingJobType,
} from '../../generated/prisma/enums.js';

export interface ProcessingJobSummary {
  id: string;
  materialId: string;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface ClaimedJob extends ProcessingJobSummary {
  material: {
    id: string;
    workspaceId: string;
    storageKey: string;
    processingStatus: string;
  };
}
