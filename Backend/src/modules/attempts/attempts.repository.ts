import type { Prisma } from '../../generated/prisma/client.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { rethrowPrismaError } from '../../common/prisma/prisma-error.mapper.js';
import {
  pageOf,
  type NormalizedPageQuery,
  type Page,
} from '../../common/pagination.js';
import type { AttemptSummary } from './attempts.types.js';
import type { QuestionType } from '../quizzes/quizzes.types.js';

const attemptSummarySelect = {
  id: true,
  quizId: true,
  submittedAt: true,
  totalQuestions: true,
  correctAnswers: true,
  scorePercent: true,
  quiz: {
    select: {
      displayName: true,
      materialId: true,
      material: { select: { workspaceId: true } },
    },
  },
} as const;

export interface CreatedAttempt {
  id: string;
  quizId: string;
  submittedAt: Date;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
}

export interface StoredAttempt extends AttemptSummary {
  quizQuestions: Array<{
    id: string;
    questionType?: QuestionType;
    position: number;
    prompt: string;
    explanation: string | null;
    options: Array<{
      id: string;
      optionText: string;
      isCorrect: boolean;
    }>;
  }>;
  answers: Array<{
    questionId: string;
    selectedOptionId: string | null;
    isCorrect: boolean;
    question: {
      questionType?: QuestionType;
      position: number;
      prompt: string;
      explanation: string | null;
      options: Array<{
        id: string;
        optionText: string;
        isCorrect: boolean;
      }>;
    };
    option: {
      optionText: string;
    } | null;
    selections?: Array<{
      selectedOptionId: string;
      option: { optionText: string };
    }>;
  }>;
}

export interface CreateAttemptData {
  quizId: string;
  userId: string;
  totalQuestions: number;
  correctAnswers: number;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
  }>;
}

@Injectable()
export class AttemptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts the attempt and all per-question answers atomically. The score is
   * computed by PostgreSQL from the server-derived counters.
   */
  async create(
    data: CreateAttemptData,
    tx?: Prisma.TransactionClient,
  ): Promise<CreatedAttempt> {
    try {
      const write = async (transaction: Prisma.TransactionClient) => {
        const attempt = await transaction.quizAttempt.create({
          data: {
            quizId: data.quizId,
            userId: data.userId,
            totalQuestions: data.totalQuestions,
            correctAnswers: data.correctAnswers,
          },
          select: {
            id: true,
            quizId: true,
            submittedAt: true,
            totalQuestions: true,
            correctAnswers: true,
            scorePercent: true,
          },
        });

        const answered = data.answers.filter(
          (answer) => answer.selectedOptionIds.length > 0,
        );

        if (answered.length > 0) {
          await transaction.quizAttemptAnswer.createMany({
            data: answered.map((answer) => ({
              attemptId: attempt.id,
              quizId: data.quizId,
              questionId: answer.questionId,
              selectedOptionId: answer.selectedOptionId,
              isCorrect: answer.isCorrect,
            })),
          });

          await transaction.quizAttemptAnswerSelection.createMany({
            data: answered.flatMap((answer) =>
              answer.selectedOptionIds.map((selectedOptionId) => ({
                attemptId: attempt.id,
                questionId: answer.questionId,
                selectedOptionId,
              })),
            ),
          });
        }

        return {
          id: attempt.id,
          quizId: attempt.quizId,
          submittedAt: attempt.submittedAt,
          totalQuestions: attempt.totalQuestions,
          correctAnswers: attempt.correctAnswers,
          scorePercent: Number(attempt.scorePercent),
        };
      };
      return await (tx ? write(tx) : this.prisma.$transaction(write));
    } catch (error) {
      return rethrowPrismaError(error, {
        conflict:
          'The attempt conflicts with an existing record or an answer does not belong to the quiz',
        validation: 'The attempt is invalid',
      });
    }
  }

  async findManyByUser(
    userId: string,
    query: NormalizedPageQuery,
    quizId?: string,
  ): Promise<Page<AttemptSummary>> {
    const where = {
      userId,
      ...(quizId ? { quizId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
        select: attemptSummarySelect,
      }),
      this.prisma.quizAttempt.count({ where }),
    ]);

    return pageOf(rows.map(toAttemptSummary), total, query);
  }

  async findByIdForUser(
    userId: string,
    attemptId: string,
  ): Promise<StoredAttempt | null> {
    const row = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      select: {
        ...attemptSummarySelect,
        quiz: {
          select: {
            displayName: true,
            materialId: true,
            material: { select: { workspaceId: true } },
            questions: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                questionType: true,
                position: true,
                prompt: true,
                explanation: true,
                options: {
                  orderBy: { position: 'asc' },
                  select: {
                    id: true,
                    optionText: true,
                    isCorrect: true,
                  },
                },
              },
            },
          },
        },
        answers: {
          select: {
            questionId: true,
            selectedOptionId: true,
            isCorrect: true,
            question: {
              select: {
                questionType: true,
                position: true,
                prompt: true,
                explanation: true,
                options: {
                  select: {
                    id: true,
                    optionText: true,
                    isCorrect: true,
                  },
                },
              },
            },
            option: {
              select: { optionText: true },
            },
            selections: {
              orderBy: { option: { position: 'asc' } },
              select: {
                selectedOptionId: true,
                option: { select: { optionText: true } },
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
      ...toAttemptSummary(row),
      quizQuestions: row.quiz.questions,
      answers: row.answers,
    };
  }
}

function toAttemptSummary(row: {
  id: string;
  quizId: string;
  submittedAt: Date;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: unknown;
  quiz: {
    displayName: string;
    materialId: string;
    material: { workspaceId: string };
  };
}): AttemptSummary {
  return {
    id: row.id,
    quizId: row.quizId,
    quizDisplayName: row.quiz.displayName,
    materialId: row.quiz.materialId,
    workspaceId: row.quiz.material.workspaceId,
    submittedAt: row.submittedAt,
    totalQuestions: row.totalQuestions,
    correctAnswers: row.correctAnswers,
    scorePercent: Number(row.scorePercent),
  };
}
