export type FileKind = 'PDF' | 'DOC' | 'PPT' | 'TXT';

export interface WorkspaceFile {
  id: string;
  name: string;
  kind: FileKind;
  detail: string;
  size: string;
  added: string;
  selected: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  marker: string;
}

export interface StudyNoteSection {
  id: string;
  number: string;
  title: string;
  paragraphs: string[];
  keyIdea?: { label: string; text: string };
  terms?: Array<{ term: string; description: string }>;
  checklist?: Array<{ text: string; checked: boolean }>;
}

export interface StudyNote {
  id: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  updated: string;
  sourceFiles: Array<{ name: string; pages: string }>;
  sections: StudyNoteSection[];
  wordCount: number;
}

export type QuizMode = 'single' | 'dropdown' | 'multi';

export interface QuizQuestion {
  id: string;
  prompt: string;
  helper?: string;
  options: string[];
  answer: number | number[];
  explanation: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  subject: string;
  meta: string;
  questions: number;
  status: 'In progress' | 'Not started' | 'Completed';
  score?: string;
  latestAttemptId?: string | null;
  answeredCount?: number;
  mode: QuizMode;
}
