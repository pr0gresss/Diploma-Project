export interface MarkdownTerm {
  term: string;
  description: string;
}

export interface MarkdownChecklistItem {
  text: string;
  checked: boolean;
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'terms'; items: MarkdownTerm[] }
  | { type: 'checklist'; items: MarkdownChecklistItem[] }
  | { type: 'list'; ordered: boolean; items: string[] };

const HEADING = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const CHECKLIST = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const TERM = /^\s*[-*]\s+\*\*(.+?)\*\*\s*[:—-]\s*(.*)$/;
const BULLET = /^\s*[-*]\s+(?!\*\*)(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

const BLOCK_TAGS = new Set([
  'BLOCKQUOTE',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'PRE',
  'UL',
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(value: string): string {
  const href = value.trim().replace(/&amp;/g, '&');
  if (/^(https?:|mailto:)/i.test(href) || /^[#/]/.test(href)) return href;
  return '';
}

function normalize(value: string): string {
  return value.trim();
}

export function stripSectionNumber(value: string): string {
  return value.replace(/^(?:\s*\d+\s*(?:[.)]|[-–—:]|\s)\s*)+/, '').trim();
}

function escapeMarkdownText(value: string): string {
  return value.replace(/([\\*_`[\]~])/g, '\\$1');
}

function escapeMarkdownHref(value: string): string {
  return value.replace(/[\s()]/g, (character) => encodeURIComponent(character));
}

export function stripMarkdown(value: string): string {
  return value
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\\`*_~#>`]/g, ' ')
    .replace(/^\s*[-+*]\s+(\[[ xX]\]\s+)?/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .trim();
}

export function renderInlineMarkdown(value: string): string {
  const codeSpans: string[] = [];
  const escapes: string[] = [];

  let html = escapeHtml(value ?? '');

  html = html.replace(/`([^`]+)`/g, (_match, code: string) => {
    const index = codeSpans.push(`<code>${code}</code>`) - 1;
    return `\u0000${index}\u0000`;
  });

  html = html.replace(/\\([\\`*_{}[\]()#+\-.!>])/g, (_match, character: string) => {
    const index = escapes.push(escapeHtml(character)) - 1;
    return `\u0001${index}\u0001`;
  });

  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, href: string) => {
      const url = safeHref(href);
      return url ? `<a href="${escapeHtml(url)}">${label}</a>` : label;
    });

  html = html.replace(/\u0001(\d+)\u0001/g, (_match, index: string) => escapes[Number(index)] ?? '');
  html = html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codeSpans[Number(index)] ?? '');
  return html;
}

export function renderParagraph(value: string): string {
  const lines = (value ?? '').split(/\r?\n/);
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = (): void => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = normalize(rawLine);
    if (!line) {
      closeList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading && heading[1].length >= 3) {
      closeList();
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      if (list !== 'ul') {
        closeList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const orderedItem = ORDERED.exec(line);
    if (orderedItem) {
      if (list !== 'ol') {
        closeList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${renderInlineMarkdown(orderedItem[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join('');
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let terms: MarkdownTerm[] = [];
  let checklist: MarkdownChecklistItem[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushParagraph = (): void => {
    const text = paragraph.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraph = [];
  };

  const flushQuote = (): void => {
    const text = quote.join(' ').trim();
    if (text) blocks.push({ type: 'quote', text });
    quote = [];
  };

  const flushTerms = (): void => {
    if (terms.length) blocks.push({ type: 'terms', items: terms });
    terms = [];
  };

  const flushChecklist = (): void => {
    if (checklist.length) blocks.push({ type: 'checklist', items: checklist });
    checklist = [];
  };

  const flushList = (): void => {
    if (listItems.length) {
      blocks.push({ type: 'list', ordered: listOrdered, items: listItems });
    }
    listItems = [];
    listOrdered = false;
  };

  const flushAll = (): void => {
    flushParagraph();
    flushQuote();
    flushTerms();
    flushChecklist();
    flushList();
  };

  for (const rawLine of (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = normalize(rawLine);
    if (!line) {
      flushAll();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushAll();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: normalize(heading[2]),
      });
      continue;
    }

    const quoteLine = QUOTE.exec(line);
    if (quoteLine) {
      flushParagraph();
      flushTerms();
      flushChecklist();
      flushList();
      quote.push(normalize(quoteLine[1]));
      continue;
    }
    flushQuote();

    const check = CHECKLIST.exec(line);
    if (check) {
      flushParagraph();
      flushTerms();
      flushList();
      checklist.push({
        text: normalize(check[2]),
        checked: check[1].toLowerCase() === 'x',
      });
      continue;
    }

    const term = TERM.exec(line);
    if (term) {
      flushParagraph();
      flushChecklist();
      flushList();
      terms.push({
        term: normalize(term[1]),
        description: normalize(term[2]),
      });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      flushParagraph();
      flushTerms();
      flushChecklist();
      listItems.push(normalize(bullet[1]));
      continue;
    }

    const orderedItem = ORDERED.exec(line);
    if (orderedItem) {
      flushParagraph();
      flushTerms();
      flushChecklist();
      if (listItems.length && listOrdered) listItems.push(normalize(orderedItem[1]));
      else {
        flushList();
        listOrdered = true;
        listItems.push(normalize(orderedItem[1]));
      }
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

function createSectionNode(doc: Document, headingText: string): HTMLElement {
  const section = doc.createElement('section');
  section.className = 'note-section';
  section.tabIndex = -1;

  const heading = doc.createElement('h3');
  heading.className = 'section-heading';
  heading.innerHTML = renderInlineMarkdown(stripSectionNumber(headingText));
  section.appendChild(heading);
  return section;
}

export function createMarkdownNodes(doc: Document, markdown: string): HTMLElement[] {
  return parseMarkdownBlocks(markdown).flatMap((block) => {
    switch (block.type) {
      case 'heading': {
        if (block.level === 1) return [];
        if (block.level === 2) return [createSectionNode(doc, block.text)];

        const heading = doc.createElement(`h${Math.min(block.level, 6)}`);
        heading.innerHTML = renderInlineMarkdown(block.text);
        return [heading];
      }
      case 'quote': {
        const idea = doc.createElement('div');
        idea.className = 'key-idea';
        idea.setAttribute('contenteditable', 'false');
        idea.innerHTML =
          '<img src="/icons/spark-green.svg" width="18" height="18" alt="" aria-hidden="true" />' +
          `<div><span class="idea-label">MAKE IT STICK</span><p>${renderInlineMarkdown(block.text)}</p></div>`;
        return [idea];
      }
      case 'terms': {
        const terms = doc.createElement('dl');
        terms.className = 'terms';
        for (const item of block.items) {
          const row = doc.createElement('div');
          row.className = 'term-row';
          row.innerHTML =
            `<dt>${renderInlineMarkdown(item.term)}</dt>` +
            `<dd>${renderInlineMarkdown(item.description)}</dd>`;
          terms.appendChild(row);
        }
        return [terms];
      }
      case 'checklist': {
        const checklist = doc.createElement('ul');
        checklist.className = 'checklist';
        for (const item of block.items) {
          const row = doc.createElement('li');
          row.innerHTML =
            '<label contenteditable="false">' +
            `<input type="checkbox"${item.checked ? ' checked' : ''} />` +
            `<span>${renderInlineMarkdown(item.text)}</span>` +
            '</label>';
          checklist.appendChild(row);
        }
        return [checklist];
      }
      case 'list': {
        const list = doc.createElement(block.ordered ? 'ol' : 'ul');
        for (const item of block.items) {
          const row = doc.createElement('li');
          row.innerHTML = renderInlineMarkdown(item);
          list.appendChild(row);
        }
        return [list];
      }
      case 'paragraph': {
        const paragraph = doc.createElement('div');
        paragraph.className = 'body-copy';
        paragraph.innerHTML = renderParagraph(block.text);
        return [paragraph];
      }
    }
  });
}

function isBlockElement(element: HTMLElement): boolean {
  return BLOCK_TAGS.has(element.tagName);
}

function serializeHeading(element: HTMLElement): string {
  const match = /^H([1-6])$/.exec(element.tagName);
  if (!match) return '';

  const level = Number(match[1]);
  const prefix = level <= 2 ? '##' : '#'.repeat(level);
  const text = serializeChildren(element);
  return text ? `${prefix} ${text}` : '';
}

function serializeBlockElement(element: HTMLElement): string {
  if (/^H[1-6]$/.test(element.tagName)) return serializeHeading(element);
  if (element.tagName === 'BLOCKQUOTE') {
    return serializeChildren(element)
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  }
  if (element.tagName === 'PRE') {
    return `\`\`\`\n${element.textContent ?? ''}\n\`\`\``;
  }
  if (element.tagName === 'UL' || element.tagName === 'OL') {
    const ordered = element.tagName === 'OL';
    return Array.from(element.children)
      .filter((child): child is HTMLElement => child.tagName === 'LI')
      .map((child, index) => {
        const prefix = ordered ? `${index + 1}. ` : '- ';
        const text = serializeChildren(child);
        return `${prefix}${text.replace(/\n/g, `\n${' '.repeat(prefix.length)}`)}`;
      })
      .join('\n');
  }
  return serializeChildren(element);
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === 3) return escapeMarkdownText(node.textContent ?? '');
  if (node.nodeType !== 1) return '';

  const element = node as HTMLElement;
  if (isBlockElement(element)) return serializeBlockElement(element);
  if (element.tagName === 'BR') return '\n';
  if (element.tagName === 'STRONG' || element.tagName === 'B') {
    return `**${serializeChildren(element)}**`;
  }
  if (element.tagName === 'EM' || element.tagName === 'I') {
    return `*${serializeChildren(element)}*`;
  }
  if (element.tagName === 'CODE') return `\`${element.textContent ?? ''}\``;
  if (element.tagName === 'A') {
    const text = serializeChildren(element);
    const href = safeHref(element.getAttribute('href') ?? '');
    if (!href) return text;
    return `[${text}](${escapeMarkdownHref(href)})`;
  }
  return serializeChildren(element);
}

function serializeChildren(element: Node): string {
  const parts: string[] = [];
  let inline = '';

  const flush = (): void => {
    const value = inline.trim();
    if (value) parts.push(value);
    inline = '';
  };

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1 && isBlockElement(child as HTMLElement)) {
      flush();
      const block = serializeBlockElement(child as HTMLElement);
      if (block) parts.push(block);
      continue;
    }
    inline += serializeInlineNode(child);
  }
  flush();
  return parts.join('\n\n');
}

function serializeContentElement(element: HTMLElement, blocks: string[]): void {
  if (element.classList.contains('section-heading')) return;

  if (element.classList.contains('key-idea')) {
    const text = serializeChildren(element.querySelector('p') ?? element);
    if (text) blocks.push(`> ${text}`);
    return;
  }

  if (element.classList.contains('terms')) {
    const lines = Array.from(element.querySelectorAll<HTMLElement>('.term-row'))
      .map((row) => {
        const term = serializeChildren(row.querySelector('dt') ?? row);
        const description = serializeChildren(row.querySelector('dd') ?? row);
        return term ? `- **${term}**: ${description}` : '';
      })
      .filter(Boolean);
    if (lines.length) blocks.push(lines.join('\n'));
    return;
  }

  if (element.classList.contains('checklist')) {
    const lines = Array.from(element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .map((input) => {
        const text = serializeChildren(input.closest('label')?.querySelector('span') ?? input);
        return text ? `- [${input.checked ? 'x' : ' '}] ${text}` : '';
      })
      .filter(Boolean);
    if (lines.length) blocks.push(lines.join('\n'));
    return;
  }

  const text = serializeInlineNode(element);
  if (text) blocks.push(text);
}

export function serializeNoteEditor(editor: HTMLElement, title: string): string {
  const blocks: string[] = [`# ${escapeMarkdownText(title || 'Study notes')}`];
  const paper = editor.querySelector<HTMLElement>('.note-paper') ?? editor;

  for (const node of Array.from(paper.children)) {
    if (!(node instanceof HTMLElement)) continue;

    if (node.classList.contains('note-section')) {
      const heading = stripSectionNumber(
        node.querySelector<HTMLElement>('.section-heading')?.textContent ?? '',
      );
      if (heading) blocks.push(`## ${escapeMarkdownText(heading)}`);
      for (const child of Array.from(node.children)) {
        if (!(child instanceof HTMLElement)) continue;
        serializeContentElement(child, blocks);
      }
      continue;
    }

    serializeContentElement(node, blocks);
  }

  return blocks.join('\n\n').trim();
}
