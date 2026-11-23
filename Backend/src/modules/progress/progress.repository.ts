import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type { ProgressOverview, QuizProgress } from './progress.types.js';

interface ProgressRow {
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

interface ProgressCountRow {
  total: number;
}

interface ProgressOverviewRow {
  totalAttempts: number;
  completedQuizzes: number;
  workspacesStudied: number;
  averageScorePercent: number;
  bestScorePercent: number | null;
  lastCompletedAt: Date | null;
}

@Injectable()
export class ProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `v_user_quiz_progress` has no Prisma model, so it is queried with raw SQL.
   * The view already aggregates per user and quiz; the joins only add the
   * display names needed by the API.
   */
  async findByUser(
    userId: string,
    query: NormalizedPageQuery,
  ): Promise<Page<QuizProgress>> {
    const search = query.search ?? null;

    const rows = this.prisma.$queryRaw<ProgressRow[]>(Prisma.sql`
      SELECT
        progress.quiz_id AS "quizId",
        quiz.display_name AS "quizDisplayName",
        quiz.material_id AS "materialId",
        material.display_name AS "materialDisplayName",
        progress.workspace_id AS "workspaceId",
        workspace.name AS "workspaceName",
        progress.completed_attempts AS "completedAttempts",
        ROUND(progress.average_score_percent::numeric, 2)::float8 AS "averageScorePercent",
        progress.best_score_percent::float8 AS "bestScorePercent",
        progress.latest_score_percent::float8 AS "latestScorePercent",
        progress.last_completed_at AS "lastCompletedAt"
      FROM v_user_quiz_progress progress
      JOIN quizzes quiz ON quiz.id = progress.quiz_id
      JOIN materials material ON material.id = quiz.material_id
      JOIN workspaces workspace ON workspace.id = progress.workspace_id
      WHERE progress.user_id = ${userId}::uuid
        AND (
          ${search}::text IS NULL
          OR quiz.display_name ILIKE '%' || ${search} || '%'
          OR material.display_name ILIKE '%' || ${search} || '%'
          OR workspace.name ILIKE '%' || ${search} || '%'
        )
      ORDER BY progress.last_completed_at DESC, progress.quiz_id DESC
      LIMIT ${query.limit} OFFSET ${query.offset}
    `);

    const count = this.prisma.$queryRaw<ProgressCountRow[]>(Prisma.sql`
      SELECT COUNT(*)::integer AS "total"
      FROM v_user_quiz_progress progress
      JOIN quizzes quiz ON quiz.id = progress.quiz_id
      JOIN materials material ON material.id = quiz.material_id
      JOIN workspaces workspace ON workspace.id = progress.workspace_id
      WHERE progress.user_id = ${userId}::uuid
        AND (
          ${search}::text IS NULL
          OR quiz.display_name ILIKE '%' || ${search} || '%'
          OR material.display_name ILIKE '%' || ${search} || '%'
          OR workspace.name ILIKE '%' || ${search} || '%'
        )
    `);

    const [progressRows, countRows] = await this.prisma.$transaction([
      rows,
      count,
    ]);

    return pageOf(progressRows, countRows[0]?.total ?? 0, query);
  }

  async getOverview(userId: string): Promise<ProgressOverview> {
    const rows = await this.prisma.$queryRaw<ProgressOverviewRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::integer AS "totalAttempts",
        COUNT(DISTINCT attempt.quiz_id)::integer AS "completedQuizzes",
        COUNT(DISTINCT material.workspace_id)::integer AS "workspacesStudied",
        ROUND(COALESCE(AVG(attempt.score_percent), 0)::numeric, 2)::float8 AS "averageScorePercent",
        MAX(attempt.score_percent)::float8 AS "bestScorePercent",
        MAX(attempt.submitted_at) AS "lastCompletedAt"
      FROM quiz_attempts attempt
      JOIN quizzes quiz ON quiz.id = attempt.quiz_id
      JOIN materials material ON material.id = quiz.material_id
      WHERE attempt.user_id = ${userId}::uuid
    `);

    const row = rows[0];

    return {
      totalAttempts: row?.totalAttempts ?? 0,
      completedQuizzes: row?.completedQuizzes ?? 0,
      workspacesStudied: row?.workspacesStudied ?? 0,
      averageScorePercent: row?.averageScorePercent ?? 0,
      bestScorePercent: row?.bestScorePercent ?? 0,
      lastCompletedAt: row?.lastCompletedAt ?? null,
    };
  }
}
