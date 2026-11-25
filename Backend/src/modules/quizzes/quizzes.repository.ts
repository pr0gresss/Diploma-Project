import type { Prisma } from '../../generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import { ConflictError } from '../../common/errors/index.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type {
  QuestionType,
  QuizForTaking,
  QuizSummary,
} from './quizzes.types.js';

const quizSelect = (userId?: string) =>
  ({
    id: true,
    materialId: true,
    displayName: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        questions: true,
        attempts: {
          where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' },
        },
      },
    },
    attempts: {
      where: { userId: userId ?? '00000000-0000-0000-0000-000000000000' },
      orderBy: { submittedAt: 'desc' as const },
      take: 1,
      select: { id: true, scorePercent: true },
    },
    drafts: {
      where: {
        userId: userId ?? '00000000-0000-0000-0000-000000000000',
        submittedAttemptId: null,
      },
      take: 1,
      select: { id: true, answersJson: true, updatedAt: true },
    },
  }) as const;

export interface QuizGradingQuestion {
  questionType?: QuestionType;
  id: string;
  position: number;
  prompt: string;
  explanation: string | null;
  options: Array<{
    id: string;
    position: number;
    optionText: string;
    isCorrect: boolean;
  }>;
}

export interface QuizForGrading {
  id: string;
  materialId: string;
  displayName: string;
  materialDisplayName: string;
  workspaceId: string;
  questions: QuizGradingQuestion[];
}

export interface CreateQuizData {
  id: string;
  materialId: string;
  displayName: string;
  questions: Array<{
    questionType: QuestionType;
    id: string;
    position: number;
    prompt: string;
    explanation: string | null;
    options: Array<{
      id: string;
      position: number;
      optionText: string;
      isCorrect: boolean;
    }>;
  }>;
}

