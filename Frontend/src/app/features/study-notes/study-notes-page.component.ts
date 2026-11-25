import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { CreateStudyNoteDialogComponent } from './create-study-note-dialog.component';
import type { CreateStudyNoteValue } from './create-study-note-dialog.component';
import { studyGuideToNote } from '../../shared/services/adapters';
import {
  createMarkdownNodes,
  renderInlineMarkdown,
  renderParagraph as renderParagraphHtml,
  serializeNoteEditor,
  stripSectionNumber,
} from '../../shared/services/markdown';
import { Material, StudyGuide, StudyGuideContent } from '../../shared/services/api.models';
import { HeaderSearchService } from '../../shared/services/header-search.service';
import { StudyGuidesService } from '../../shared/services/study-guides.service';
import { WorkspaceOverviewService } from '../../shared/services/workspace-overview.service';
import { PlatformState } from '../../shared/layout/platform-state.service';
import { StudyNote, StudyNoteSection } from '../../shared/models';
import { IconComponent } from '../../shared/icon/icon.component';
import { WorkspaceTabsComponent } from '../../shared/components/workspace-tabs.component';
import { LoaderComponent } from '../../shared/components/loader.component';

const AI_SUGGESTION =
  'In short, a cell works like a coordinated system: each structure has its own job, and together they keep the cell alive.';

function emptyNote(): StudyNote {
  return {
    id: '',
    title: 'Study notes',
    eyebrow: 'YOUR MATERIALS',
    subtitle: 'Select a guide to begin',
    updated: '',
    sourceFiles: [],
    sections: [
      {
        id: 'empty',
        number: '1.',
        title: 'Start here',
        paragraphs: ['Upload a file and create a study guide to see it here.'],
      },
    ],
    wordCount: 0,
  };
}

