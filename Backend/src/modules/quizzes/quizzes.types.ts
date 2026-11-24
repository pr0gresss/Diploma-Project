import type { PageQuery } from '../../common/pagination.js';

export type QuizListQuery = PageQuery;
export type QuestionType = 'SINGLE_CHOICE' | 'SELECT' | 'MULTI_SELECT';

export interface QuizOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  questionType?: QuestionType;
  prompt: string;
  explanation?: string | null;
  options: QuizOptionInput[];
}

export interface CreateQuizInput {
  displayName?: string;
  questions: QuizQuestionInput[];
}

export interface RenameQuizInput {
  displayName: string;
}

export interface QuizSummary {
  id: string;
  materialId: string;
  displayName: string;
  questionCount: number;
  attemptCount: number;
  latestAttemptId: string | null;
  latestScorePercent: number | null;
  activeDraft: {
    id: string;
    answeredCount: number;
    totalQuestions: number;
    updatedAt: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizForTaking {
  id: string;
  materialId: string;
  displayName: string;
  materialDisplayName: string;
  workspaceId: string;
  questions: Array<{
    questionType: QuestionType;
    id: string;
    position: number;
    prompt: string;
    options: Array<{
      id: string;
      position: number;
      text: string;
    }>;
  }>;
}
