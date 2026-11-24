import { studyGuideToNote, noteToMarkdown } from './adapters';
import type { StudyGuideContent } from './api.models';
import {
  createMarkdownNodes,
  renderInlineMarkdown,
  renderParagraph,
  serializeNoteEditor,
  stripSectionNumber,
} from './markdown';

const guide = (content: string): StudyGuideContent => ({
  id: 'guide-1',
  materialId: 'material-1',
  displayName: 'Cell biology',
  content,
  updatedAt: '2026-11-24T10:00:00.000Z',
  createdAt: '2026-11-24T10:00:00.000Z',
});

function editorFrom(markdown: string, title: string): HTMLDivElement {
  const editor = document.createElement('div');
  const paper = document.createElement('div');
  paper.className = 'note-paper';
  paper.append(...createMarkdownNodes(document, markdown));
  editor.appendChild(paper);
  return editor;
}

describe('study guide Markdown parsing', () => {
  it('removes author numbering from section titles', () => {
    expect(stripSectionNumber('1. First header')).toBe('First header');
    expect(stripSectionNumber('2) Second header')).toBe('Second header');
    expect(stripSectionNumber('01 - Third header')).toBe('Third header');
    expect(stripSectionNumber('01  1. Already numbered')).toBe('Already numbered');

    const note = studyGuideToNote(
      guide('## 1. First header\n\nsome text\n\n## 2. Second header\n\nfkfkkfkfkf'),
    );

    expect(note.sections.map((section) => section.title)).toEqual([
      'First header',
      'Second header',
    ]);
    expect(note.sections[0]?.number).toBe('1.');
    expect(note.sections[1]?.number).toBe('2.');
  });

  it('parses headings, terms, checklists, quotes and nested headings', () => {
    const note = studyGuideToNote(
      guide(
        [
          '# Cell structure',
          '',
          'Cells work together.',
          '',
          '## Key parts',
          '',
          'Every part has a role.',
          '',
          '> Everything has a job.',
          '',
          '- **Nucleus**: Control centre.',
          '- [x] Read the diagram',
          '- [ ] Draw the labels',
          '',
          '### Detail',
          '',
          'The nucleus stores DNA.',
        ].join('\n'),
      ),
    );

    expect(note.sections.map((section) => section.title)).toEqual([
      'Cell structure',
      'Key parts',
    ]);
    expect(note.sections[0]?.paragraphs).toEqual(['Cells work together.']);
    expect(note.sections[1]?.paragraphs).toEqual([
      'Every part has a role.',
      '### Detail',
      'The nucleus stores DNA.',
    ]);
    expect(note.sections[1]?.keyIdea).toEqual({
      label: 'MAKE IT STICK',
      text: 'Everything has a job.',
    });
    expect(note.sections[1]?.terms).toEqual([
      { term: 'Nucleus', description: 'Control centre.' },
    ]);
    expect(note.sections[1]?.checklist).toEqual([
      { text: 'Read the diagram', checked: true },
      { text: 'Draw the labels', checked: false },
    ]);
  });

  it('round-trips a note through Markdown without losing checked items or formatting', () => {
    const original = studyGuideToNote(
      guide(
        [
          '# Cell biology',
          '',
          'A short **introduction**.',
          '',
          '## Parts',
          '',
          '- **Nucleus**: Stores DNA.',
          '- [x] Read chapter',
          '- [ ] Answer questions',
        ].join('\n'),
      ),
      [{ name: 'cells.pdf', pages: '8 pages' }],
    );

    const markdown = noteToMarkdown(original);
    const parsed = studyGuideToNote(guide(markdown), original.sourceFiles);

    expect(markdown).toContain('# Cell biology');
    expect(markdown).toContain('- [x] Read chapter');
    expect(markdown).toContain('A short **introduction**.');
    expect(parsed.sections[0]?.paragraphs).toContain('A short **introduction**.');
    expect(parsed.sections[1]?.checklist).toEqual([
      { text: 'Read chapter', checked: true },
      { text: 'Answer questions', checked: false },
    ]);
    expect(parsed.sections[1]?.terms).toEqual([
      { term: 'Nucleus', description: 'Stores DNA.' },
    ]);
  });
});

describe('editor Markdown rendering', () => {
  it('turns inline Markdown into HTML safely', () => {
    const html = renderInlineMarkdown('**Bold** and [a link](https://example.com) with <b>raw</b>');

    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<a href="https://example.com">a link</a>');
    expect(html).not.toContain('<b>raw</b>');
    expect(html).toContain('&lt;b&gt;raw&lt;/b&gt;');
  });

  it('renders nested headings and lists as block content', () => {
    const html = renderParagraph('### Detail\n- first\n- second');

    expect(html).toContain('<h3>Detail</h3>');
    expect(html).toContain('<li>first</li>');
    expect(html).toContain('<li>second</li>');
  });

  it('serializes pasted Markdown back to a stable document', () => {
    const body = [
      '## Section',
      '',
      'Paragraph **bold**.',
      '',
      '- **Nucleus**: Stores DNA.',
      '',
      '- [x] Done',
      '- [ ] To do',
      '',
      '### Detail',
      '',
      '- first',
      '- second',
    ].join('\n');

    const editor = editorFrom(body, 'My note');

    expect(serializeNoteEditor(editor, 'My note')).toBe(`# My note\n\n${body}`);
  });
});
