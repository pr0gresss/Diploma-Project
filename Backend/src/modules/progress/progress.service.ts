import { Injectable } from '@nestjs/common';
import { normalizePageQuery } from '../../common/pagination.js';
import { ProgressRepository } from './progress.repository.js';
import type {
  ProgressListQuery,
  ProgressOverview,
  ProgressReport,
} from './progress.types.js';

@Injectable()
export class ProgressService {
  constructor(private readonly progressRepository: ProgressRepository) {}

  async getReport(
    userId: string,
    query: ProgressListQuery = {},
  ): Promise<ProgressReport> {
    const normalized = normalizePageQuery(query);

    const [page, overview] = await Promise.all([
      this.progressRepository.findByUser(userId, normalized),
      this.progressRepository.getOverview(userId),
    ]);

    return { ...page, overview };
  }

  async getOverview(userId: string): Promise<ProgressOverview> {
    return this.progressRepository.getOverview(userId);
  }
}
