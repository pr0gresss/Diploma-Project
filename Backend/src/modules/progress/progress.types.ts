import type { Page, PageQuery } from '../../common/pagination.js';

export type ProgressListQuery = PageQuery;

/**
 * One row of the read-only `v_user_quiz_progress` view, enriched with the
 * display names a client needs. Scores are percentages in the 0-100 range.
 */
export interface QuizProgress {
  quizId: string;
  quizDisplayName: string;
  materialId: string;
  materialDisplayName: string;
  workspaceId: string;
  workspaceName: string;
  completedAttempts: number;
  averageScorePercent: number;
  bestScorePercent: number;
  latestScorePercent: number;
  lastCompletedAt: Date;
}

/**
 * Totals across every quiz the authenticated user has attempted. They are
 * computed from the same source as the paginated rows, not from the current
 * page, so the numbers stay stable while paging.
 */
export interface ProgressOverview {
  totalAttempts: number;
  completedQuizzes: number;
  workspacesStudied: number;
  averageScorePercent: number;
  bestScorePercent: number;
  lastCompletedAt: Date | null;
}

export interface ProgressReport extends Page<QuizProgress> {
  overview: ProgressOverview;
}
