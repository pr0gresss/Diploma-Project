import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { logEvent } from '../../common/logging/log-event.js';
import { normalizePageQuery, type Page } from '../../common/pagination.js';
import { validateDisplayName } from '../../infrastructure/files/material-file.validator.js';
import { MaterialsRepository } from '../materials/materials.repository.js';
import {
  QuizzesRepository,
  type CreateQuizData,
} from './quizzes.repository.js';
import type {
  CreateQuizInput,
  QuizForTaking,
  QuizListQuery,
  QuizSummary,
  RenameQuizInput,
} from './quizzes.types.js';

const MAX_QUESTIONS = 100;
const MAX_OPTIONS_PER_QUESTION = 10;
const MAX_PROMPT_LENGTH = 4_000;
const MAX_EXPLANATION_LENGTH = 4_000;
const MAX_OPTION_LENGTH = 1_000;

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly quizzesRepository: QuizzesRepository,
    private readonly materialsRepository: MaterialsRepository,
  ) {}

  async list(
    ownerUserId: string,
    materialId: string,
    query: QuizListQuery = {},
  ): Promise<Page<QuizSummary>> {
    await this.findOwnedMaterialOrThrow(ownerUserId, materialId);

    return this.quizzesRepository.findManyByMaterial(
      ownerUserId,
      materialId,
      normalizePageQuery(query),
    );
  }

  async getForTaking(
    ownerUserId: string,
    quizId: string,
  ): Promise<QuizForTaking> {
    const quiz = await this.quizzesRepository.findOwnedForTaking(
      ownerUserId,
      quizId,
    );

    if (!quiz) {
      throw new NotFoundError('Quiz not found');
    }

    return quiz;
  }

  /**
   * Persists a fully formed quiz. Every question has at least two options and
   * exactly one correct answer before anything reaches the database.
   */
  async create(
    ownerUserId: string,
    materialId: string,
    input: CreateQuizInput,
  ): Promise<QuizSummary> {
    const material = await this.findOwnedMaterialOrThrow(
      ownerUserId,
      materialId,
    );

    if (material.processingStatus !== 'READY') {
      throw new ConflictError(
        'A quiz can only be created from a processed material',
      );
    }

    const displayName =
      input.displayName === undefined
        ? `${material.displayName} - quiz`.slice(0, 255)
        : validateDisplayName(input.displayName);
    const data = validateQuizStructure(
      input.questions,
      materialId,
      displayName,
    );
    const quiz = await this.quizzesRepository.create(data);

    logEvent(this.logger, 'log', 'quiz_created', {
      quizId: quiz.id,
      materialId,
      ownerUserId,
      questionCount: quiz.questionCount,
    });

    return quiz;
  }

  async rename(
    ownerUserId: string,
    quizId: string,
    input: RenameQuizInput,
  ): Promise<QuizSummary> {
    await this.findOwnedOrThrow(ownerUserId, quizId);
    const displayName = validateDisplayName(input.displayName);
    const quiz = await this.quizzesRepository.rename(quizId, displayName);

    logEvent(this.logger, 'log', 'quiz_renamed', {
      quizId,
      ownerUserId,
    });

    return quiz;
  }

  async delete(ownerUserId: string, quizId: string): Promise<void> {
    await this.findOwnedOrThrow(ownerUserId, quizId);
    await this.quizzesRepository.delete(quizId);

    logEvent(this.logger, 'log', 'quiz_deleted', {
      quizId,
      ownerUserId,
    });
  }

  private async findOwnedMaterialOrThrow(
    ownerUserId: string,
    materialId: string,
  ) {
    const material = await this.materialsRepository.findOwnedById(
      ownerUserId,
      materialId,
    );

    if (!material) {
      throw new NotFoundError('Material not found');
    }

    return material;
  }

  private async findOwnedOrThrow(
    ownerUserId: string,
    quizId: string,
  ): Promise<QuizSummary> {
    const quiz = await this.quizzesRepository.findOwnedById(
      ownerUserId,
      quizId,
    );

    if (!quiz) {
      throw new NotFoundError('Quiz not found');
    }

    return quiz;
  }
}

export function validateQuizStructure(
  questions: CreateQuizInput['questions'],
  materialId: string,
  displayName: string,
): CreateQuizData {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new ValidationError('A quiz must contain at least one question');
  }
  if (questions.length > MAX_QUESTIONS) {
    throw new ValidationError(
      `A quiz must not contain more than ${MAX_QUESTIONS} questions`,
    );
  }

  return {
    id: randomUUID(),
    materialId,
    displayName,
    questions: questions.map((question, questionIndex) => {
      const questionType = question?.questionType ?? 'SINGLE_CHOICE';
      if (!['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'].includes(questionType)) {
        throw new ValidationError(
          `Question ${questionIndex + 1} has an unsupported type`,
        );
      }
      const prompt =
        typeof question?.prompt === 'string' ? question.prompt.trim() : '';
      if (!prompt) {
        throw new ValidationError(
          `Question ${questionIndex + 1} must have a prompt`,
        );
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        throw new ValidationError(
          `Question ${questionIndex + 1} exceeds ${MAX_PROMPT_LENGTH} characters`,
        );
      }

      const explanation =
        typeof question.explanation === 'string' &&
        question.explanation.trim().length > 0
          ? question.explanation.trim()
          : null;
      if (explanation && explanation.length > MAX_EXPLANATION_LENGTH) {
        throw new ValidationError(
          `The explanation of question ${questionIndex + 1} is too long`,
        );
      }

      if (
        !Array.isArray(question.options) ||
        question.options.length < 2 ||
        question.options.length > MAX_OPTIONS_PER_QUESTION
      ) {
        throw new ValidationError(
          `Question ${questionIndex + 1} must have between 2 and ${MAX_OPTIONS_PER_QUESTION} options`,
        );
      }

      const options = question.options.map((option, optionIndex) => {
        const text = typeof option?.text === 'string' ? option.text.trim() : '';
        if (!text) {
          throw new ValidationError(
            `Option ${optionIndex + 1} of question ${questionIndex + 1} must not be blank`,
          );
        }
        if (text.length > MAX_OPTION_LENGTH) {
          throw new ValidationError(
            `Option ${optionIndex + 1} of question ${questionIndex + 1} is too long`,
          );
        }
        if (typeof option.isCorrect !== 'boolean') {
          throw new ValidationError(
            `Option ${optionIndex + 1} of question ${questionIndex + 1} must state whether it is correct`,
          );
        }

        return {
          id: randomUUID(),
          position: optionIndex + 1,
          optionText: text,
          isCorrect: option.isCorrect,
        };
      });

      const correctOptions = options.filter((option) => option.isCorrect);
      if (
        correctOptions.length === 0 ||
        (questionType !== 'MULTI_SELECT' && correctOptions.length !== 1)
      ) {
        throw new ValidationError(
          `Question ${questionIndex + 1} must have ${questionType === 'MULTI_SELECT' ? 'at least one' : 'exactly one'} correct option`,
        );
      }

      return {
        questionType,
        id: randomUUID(),
        position: questionIndex + 1,
        prompt,
        explanation,
        options,
      };
    }),
  };
}
