import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { QuizzesRepository } from '../quizzes/quizzes.repository.js';
import { AttemptsService } from './attempts.service.js';
import type { Prisma, QuizDraft } from '../../generated/prisma/client.js';
export interface DraftAnswer {
  questionId: string;
  selectedOptionIds: string[];
}
export interface DraftSnapshot {
  revision: number;
  answers: DraftAnswer[];
  currentQuestionId: string | null;
}
export function draftResponse(row: QuizDraft) {
  const { answersJson, ...rest } = row;
  return { ...rest, answers: answersJson as unknown as DraftAnswer[] };
}
@Injectable()
export class QuizDraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quizzes: QuizzesRepository,
    private readonly attempts: AttemptsService,
  ) {}
  async getOrCreate(userId: string, quizId: string) {
    if (!(await this.quizzes.findOwnedForTaking(userId, quizId)))
      throw new NotFoundError('Quiz not found');
    // Submission can close the active row between insert and read. Retry against
    // the partial index instead of exposing a missing-row database error.
    for (let retry = 0; retry < 3; retry++) {
      await this.prisma
        .$executeRaw`INSERT INTO quiz_drafts(user_id, quiz_id) VALUES (${userId}::uuid, ${quizId}::uuid) ON CONFLICT (user_id, quiz_id) WHERE submitted_attempt_id IS NULL DO NOTHING`;
      const row = await this.prisma.quizDraft.findFirst({
        where: { userId, quizId, submittedAttemptId: null },
      });
      if (row) return draftResponse(row);
    }
    throw new ConflictError(
      'The active draft changed; retry starting the quiz',
    );
  }
  async get(userId: string, id: string) {
    return draftResponse(await this.owned(userId, id, this.prisma));
  }
  private async owned(
    userId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    const row = await tx.quizDraft.findFirst({
      where: {
        id,
        userId,
        quiz: { material: { workspace: { ownerUserId: userId } } },
      },
    });
    if (!row) throw new NotFoundError('Quiz draft not found');
    return row;
  }
  async save(userId: string, id: string, input: DraftSnapshot) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quiz_drafts WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
      const row = await this.owned(userId, id, tx);
      if (row.submittedAttemptId)
        throw new ConflictError('This draft has already been submitted');
      if (row.revision !== input.revision)
        throw new ConflictError(
          'Draft revision conflict; reload the latest draft',
        );
      const quiz = await this.quizzes.findOwnedForTaking(userId, row.quizId);
      if (!quiz) throw new NotFoundError('Quiz not found');
      validateDraftSnapshot(input, quiz.questions);
      return draftResponse(
        await tx.quizDraft.update({
          where: { id },
          data: {
            answersJson: input.answers as unknown as Prisma.InputJsonValue,
            currentQuestionId: input.currentQuestionId,
            revision: { increment: 1 },
          },
        }),
      );
    });
  }
  async submit(userId: string, id: string, revision: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quiz_drafts WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;
      const row = await this.owned(userId, id, tx);
      if (row.submittedAttemptId) return { attemptId: row.submittedAttemptId };
      if (row.revision !== revision)
        throw new ConflictError(
          'Draft revision conflict; reload the latest draft',
        );
      const attempt = await this.attempts.submit(
        userId,
        row.quizId,
        { answers: row.answersJson as unknown as DraftAnswer[] },
        tx,
      );
      await tx.quizDraft.update({
        where: { id },
        data: { submittedAttemptId: attempt.id, revision: { increment: 1 } },
      });
      return { attempt };
    });
    return result.attempt ?? this.attempts.getResult(userId, result.attemptId!);
  }
}
export function validateDraftSnapshot(
  input: DraftSnapshot,
  questions: Array<{
    id: string;
    questionType?: string;
    options: Array<{ id: string }>;
  }>,
) {
  if (
    !Number.isInteger(input.revision) ||
    input.revision < 0 ||
    !Array.isArray(input.answers) ||
    input.answers.length > 100
  )
    throw new ValidationError('Invalid draft snapshot');
  if (
    input.currentQuestionId !== null &&
    !questions.some((q) => q.id === input.currentQuestionId)
  )
    throw new ValidationError('Current question does not belong to this quiz');
  const seen = new Set<string>();
  for (const answer of input.answers) {
    const q = questions.find((q) => q.id === answer.questionId);
    if (!q || seen.has(answer.questionId))
      throw new ValidationError(
        'Each draft question must belong to this quiz and appear once',
      );
    seen.add(answer.questionId);
    const ids = answer.selectedOptionIds;
    if (
      !Array.isArray(ids) ||
      ids.length > 10 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !q.options.some((o) => o.id === id)) ||
      (q.questionType !== 'MULTI_SELECT' && ids.length > 1)
    )
      throw new ValidationError('Invalid draft option selection');
  }
}
