import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { logEvent } from '../../common/logging/log-event.js';
import { normalizePageQuery, type Page } from '../../common/pagination.js';
import { QuizzesRepository } from '../quizzes/quizzes.repository.js';
import type { QuestionType } from '../quizzes/quizzes.types.js';
import {
  AttemptsRepository,
  type StoredAttempt,
} from './attempts.repository.js';
import type {
  AttemptAnswerResult,
  AttemptListQuery,
  AttemptResult,
  AttemptSummary,
  SubmitAttemptInput,
} from './attempts.types.js';

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);
  constructor(
    private readonly attemptsRepository: AttemptsRepository,
    private readonly quizzesRepository: QuizzesRepository,
  ) {}

  async submit(
    userId: string,
    quizId: string,
    input: SubmitAttemptInput,
  ): Promise<AttemptResult> {
    const quiz = await this.quizzesRepository.findOwnedForGrading(
      userId,
      quizId,
    );
    if (!quiz) throw new NotFoundError('Quiz not found');
    if (!quiz.questions.length)
      throw new ConflictError('The quiz has no questions to answer');
    for (const question of quiz.questions) {
      const correct = question.options.filter((option) => option.isCorrect);
      if (
        !correct.length ||
        (question.questionType !== 'MULTI_SELECT' && correct.length !== 1)
      ) {
        throw new ConflictError(
          `Question ${question.position} has invalid correct options configured`,
        );
      }
    }
    const answers = Array.isArray(input.answers) ? input.answers : [];
    const questionIds = new Set(quiz.questions.map((question) => question.id));
    const byQuestion = new Map<string, string[]>();
    for (const answer of answers) {
      if (
        !answer ||
        typeof answer.questionId !== 'string' ||
        (answer.selectedOptionId !== undefined &&
          answer.selectedOptionIds !== undefined)
      ) {
        throw new ValidationError(
          'Each answer requires questionId and one selection field',
        );
      }
      const ids =
        answer.selectedOptionIds ??
        (typeof answer.selectedOptionId === 'string'
          ? [answer.selectedOptionId]
          : []);
      if (
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 10 ||
        ids.some((id) => typeof id !== 'string') ||
        new Set(ids).size !== ids.length
      ) {
        throw new ValidationError(
          'Select between 1 and 10 distinct options per question',
        );
      }
      if (!questionIds.has(answer.questionId))
        throw new ValidationError(
          'An answer question does not belong to this quiz',
        );
      if (byQuestion.has(answer.questionId))
        throw new ValidationError(
          'A question cannot be answered more than once',
        );
      byQuestion.set(answer.questionId, ids);
    }
    if (byQuestion.size !== quiz.questions.length)
      throw new ValidationError('Every question must be answered exactly once');
    const feedback = quiz.questions.map((question) => {
      const ids = byQuestion.get(question.id)!;
      const questionType = question.questionType ?? 'SINGLE_CHOICE';
      if (questionType !== 'MULTI_SELECT' && ids.length !== 1) {
        throw new ValidationError(
          `Question ${question.position} accepts exactly one selected option`,
        );
      }
      if (
        ids.some((id) => !question.options.some((option) => option.id === id))
      ) {
        throw new ValidationError(
          `The selected option does not belong to question ${question.position}`,
        );
      }
      const selected = question.options.filter((option) =>
        ids.includes(option.id),
      );
      const correct = question.options.filter((option) => option.isCorrect);
      // Exact set equality, without partial credit. Order of selected IDs is irrelevant.
      return answerResult({
        questionId: question.id,
        questionType,
        questionPosition: question.position,
        prompt: question.prompt,
        explanation: question.explanation,
        selected,
        correct,
        isCorrect:
          selected.length === correct.length &&
          selected.every((option) => option.isCorrect),
      });
    });
    const attempt = await this.attemptsRepository.create({
      userId,
      quizId,
      totalQuestions: quiz.questions.length,
      correctAnswers: feedback.filter((answer) => answer.isCorrect).length,
      answers: feedback.map((answer) => ({
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionIds[0],
        selectedOptionIds: answer.selectedOptionIds,
        isCorrect: answer.isCorrect,
      })),
    });
    logEvent(this.logger, 'log', 'quiz_attempt_submitted', {
      attemptId: attempt.id,
      quizId,
      userId,
      scorePercent: attempt.scorePercent,
    });
    return {
      ...attempt,
      quizDisplayName: quiz.displayName,
      materialId: quiz.materialId,
      workspaceId: quiz.workspaceId,
      answers: feedback,
    };
  }

  async listMine(
    userId: string,
    query: AttemptListQuery = {},
  ): Promise<Page<AttemptSummary>> {
    return this.attemptsRepository.findManyByUser(
      userId,
      normalizePageQuery(query),
    );
  }

  async listForQuiz(
    userId: string,
    quizId: string,
    query: AttemptListQuery = {},
  ): Promise<Page<AttemptSummary>> {
    if (!(await this.quizzesRepository.findOwnedById(userId, quizId)))
      throw new NotFoundError('Quiz not found');
    return this.attemptsRepository.findManyByUser(
      userId,
      normalizePageQuery(query),
      quizId,
    );
  }

  async getResult(userId: string, attemptId: string): Promise<AttemptResult> {
    const attempt = await this.attemptsRepository.findByIdForUser(
      userId,
      attemptId,
    );
    if (!attempt) throw new NotFoundError('Quiz attempt not found');
    return this.toAttemptResult(attempt);
  }

  private toAttemptResult(attempt: StoredAttempt): AttemptResult {
    const { answers, ...summary } = attempt;
    return {
      ...summary,
      answers: [...answers]
        .sort((a, b) => a.question.position - b.question.position)
        .map((answer) => {
          const correct = answer.question.options.filter(
            (option) => option.isCorrect,
          );
          if (!correct.length)
            throw new ConflictError(
              'Question has no correct options configured',
            );
          const selected = answer.selections?.length
            ? answer.selections.map((selection) => ({
                id: selection.selectedOptionId,
                optionText: selection.option.optionText,
              }))
            : [
                {
                  id: answer.selectedOptionId,
                  optionText: answer.option.optionText,
                },
              ];
          return answerResult({
            questionId: answer.questionId,
            questionType: answer.question.questionType ?? 'SINGLE_CHOICE',
            questionPosition: answer.question.position,
            prompt: answer.question.prompt,
            explanation: answer.question.explanation,
            selected,
            correct,
            isCorrect: answer.isCorrect,
          });
        }),
    };
  }
}

function answerResult(input: {
  questionId: string;
  questionType: QuestionType;
  questionPosition: number;
  prompt: string;
  explanation: string | null;
  isCorrect: boolean;
  selected: Array<{ id: string; optionText: string }>;
  correct: Array<{ id: string; optionText: string }>;
}): AttemptAnswerResult {
  const { selected, correct, ...question } = input;
  const single = input.questionType !== 'MULTI_SELECT';
  return {
    ...question,
    selectedOptionIds: selected.map((option) => option.id),
    selectedOptionTexts: selected.map((option) => option.optionText),
    correctOptionIds: correct.map((option) => option.id),
    correctOptionTexts: correct.map((option) => option.optionText),
    selectedOptionId: single ? selected[0].id : null,
    selectedOptionText: single ? selected[0].optionText : null,
    correctOptionId: single ? correct[0].id : null,
    correctOptionText: single ? correct[0].optionText : null,
  };
}
