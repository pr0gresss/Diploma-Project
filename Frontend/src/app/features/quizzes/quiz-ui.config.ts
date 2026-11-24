import type { QuizMode } from '../../shared/models';

/** Static UI copy for the quiz experience. No quiz content lives here. */
export const MODE_LABELS: Record<QuizMode, string> = {
  single: 'Single choice',
  dropdown: 'Select · Dropdown',
  multi: 'Multiple choice',
};

export const MODE_HELP: Record<QuizMode, string> = {
  single: 'Choose one answer.',
  dropdown: 'Choose one option from the dropdown.',
  multi: 'Select all that apply.',
};

export const MODE_ROUTES: Array<{ mode: QuizMode; label: string; path: string }> = [
  { mode: 'single', label: 'Single', path: '/quizzes' },
  { mode: 'dropdown', label: 'Dropdown', path: '/quizzes' },
  { mode: 'multi', label: 'Multiple', path: '/quizzes' },
];
