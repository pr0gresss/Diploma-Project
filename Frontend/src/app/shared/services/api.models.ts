export type Uuid = string;
export type IsoDateTime = string;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PageParams {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AttemptPageParams {
  limit?: number;
  offset?: number;
}

export interface HttpError {
  statusCode: number;
  message: string;
  errorCode?: string;
  error?: string;
  details?: Record<string, unknown>;
}

/* ---------- Auth / users ---------- */

export interface AuthUser {
  id: Uuid;
  email: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type User = AuthUser;

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

/* ---------- Workspaces ---------- */

export interface Workspace {
  id: Uuid;
  name: string;
  materialCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type WorkspacePage = Page<Workspace>;

/* ---------- Materials / jobs ---------- */

export type MaterialProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
export type ProcessingJobType = 'EXTRACT_TEXT' | 'GENERATE_GUIDE' | 'GENERATE_QUIZ';
export type ProcessingJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface MaterialPageParams extends PageParams {
  status?: MaterialProcessingStatus;
}

export interface ProcessingJobSummary {
  id: Uuid;
  materialId: Uuid;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  errorMessage: string | null;
  createdAt: IsoDateTime;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
}

export interface Material {
  id: Uuid;
  displayName: string;
  workspaceId: Uuid;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  processingStatus: MaterialProcessingStatus;
  jobCount: number;
  guideCount: number;
  quizCount: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface MaterialDetails extends Material {
  processingJobs: ProcessingJobSummary[];
}

export type MaterialPage = Page<Material>;

/* ---------- Study guides ---------- */

export interface StudyGuide {
  id: Uuid;
  materialId: Uuid;
  displayName: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StudyGuideContent extends StudyGuide {
  content: string;
}

export type StudyGuidePage = Page<StudyGuide>;

export interface CreateStudyGuideRequest {
  displayName?: string;
  content: string;
}

export interface UpdateStudyGuideContentRequest {
  content: string;
}

/* ---------- Quizzes ---------- */

export type QuestionType = 'SINGLE_CHOICE' | 'SELECT' | 'MULTI_SELECT';

export interface Quiz {
  id: Uuid;
  materialId: Uuid;
  displayName: string;
  questionCount: number;
  activeDraft?: { id: string; answeredCount: number; totalQuestions: number; updatedAt: string } | null;
  attemptCount?: number;
  latestAttemptId?: string | null;
  latestScorePercent?: number | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type QuizPage = Page<Quiz>;

export interface QuizForTaking {
  id: Uuid;
  materialId: Uuid;
  displayName: string;
  materialDisplayName: string;
  workspaceId: Uuid;
  questions: Array<{
    questionType: QuestionType;
    id: Uuid;
    position: number;
    prompt: string;
    options: Array<{
      id: Uuid;
      position: number;
      text: string;
    }>;
  }>;
}

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

export interface CreateQuizRequest {
  displayName?: string;
  questions: QuizQuestionInput[];
}

export interface GenerateQuizRequest {
  displayName?: string;
  questionCount?: number;
  questionTypes?: QuestionType[];
}

/* ---------- Attempts / progress ---------- */

export interface AttemptAnswerInput {
  questionId: Uuid;
  selectedOptionIds?: Uuid[];
  selectedOptionId?: Uuid;
}

export interface SubmitAttemptRequest {
  answers: AttemptAnswerInput[];
}

export interface AttemptAnswerResult {
  questionId: Uuid;
  questionType: QuestionType;
  questionPosition: number;
  prompt: string;
  selectedOptionIds: Uuid[];
  selectedOptionTexts: string[];
  correctOptionIds: Uuid[];
  correctOptionTexts: string[];
  selectedOptionId: Uuid | null;
  selectedOptionText: string | null;
  correctOptionId: Uuid | null;
  correctOptionText: string | null;
  isCorrect: boolean;
  explanation: string | null;
}

export interface AttemptSummary {
  id: Uuid;
  quizId: Uuid;
  quizDisplayName: string;
  materialId: Uuid;
  workspaceId: Uuid;
  submittedAt: IsoDateTime;
  totalQuestions: number;
  correctAnswers: number;
  scorePercent: number;
}

export interface AttemptResult extends AttemptSummary {
  answers: AttemptAnswerResult[];
}

export type AttemptPage = Page<AttemptSummary>;

export interface QuizProgress {
  quizId: Uuid;
  quizDisplayName: string;
  materialId: Uuid;
  materialDisplayName: string;
  workspaceId: Uuid;
  workspaceName: string;
  completedAttempts: number;
  averageScorePercent: number;
  bestScorePercent: number;
  latestScorePercent: number;
  lastCompletedAt: IsoDateTime;
}

export interface ProgressOverview {
  totalAttempts: number;
  completedQuizzes: number;
  workspacesStudied: number;
  averageScorePercent: number;
  bestScorePercent: number;
  lastCompletedAt: IsoDateTime | null;
}

export interface ProgressReport extends Page<QuizProgress> {
  overview: ProgressOverview;
}

export interface DraftAnswer { questionId: string; selectedOptionIds: string[]; }
export interface QuizDraft {
  id: string; quizId: string; answers: DraftAnswer[]; currentQuestionId: string | null;
  revision: number; createdAt: string; updatedAt: string; submittedAttemptId: string | null;
}
export interface SaveQuizDraft { revision: number; answers: DraftAnswer[]; currentQuestionId: string | null; }
