import type { PageQuery } from '../../common/pagination.js';
import type { QuestionType } from '../quizzes/quizzes.types.js';

export type AttemptListQuery = PageQuery;

export interface SubmitQuizAnswerInput {
  questionId: string;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
}

export interface SubmitAttemptInput {
  answers: SubmitQuizAnswerInput[];
}

export interface AttemptAnswerResult {
  questionType: QuestionType;
  questionId: string;
  questionPosition: number;
  prompt: string;
  selectedOptionIds: string[];
  selectedOptionTexts: string[];
  correctOptionIds: string[];
  correctOptionTexts: string[];
  /** Compatibility aliases, null for multi-select questions. */
  selectedOptionId: string | null;
  selectedOptionText: string | null;
  correctOptionId: string | null;
  correctOptionText: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

export interface AttemptResult {
  id: string;
  quizId: string;
  quizDisplayName: string;
  materialId: string;
  workspaceId: string;
  submittedAt: Date;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
  answers: AttemptAnswerResult[];
}

export interface AttemptSummary {
  id: string;
  quizId: string;
  quizDisplayName: string;
  materialId: string;
  workspaceId: string;
  submittedAt: Date;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
}