@Injectable()
export class QuizzesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findManyByMaterial(
    ownerUserId: string,
    materialId: string,
    query: NormalizedPageQuery,
  ): Promise<Page<QuizSummary>> {
    const where = {
      materialId,
      material: { workspace: { ownerUserId } },
      ...(query.search
        ? {
            displayName: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quiz.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: quizSelect(ownerUserId),
      }),
      this.prisma.quiz.count({ where }),
    ]);

    return pageOf(rows.map(toQuizSummary), total, query);
  }

  async findOwnedById(
    ownerUserId: string,
    quizId: string,
  ): Promise<QuizSummary | null> {
    const row = await this.prisma.quiz.findFirst({
      where: {
        id: quizId,
        material: { workspace: { ownerUserId } },
      },
      select: quizSelect(ownerUserId),
    });

    return row ? toQuizSummary(row) : null;
  }

  /** Quiz structure for taking: correctness and explanations are omitted. */
  async findOwnedForTaking(
    ownerUserId: string,
    quizId: string,
  ): Promise<QuizForTaking | null> {
    const row = await this.prisma.quiz.findFirst({
      where: {
        id: quizId,
        material: { workspace: { ownerUserId } },
      },
      select: {
        id: true,
        materialId: true,
        displayName: true,
        material: {
          select: {
            displayName: true,
            workspaceId: true,
          },
        },
        questions: {
          orderBy: { position: 'asc' },
          select: {
            questionType: true,
            id: true,
            position: true,
            prompt: true,
            options: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                position: true,
                optionText: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      materialId: row.materialId,
      displayName: row.displayName,
      materialDisplayName: row.material.displayName,
      workspaceId: row.material.workspaceId,
      questions: row.questions.map((question) => ({
        questionType: question.questionType,
        id: question.id,
        position: question.position,
        prompt: question.prompt,
        options: question.options.map((option) => ({
          id: option.id,
          position: option.position,
          text: option.optionText,
        })),
      })),
    };
  }

  /** Full structure used only on the server to grade a submission. */
  async findOwnedForGrading(
    ownerUserId: string,
    quizId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<QuizForGrading | null> {
    const row = await (tx ?? this.prisma).quiz.findFirst({
      where: {
        id: quizId,
        material: { workspace: { ownerUserId } },
      },
      select: {
        id: true,
        materialId: true,
        displayName: true,
        material: {
          select: {
            displayName: true,
            workspaceId: true,
          },
        },
        questions: {
          orderBy: { position: 'asc' },
          select: {
            questionType: true,
            id: true,
            position: true,
            prompt: true,
            explanation: true,
            options: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                position: true,
                optionText: true,
                isCorrect: true,
              },
            },
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      materialId: row.materialId,
      displayName: row.displayName,
      materialDisplayName: row.material.displayName,
      workspaceId: row.material.workspaceId,
      questions: row.questions,
    };
  }

  /**
   * Publishes a complete quiz, its questions and options in one nested write.
   * Prisma wraps the whole tree in a single transaction.
   */
  async create(data: CreateQuizData): Promise<QuizSummary> {
    try {
      const row = await this.prisma.quiz.create({
        data: {
          id: data.id,
          materialId: data.materialId,
          displayName: data.displayName,
          questions: {
            create: data.questions.map((question) => ({
              questionType: question.questionType,
              id: question.id,
              position: question.position,
              prompt: question.prompt,
              explanation: question.explanation,
              options: {
                create: question.options.map((option) => ({
                  id: option.id,
                  position: option.position,
                  optionText: option.optionText,
                  isCorrect: option.isCorrect,
                })),
              },
            })),
          },
        },
        select: quizSelect(),
      });

      return toQuizSummary(row);
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict: 'The quiz structure conflicts with an existing record',
        validation: 'The quiz structure is invalid',
      });
    }
  }

  async rename(quizId: string, displayName: string): Promise<QuizSummary> {
    try {
      const row = await this.prisma.quiz.update({
        where: { id: quizId },
        data: { displayName },
        select: quizSelect(),
      });

      return toQuizSummary(row);
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Quiz not found',
        validation: 'The quiz name is invalid',
      });
    }
  }

  /** Publish validated model output and terminal job state in one short transaction. */
  async publishGenerated(
    jobId: string,
    data: CreateQuizData,
  ): Promise<QuizSummary> {
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.processingJob.updateMany({
        where: {
          id: jobId,
          materialId: data.materialId,
          jobType: 'GENERATE_QUIZ',
          status: 'RUNNING',
        },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
      if (updated.count !== 1)
        throw new ConflictError('Generation job is not running');
      const row = await transaction.quiz.create({
        data: {
          id: data.id,
          materialId: data.materialId,
          displayName: data.displayName,
          questions: {
            create: data.questions.map(({ options, ...question }) => ({
              ...question,
              options: { create: options },
            })),
          },
        },
        select: quizSelect(),
      });
      return toQuizSummary(row);
    });
  }

  async delete(quizId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        // Drafts reference attempts with Restrict, so remove them first.
        await transaction.quizDraft.deleteMany({ where: { quizId } });
        // Attempt answers reference quiz questions with Restrict, so remove
        // attempts before the questions cascade away with the quiz.
        await transaction.quizAttempt.deleteMany({ where: { quizId } });
        await transaction.quiz.delete({
          where: { id: quizId },
          select: { id: true },
        });
      });
    } catch (error) {
      return rethrowPrismaError(error, {
        notFound: 'Quiz not found',
        conflict:
          'The quiz could not be deleted because it is still referenced',
      });
    }
  }
}

function toQuizSummary(row: {
  id: string;
  materialId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { questions: number; attempts?: number };
  attempts?: Array<{ id: string; scorePercent: unknown }>;
  drafts?: Array<{ id: string; answersJson: unknown; updatedAt: Date }>;
}): QuizSummary {
  return {
    id: row.id,
    materialId: row.materialId,
    displayName: row.displayName,
    questionCount: row._count.questions,
    attemptCount: row._count.attempts ?? 0,
    latestAttemptId: row.attempts?.[0]?.id ?? null,
    latestScorePercent: row.attempts?.[0]
      ? Number(row.attempts[0].scorePercent)
      : null,
    activeDraft: row.drafts?.[0]
      ? {
          id: row.drafts[0].id,
          answeredCount: (
            row.drafts[0].answersJson as Array<{ selectedOptionIds: string[] }>
          ).filter((a) => a.selectedOptionIds.length > 0).length,
          totalQuestions: row._count.questions,
          updatedAt: row.drafts[0].updatedAt,
        }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
