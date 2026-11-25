import {
  FileKind,
  QuizMode,
  QuizSummary,
  StudyNote,
  StudyNoteSection,
  WorkspaceFile,
  WorkspaceSummary,
} from '../models';
import {
  Material,
  ProgressReport,
  QuestionType,
  Quiz,
  QuizProgress,
  StudyGuideContent,
  Workspace,
} from './api.models';
import { parseMarkdownBlocks, stripMarkdown, stripSectionNumber } from './markdown';

const WORKSPACE_MARKERS = [
  'var(--marker-green)',
  'var(--marker-gold)',
  'var(--marker-teal)',
  'var(--marker-sage)',
  'var(--marker-clay)',
  'var(--marker-blue)',
];

function hash(text: string): number {
  return Array.from(text).reduce((value, char) => value + char.charCodeAt(0), 0);
}

function markerFor(name: string): string {
  return WORKSPACE_MARKERS[hash(name) % WORKSPACE_MARKERS.length];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function kindFor(material: Material): FileKind {
  return material.originalFilename.toLowerCase().endsWith('.docx') ? 'DOC' : 'PDF';
}

function statusDetail(status: Material['processingStatus']): string {
  if (status === 'READY') return 'Ready to study';
  if (status === 'PROCESSING') return 'Processing';
  if (status === 'FAILED') return 'Processing failed';
  return 'Uploaded';
}

export function toWorkspaceSummary(workspace: Workspace): WorkspaceSummary {
  return {
    id: workspace.id,
    name: workspace.name,
    marker: markerFor(workspace.name),
  };
}

export function toWorkspaceFile(material: Material): WorkspaceFile {
  return {
    id: material.id,
    name: material.originalFilename,
    kind: kindFor(material),
    detail: statusDetail(material.processingStatus),
    size: formatSize(material.sizeBytes),
    added: formatDate(material.createdAt),
    selected: false,
  };
}

export function questionTypeToMode(type?: QuestionType): QuizMode {
  if (type === 'MULTI_SELECT') return 'multi';
  if (type === 'SELECT') return 'dropdown';
  return 'single';
}

export function modeToQuestionTypes(mode: QuizMode): QuestionType[] {
  if (mode === 'multi') return ['MULTI_SELECT'];
  if (mode === 'dropdown') return ['SELECT'];
  return ['SINGLE_CHOICE'];
}

export function findQuizProgress(
  report: ProgressReport | null,
  quizId: string,
): QuizProgress | undefined {
  return report?.items.find((item) => item.quizId === quizId);
}

export function toQuizSummary(
  quiz: Quiz,
  progress?: QuizProgress,
  mode: QuizMode = 'single',
  material?: Material,
): QuizSummary {
  const status: QuizSummary['status'] = quiz.activeDraft
    ? 'In progress'
    : (quiz.attemptCount ?? progress?.completedAttempts ?? 0) > 0
      ? 'Completed'
      : 'Not started';
  const attempts = quiz.attemptCount ?? progress?.completedAttempts ?? 0;
  const latestScore = quiz.latestScorePercent ?? progress?.latestScorePercent;
  const meta = quiz.activeDraft
    ? quiz.activeDraft.answeredCount + ' of ' + quiz.activeDraft.totalQuestions + ' answered'
    : attempts > 0
      ? (latestScore ?? 0) +
        '% latest score ? ' +
        attempts +
        (attempts === 1 ? ' attempt' : ' attempts')
      : progress
        ? `${progress.latestScorePercent}% latest score  ·  ${progress.completedAttempts} ${progress.completedAttempts === 1 ? 'attempt' : 'attempts'}`
        : `${quiz.questionCount} questions  ·  Mixed types`;

  return {
    id: quiz.id,
    title: quiz.displayName,
    subject: progress?.materialDisplayName ?? material?.displayName ?? 'Your materials',
    meta,
    questions: quiz.questionCount,
    status,
    latestAttemptId: quiz.latestAttemptId,
    answeredCount: quiz.activeDraft?.answeredCount,
    score: progress ? `${progress.latestScorePercent}%` : undefined,
    mode,
  };
}

export function studyGuideToNote(
  guide: StudyGuideContent,
  sourceFiles: StudyNote['sourceFiles'] = [],
): StudyNote {
  const sections: StudyNoteSection[] = [];
  let current: StudyNoteSection = {
    id: 'section-1',
    number: '01',
    title: 'Study guide',
    paragraphs: [],
  };
  let titleRead = false;
  const blocks = parseMarkdownBlocks(guide.content ?? '');

  const hasContent = (section: StudyNoteSection): boolean =>
    section.paragraphs.length > 0 ||
    !!section.keyIdea ||
    !!section.terms?.length ||
    !!section.checklist?.length;

  const startSection = (title: string): void => {
    if (hasContent(current)) sections.push(current);
    const number = `${sections.length + 1}.`;
    current = {
      id: `section-${number}`,
      number,
      title,
      paragraphs: [],
    };
  };

  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        if (block.level === 1 && !titleRead) {
          current.title = block.text;
          titleRead = true;
          break;
        }
        if (block.level >= 3) {
          current.paragraphs.push(`${'#'.repeat(block.level)} ${block.text}`);
          break;
        }
        startSection(stripSectionNumber(block.text));
        break;
      case 'paragraph':
        current.paragraphs.push(block.text);
        break;
      case 'quote':
        current.keyIdea = { label: 'MAKE IT STICK', text: block.text };
        break;
      case 'terms':
        current.terms = [...(current.terms ?? []), ...block.items];
        break;
      case 'checklist':
        current.checklist = [...(current.checklist ?? []), ...block.items];
        break;
      case 'list':
        current.paragraphs.push(
          block.items
            .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
            .join('\n'),
        );
        break;
    }
  }

  if (hasContent(current) || !sections.length) sections.push(current);

  const plainText = (guide.content ?? '')
    .split(/\r?\n/)
    .map(stripMarkdown)
    .filter(Boolean)
    .join(' ');
  return {
    id: guide.id,
    title: guide.displayName,
    eyebrow: '',
    subtitle: '',
    updated: guide.updatedAt ? formatDate(guide.updatedAt) : 'Updated just now',
    sourceFiles,
    sections,
    wordCount: plainText ? plainText.split(/\s+/).length : 0,
  };
}

export function noteToMarkdown(note: StudyNote, bodyText?: string): string {
  const blocks: string[] = [`# ${note.title}`];

  if (bodyText?.trim()) {
    blocks.push(bodyText.trim());
  } else {
    for (const section of note.sections) {
      blocks.push(`## ${section.title}`);
      blocks.push(...section.paragraphs.filter(Boolean));
      if (section.keyIdea) blocks.push(`> ${section.keyIdea.text}`);
      if (section.terms?.length) {
        blocks.push(
          section.terms.map((term) => `- **${term.term}**: ${term.description}`).join('\n'),
        );
      }
      if (section.checklist?.length) {
        blocks.push(
          section.checklist
            .map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
            .join('\n'),
        );
      }
    }
  }

  return blocks.join('\n\n').trim();
}