@Component({
  selector: 'app-study-notes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, CreateStudyNoteDialogComponent, WorkspaceTabsComponent, LoaderComponent],
  templateUrl: './study-notes-page.component.html',
  styleUrl: './study-notes-page.component.scss',
})
export class StudyNotesPageComponent {
  readonly guide = input('');
  readonly workspaceId = input('');

  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly layout = inject(PlatformState);
  private readonly overview = inject(WorkspaceOverviewService);
  private readonly studyGuides = inject(StudyGuidesService);
  private readonly headerSearch = inject(HeaderSearchService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private guideSubscription?: Subscription;
  private createSubscription?: Subscription;
  private saveSubscription?: Subscription;
  private renameSubscription?: Subscription;

  private readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editorBody');
  private readonly renameInputRef = viewChild<ElementRef<HTMLInputElement>>('renameInput');
  private savedRange: Range | null = null;

  readonly isWorkspaceScoped = computed(() => !!this.workspaceId());
  readonly workspaces = computed(() => this.layout.workspaces());
  readonly fileOptions = computed(() =>
    this.materials().map((material) => ({
      id: material.id,
      workspaceId: material.workspaceId,
      name: material.displayName,
    })),
  );
  readonly initialWorkspaceId = computed(
    () => this.workspaceId() || this.layout.selectedWorkspace().id,
  );
  readonly listHeading = computed(() =>
    this.isWorkspaceScoped() ? 'Study notes' : 'All study notes',
  );
  readonly listSubtitle = computed(() =>
    this.isWorkspaceScoped()
      ? 'Study guides created from the files in this workspace.'
      : 'Study guides from every workspace and material.',
  );

  readonly materials = signal<Material[]>([]);
  readonly guides = signal<StudyGuide[]>([]);
  readonly guideQuery = signal('');
  readonly filteredGuides = computed(() => {
    const query = this.guideQuery().trim().toLowerCase();
    if (!query) return this.guides();
    return this.guides().filter((guide) =>
      `${guide.displayName} ${this.sourceName(guide)}`.toLowerCase().includes(query),
    );
  });

  private readonly activeMaterialId = signal<string | null>(null);

  readonly note = signal<StudyNote>(emptyNote());
  readonly renderedNote = computed(() => [this.note()]);
  readonly wordCount = signal(0);
  readonly saved = signal(true);
  readonly saving = signal(false);
  readonly saveError = signal('');
  readonly activeSection = signal('empty');
  readonly outlineSections = signal<{ id: string; number: string; title: string }[]>([]);
  readonly statusText = computed(() =>
    this.saving() ? 'Saving…' : this.saved() ? 'All changes saved' : 'Unsaved changes',
  );
  readonly bold = signal(false);
  readonly italic = signal(false);
  readonly list = signal(false);
  readonly link = signal(false);
  readonly undoReady = signal(false);
  readonly format = signal('Normal text');
  readonly formatOpen = signal(false);
  readonly suggestionOpen = signal(false);
  readonly suggestionText = AI_SUGGESTION;
  readonly mobileNoteMenuOpen = signal(false);
  readonly loading = signal(false);
  readonly createNoteOpen = signal(false);
  readonly creatingNote = signal(false);
  readonly createNoteError = signal('');
  readonly renaming = signal(false);
  readonly renameValue = signal('');
  readonly renamingSaving = signal(false);
  readonly renameError = signal('');

  constructor() {
    effect(() => {
      const workspaceId = this.workspaceId();
      const requestedGuideId = this.guide();
      this.loadSubscription?.unsubscribe();
      this.guideSubscription?.unsubscribe();
      this.renameSubscription?.unsubscribe();
      this.materials.set([]);
      this.guides.set([]);
      this.activeMaterialId.set(null);
      this.renaming.set(false);
      this.renameValue.set('');
      this.renameError.set('');
      this.renamingSaving.set(false);
      this.mobileNoteMenuOpen.set(false);
      this.loading.set(true);

      const overview$ = workspaceId ? this.overview.load(workspaceId) : this.overview.loadAll();
      this.loadSubscription = overview$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (overview) => {
          this.materials.set(overview.materials);
          this.guides.set(overview.guides);

          if (!requestedGuideId) {
            this.note.set(emptyNote());
            this.loading.set(false);
            return;
          }

          const selected = overview.guides.find((guide) => guide.id === requestedGuideId);
          if (!selected) {
            this.note.set(emptyNote());
            this.loading.set(false);
            return;
          }

          this.activeMaterialId.set(selected.materialId);
          this.guideSubscription = this.studyGuides
            .getStudyGuide(selected.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (guide) => this.applyGuide(guide, overview.materials),
              error: () => this.loading.set(false),
            });
        },
        error: () => this.loading.set(false),
      });
    });
  }

  onGuideQuery(event: Event): void {
    this.guideQuery.set((event.target as HTMLInputElement).value);
  }

  openGuide(selected: StudyGuide): void {
    this.layout.setTab('notes');
    void this.router.navigate([], { queryParams: { guide: selected.id } });
  }

  backToGuides(): void {
    void this.router.navigate([], { queryParams: { guide: null }, queryParamsHandling: 'merge' });
  }

  toggleMobileNoteMenu(): void {
    this.mobileNoteMenuOpen.update((open) => !open);
  }

  saveNoteFromMenu(): void {
    this.mobileNoteMenuOpen.set(false);
    this.saveNote();
  }

  exportNotesFromMenu(): void {
    this.mobileNoteMenuOpen.set(false);
    this.exportNotes();
  }

  startRename(): void {
    if (!this.guide()) return;
    this.mobileNoteMenuOpen.set(false);
    this.renameValue.set(this.note().title);
    this.renameError.set('');
    this.renaming.set(true);
    setTimeout(() => {
      const input = this.renameInputRef()?.nativeElement;
      input?.focus();
      input?.select();
    }, 0);
  }

  onRenameInput(event: Event): void {
    this.renameValue.set((event.target as HTMLInputElement).value);
    this.renameError.set('');
  }

  cancelRename(): void {
    if (this.renamingSaving()) return;
    this.renaming.set(false);
    this.renameValue.set('');
    this.renameError.set('');
  }

  saveRename(): void {
    const guideId = this.guide();
    const displayName = this.renameValue().trim();
    if (!guideId || this.renamingSaving()) return;

    if (!displayName) {
      this.renameError.set('Enter a name for this note.');
      return;
    }

    if (displayName === this.note().title.trim()) {
      this.cancelRename();
      return;
    }

    this.renameError.set('');
    this.renamingSaving.set(true);
    this.renameSubscription?.unsubscribe();
    this.renameSubscription = this.studyGuides
      .renameStudyGuide(guideId, displayName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.renamingSaving.set(false);
          this.renaming.set(false);
          this.note.update((note) => ({
            ...note,
            title: updated.displayName,
            updated: new Date(updated.updatedAt).toLocaleDateString(),
          }));
          this.guides.update((list) =>
            list.map((item) =>
              item.id === updated.id
                ? { ...item, displayName: updated.displayName, updatedAt: updated.updatedAt }
                : item,
            ),
          );
          this.headerSearch.reset();
        },
        error: () => {
          this.renamingSaving.set(false);
          this.renameError.set('Could not rename this note. Try again.');
        },
      });
  }

  sourceName(selected: StudyGuide): string {
    return (
      this.materials().find((material) => material.id === selected.materialId)?.displayName ??
      'Uploaded material'
    );
  }

  workspaceFor(selected: StudyGuide): string {
    const workspaceId = this.materials().find(
      (material) => material.id === selected.materialId,
    )?.workspaceId;
    return (
      (workspaceId && this.workspaces().find((workspace) => workspace.id === workspaceId)?.name) ||
      'Unknown workspace'
    );
  }

  guideUpdated(selected: StudyGuide): string {
    return new Date(selected.updatedAt).toLocaleDateString();
  }

  jumpToSection(section: { id: string }): void {
    this.activeSection.set(section.id);
    const target = this.document.getElementById(section.id);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }

  syncOutline(): void {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) return;

    const sections = this.outlineNodes(editor).map((node, index) => {
      if (!node.id) node.id = `note-heading-${index + 1}`;
      const titleNode = node.classList.contains('note-section')
        ? node.querySelector<HTMLElement>('.section-heading')
        : node;
      return {
        id: node.id,
        number: `${index + 1}.`,
        title: stripSectionNumber(titleNode?.textContent ?? ''),
      };
    });
    this.outlineSections.set(sections);
    if (!sections.some((section) => section.id === this.activeSection())) {
      this.activeSection.set(sections[0]?.id ?? '');
    }
  }

  onEditorScroll(): void {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) return;

    const editorTop = editor.getBoundingClientRect().top;
    let active = '';
    for (const node of this.outlineNodes(editor)) {
      if (!node.id) continue;
      if (node.getBoundingClientRect().top - editorTop <= 32) {
        active = node.id;
      }
    }
    if (active && active !== this.activeSection()) {
      this.activeSection.set(active);
    }
  }

  toggleCheck(): void {
    this.markSaved();
  }

  renderInline(value: string): string {
    return renderInlineMarkdown(value ?? '');
  }

  renderParagraph(value: string): string {
    return renderParagraphHtml(value ?? '');
  }

  renderSectionHeading(section: StudyNoteSection): string {
    return `${section.number}&nbsp;${renderInlineMarkdown(section.title ?? '')}`;
  }

  onEditorInput(): void {
    const text = this.editorRef()?.nativeElement.innerText ?? '';
    const words = text.trim();
    this.wordCount.set(words ? words.split(/\s+/).length : 0);
    this.undoReady.set(true);
    this.markSaved();
    this.syncOutline();
  }

  onEditorPaste(event: ClipboardEvent): void {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) return;

    event.preventDefault();
    const selection = this.document.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;

    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;

    const markdown = text.replace(/\r\n?/g, '\n');
    const blockPattern =
      /^\s*(?:#{1,6}\s+|>|[-*]\s+\[[ xX]\]\s+|[-*]\s+\*\*.+\*\*\s*[:—-]\s+|[-*]\s+|\d+[.)]\s+)/m;
    const isBlockPaste = /\n/.test(markdown.trimEnd()) || blockPattern.test(markdown);

    editor.focus();

    if (!isBlockPaste) {
      const inserted = this.document.execCommand(
        'insertHTML',
        false,
        renderInlineMarkdown(markdown),
      );
      if (!inserted) this.insertPlainText(editor, selection, markdown);
      this.onEditorInput();
      return;
    }

    const range = selection.getRangeAt(0);
    const paper = editor.querySelector<HTMLElement>('.note-paper') ?? editor;
    const blockSelector =
      'p, div.body-copy, h1, h2, h3, h4, h5, h6, ul, ol, dl, section.note-section';
    const section = this.closestElement(range.startContainer, '.note-section', editor);
    const reference = this.closestElement(range.startContainer, blockSelector, editor);

    range.deleteContents();

    const nodes = createMarkdownNodes(this.document, markdown);
    let activeSection = section;
    let topLevelReference = section;
    let blockReference = reference;
    let insertedSection = false;
    let lastInserted: Node | null = null;

    for (const node of nodes) {
      if (node.classList.contains('note-section')) {
        lastInserted = this.insertElementAfter(
          paper,
          node,
          topLevelReference ??
            Array.from(paper.querySelectorAll<HTMLElement>('.note-section')).at(-1) ??
            null,
        );
        topLevelReference = node;
        activeSection = node;
        insertedSection = true;
        continue;
      }

      if (insertedSection && activeSection) {
        activeSection.appendChild(node);
        lastInserted = node;
        continue;
      }

      const parent = activeSection ?? paper;
      const after =
        blockReference && blockReference !== parent && blockReference.parentElement === parent
          ? blockReference
          : null;
      lastInserted = this.insertElementAfter(parent, node, after);
      blockReference = node;
    }

    for (const checkbox of editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      if (checkbox.dataset['noteBound']) continue;
      checkbox.dataset['noteBound'] = 'true';
      checkbox.addEventListener('change', () => this.onEditorInput());
    }

    if (lastInserted) {
      const caret = this.document.createRange();
      caret.setStartAfter(lastInserted);
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);
    }

    this.onEditorInput();
  }

  private insertElementAfter(
    parent: HTMLElement,
    element: HTMLElement,
    after: HTMLElement | null,
  ): HTMLElement {
    const reference = after && after.parentElement === parent ? after.nextSibling : null;
    parent.insertBefore(element, reference);
    return element;
  }

  private closestElement(start: Node, selector: string, root: HTMLElement): HTMLElement | null {
    let current: Node | null = start;
    while (current && current !== root) {
      if (current.nodeType === 1 && (current as HTMLElement).matches(selector)) {
        return current as HTMLElement;
      }
      current = current.parentNode;
    }
    return null;
  }

  private insertPlainText(editor: HTMLElement, selection: Selection, text: string): void {
    const inserted = this.document.execCommand('insertText', false, text);
    if (inserted) return;

    const range = selection.rangeCount ? selection.getRangeAt(0) : this.document.createRange();
    if (!editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const fragment = this.document.createDocumentFragment();
    text.split('\n').forEach((line, index) => {
      if (index) fragment.appendChild(this.document.createElement('br'));
      fragment.appendChild(this.document.createTextNode(line));
    });
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  onEditorInteract(): void {
    const selection = this.document.getSelection();
    const editor = this.editorRef()?.nativeElement;
    if (selection?.rangeCount && editor?.contains(selection.anchorNode)) {
      this.savedRange = selection.getRangeAt(0).cloneRange();
    }
    this.syncToolbarState();
  }

  toggleBold(): void {
    this.bold.update((value) => !value);
    this.exec('bold');
  }

  toggleItalic(): void {
    this.italic.update((value) => !value);
    this.exec('italic');
  }

  toggleList(): void {
    this.list.update((value) => !value);
    this.exec('insertUnorderedList');
  }

  toggleLink(): void {
    if (this.link()) {
      this.link.set(false);
      this.exec('unlink');
      return;
    }
    const url = window.prompt('Link URL', 'https://');
    if (url) {
      this.link.set(true);
      this.exec('createLink', url);
    }
  }

  undo(): void {
    this.exec('undo');
    this.undoReady.set(false);
    this.syncToolbarState();
  }

  clearFormatting(): void {
    this.exec('removeFormat');
    this.bold.set(false);
    this.italic.set(false);
  }

  applyFormat(command: string, label: string): void {
    this.format.set(label);
    this.formatOpen.set(false);
    this.exec('formatBlock', command);
  }

  toggleFormatMenu(): void {
    this.formatOpen.update((open) => !open);
  }

  toggleSuggestion(): void {
    this.suggestionOpen.update((value) => !value);
  }

  insertSuggestion(): void {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) {
      return;
    }
    editor.focus();
    const range =
      this.savedRange && editor.contains(this.savedRange.commonAncestorContainer)
        ? this.savedRange.cloneRange()
        : this.document.createRange();
    if (!this.savedRange || !editor.contains(range.commonAncestorContainer)) {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    const selection = this.document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    if (range.toString().trim()) {
      range.deleteContents();
    }
    this.document.execCommand('insertText', false, this.suggestionText);
    this.suggestionOpen.set(false);
    this.savedRange = null;
    this.onEditorInput();
  }

  exportNotes(): void {
    const note = this.note();
    const body = this.editorRef()?.nativeElement.innerText.trim() ?? '';
    const lines = [note.title, '', body];
    if (note.sourceFiles.length) {
      lines.push('', 'Source documents:');
      note.sourceFiles.forEach((file) => lines.push(`• ${file.name} (${file.pages})`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `${note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  openCreateNote(): void {
    this.createNoteError.set('');
    this.createNoteOpen.set(true);
  }

  closeCreateNote(): void {
    if (this.creatingNote()) return;
    this.createNoteOpen.set(false);
    this.createNoteError.set('');
  }

  confirmCreateNote(value: CreateStudyNoteValue): void {
    if (this.creatingNote()) return;

    const { title, workspaceId, materialId } = value;
    const material = this.materials().find(
      (item) => item.id === materialId && item.workspaceId === workspaceId,
    );
    if (!material) {
      this.createNoteError.set('Choose a file in the selected workspace.');
      return;
    }

    const content = `# ${title}\n\nWrite your first idea here…`;
    this.createNoteError.set('');
    this.creatingNote.set(true);
    this.createSubscription?.unsubscribe();
    this.createSubscription = this.studyGuides
      .createStudyGuide(material.id, { displayName: title, content })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (guide) => {
          this.creatingNote.set(false);
          this.createNoteOpen.set(false);
          this.applyGuide({ ...guide, content }, this.materials());
          void this.router.navigate([], { queryParams: { guide: guide.id } });
        },
        error: () => {
          this.creatingNote.set(false);
          this.createNoteError.set('Could not create the study note. Try again.');
        },
      });
  }

  saveNote(): void {
    const guideId = this.guide();
    if (!guideId || this.saving()) return;

    this.saveError.set('');
    this.saving.set(true);
    this.saveSubscription?.unsubscribe();
    this.saveSubscription = this.studyGuides
      .updateStudyGuideContent(guideId, { content: this.serializeEditorToMarkdown() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
          this.syncOutline();
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set('Could not save this note. Try again.');
        },
      });
  }

  private serializeEditorToMarkdown(): string {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) return '';
    return serializeNoteEditor(editor, this.note().title);
  }

  private outlineNodes(editor: HTMLElement): HTMLElement[] {
    return Array.from(
      editor.querySelectorAll<HTMLElement>('.note-section, h1, h2, h3, h4, h5, h6'),
    ).filter(
      (node) =>
        !node.classList.contains('section-heading') && !node.classList.contains('doc-title'),
    );
  }

  private applyGuide(guide: StudyGuideContent, materials: Material[]): void {
    const material = materials.find((item) => item.id === guide.materialId);
    const note = studyGuideToNote(
      guide,
      material ? [{ name: material.displayName, pages: 'Uploaded material' }] : [],
    );
    this.activeMaterialId.set(guide.materialId);
    this.note.set(note);
    this.wordCount.set(note.wordCount);
    this.renaming.set(false);
    this.renameValue.set('');
    this.renameError.set('');
    this.renamingSaving.set(false);
    this.outlineSections.set([]);
    this.activeSection.set('');
    this.saved.set(true);
    this.saving.set(false);
    this.saveError.set('');
    this.suggestionOpen.set(false);
    this.formatOpen.set(false);
    this.mobileNoteMenuOpen.set(false);
    this.savedRange = null;
    this.loading.set(false);
    this.resetToolbar();
    setTimeout(() => this.syncOutline(), 0);
  }

  private exec(command: string, value?: string): void {
    const editor = this.editorRef()?.nativeElement;
    if (!editor) {
      return;
    }
    editor.focus();
    this.document.execCommand(command, false, value);
    this.onEditorInput();
  }

  private syncToolbarState(): void {
    const query = (command: string): boolean => {
      try {
        return this.document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    this.bold.set(query('bold'));
    this.italic.set(query('italic'));
    this.list.set(query('insertUnorderedList'));
  }

  private resetToolbar(): void {
    this.bold.set(false);
    this.italic.set(false);
    this.list.set(false);
    this.link.set(false);
    this.undoReady.set(false);
    this.format.set('Normal text');
  }

  private markSaved(): void {
    this.saved.set(false);
    this.saveError.set('');
  }
}
