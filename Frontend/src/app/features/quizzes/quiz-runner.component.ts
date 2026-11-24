import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { questionTypeToMode } from '../../shared/services/adapters';
import { AttemptResult, QuizDraft, QuizForTaking } from '../../shared/services/api.models';
import { AttemptsService } from '../../shared/services/attempts.service';
import { QuizDraftsService } from '../../shared/services/quiz-drafts.service';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { MODE_HELP, MODE_LABELS } from './quiz-ui.config';

export function safeQuizReturn(value: string | null): string {
  if (!value) return '/quizzes';
  return /^\/(?:quizzes|workspaces\/[a-zA-Z0-9-]+\/quizzes)(?:\?[^#]*)?$/.test(value) ? value : '/quizzes';
}
@Component({ selector: 'app-quiz-runner', standalone: true, imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './quiz-runner.component.html', styleUrl: './quiz-runner.component.scss' })
export class QuizRunnerComponent {
  readonly quizId = input.required<string>();
  private readonly quizzes = inject(QuizzesService);
  private readonly drafts = inject(QuizDraftsService);
  private readonly attempts = inject(AttemptsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {initialValue: this.route.snapshot.queryParamMap});
  readonly quiz = signal<QuizForTaking | null>(null);
  readonly draft = signal<QuizDraft | null>(null);
  readonly answers = signal<Record<string, string[]>>({});
  readonly index = signal(0);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly errorMessage = signal('');
  readonly conflict = signal(false);
  readonly saveState = signal<'saving' | 'saved' | 'unsaved' | 'failed'>('saved');
  readonly attempt = signal<AttemptResult | null>(null);
  readonly returnUrl = safeQuizReturn(this.route.snapshot.queryParamMap.get('returnUrl'));
  readonly backLink = this.router.parseUrl(this.returnUrl);
  readonly questions = computed(() => this.quiz()?.questions ?? []);
  readonly question = computed(() => this.questions()[this.index()]);
  readonly total = computed(() => this.questions().length);
  readonly mode = computed(() => questionTypeToMode(this.question()?.questionType));
  readonly modeLabel = computed(() => MODE_LABELS[this.mode()]);
  readonly helpText = computed(() => MODE_HELP[this.mode()]);
  readonly completedCount = computed(() => this.questions().filter(q => this.answers()[q.id]?.length).length);
  readonly progress = computed(() => this.total() ? Math.round(this.completedCount() / this.total() * 100) : 0);
  private version = 0;
  private savedVersion = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private saving?: Promise<boolean>;
  private loadVersion = 0;

  constructor() {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (this.version !== this.savedVersion) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    inject(DestroyRef).onDestroy(() => { clearTimeout(this.timer); window.removeEventListener('beforeunload', beforeUnload); ++this.loadVersion; });
    effect(() => { void this.load(this.quizId(), this.queryParams().get('attemptId')); });
  }
  private async load(id: string, attemptId: string | null): Promise<void> {
    const generation = ++this.loadVersion;
    clearTimeout(this.timer);
    this.saving = undefined;
    this.loading.set(true); this.errorMessage.set(''); this.attempt.set(null); this.draft.set(null);
    this.submitting.set(false); this.version = this.savedVersion = 0; this.answers.set({}); this.conflict.set(false); this.saveState.set('saved');
    try {
      const quiz = await firstValueFrom(this.quizzes.getQuizForTaking(id));
      if (generation !== this.loadVersion) return;
      this.quiz.set(quiz);
      if (attemptId) {
        const result = await firstValueFrom(this.attempts.getAttemptResult(attemptId));
        if (generation !== this.loadVersion) return;
        if (result.quizId !== id) throw new Error('Quiz mismatch');
        this.attempt.set(result); this.focus('summary-title');
      } else {
        const draft = await firstValueFrom(this.drafts.open(id));
        if (generation !== this.loadVersion) return;
        this.applyDraft(draft);
      }
    } catch { this.errorMessage.set('This quiz or result could not be loaded. Please try again.'); }
    finally { if (generation === this.loadVersion) this.loading.set(false); }
  }
  private applyDraft(draft: QuizDraft): void {
    this.draft.set(draft); this.answers.set(Object.fromEntries(draft.answers.map(a => [a.questionId, a.selectedOptionIds])));
    this.index.set(Math.max(0, this.questions().findIndex(q => q.id === draft.currentQuestionId)));
    this.version = this.savedVersion = 0; this.conflict.set(false); this.saveState.set('saved'); this.errorMessage.set('');
    this.focus('question-prompt');
  }
  private focus(id: string): void { setTimeout(() => document.getElementById(id)?.focus()); }
  selected(id: string): boolean { return !!this.answers()[this.question()?.id]?.includes(id); }
  select(id: string, event: Event): void {
    if (this.submitting()) return;
    const q = this.question(); if (!q) return;
    const checked = (event.target as HTMLInputElement).checked;
    const selected = this.mode() === 'multi' ? (checked ? [...(this.answers()[q.id] ?? []), id] : (this.answers()[q.id] ?? []).filter(v => v !== id)) : [id];
    this.answers.update(a => ({...a, [q.id]: selected})); this.changed();
  }
  dropdown(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.answers.update(a => ({...a, [this.question().id]: id ? [id] : []})); this.changed();
  }
  goTo(index: number): void {
    if (index < 0 || index >= this.total() || this.submitting()) return;
    this.index.set(index); this.changed(); this.focus('question-prompt');
  }
  private changed(): void {
    ++this.version; this.saveState.set('unsaved'); clearTimeout(this.timer);
    if (!this.conflict()) this.timer = setTimeout(() => void this.save(), 750);
  }
  async save(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.saving) { const ok = await this.saving; return ok ? this.save() : false; }
    if (!this.draft() || this.conflict()) return false;
    if (this.savedVersion === this.version) return true;
    const pending = this.savePending(this.loadVersion);
    this.saving = pending;
    try { return await pending; } finally { if (this.saving === pending) this.saving = undefined; }
  }
  private async savePending(generation: number): Promise<boolean> {
    while (this.savedVersion !== this.version) {
      if (generation !== this.loadVersion) return false;
      const version = this.version; const draft = this.draft()!;
      this.saveState.set('saving');
      try {
        const saved = await firstValueFrom(this.drafts.save(draft.id, {
          revision: draft.revision,
          answers: this.questions().map(q => ({questionId: q.id, selectedOptionIds: [...(this.answers()[q.id] ?? [])]})),
          currentQuestionId: this.question()?.id ?? null,
        }));
        if (generation !== this.loadVersion) return false;
        this.draft.set(saved); this.savedVersion = version;
      } catch (error) {
        if (generation !== this.loadVersion) return false;
        this.saveState.set('failed');
        this.conflict.set((error as {status?: number}).status === 409);
        this.errorMessage.set(this.conflict() ? 'This draft changed elsewhere. Reload the saved draft to continue.' : 'Progress could not be saved. Retry before leaving.');
        return false;
      }
    }
    this.saveState.set('saved'); this.errorMessage.set(''); return true;
  }
  async reloadDraft(): Promise<void> {
    const draft = this.draft(); if (!draft || this.submitting()) return;
    const generation = this.loadVersion;
    try { const saved = await firstValueFrom(this.drafts.get(draft.id)); if (generation === this.loadVersion) this.applyDraft(saved); }
    catch { if (generation === this.loadVersion) this.errorMessage.set('Could not reload your saved draft. Please try again.'); }
  }
  async canLeave(): Promise<boolean> {
    if (this.attempt() || this.version === this.savedVersion) return true;
    if (await this.save()) return true;
    return window.confirm('Your latest changes are not saved. Leave and discard those changes?');
  }
  async submit(): Promise<void> {
    if (this.submitting() || this.completedCount() !== this.total() || !this.total()) return;
    const generation = this.loadVersion;
    this.submitting.set(true);
    try {
      if (!(await this.save())) return;
      const draft = this.draft()!;
      const result = await firstValueFrom(this.drafts.submit(draft.id, draft.revision));
      if (generation !== this.loadVersion) return;
      this.attempt.set(result); this.focus('summary-title');
      await this.router.navigate([], {relativeTo: this.route, queryParams: {attemptId: result.id, returnUrl: this.returnUrl}, replaceUrl: true});
    } catch (error) {
      if (generation !== this.loadVersion) return;
      this.conflict.set((error as {status?: number}).status === 409);
      this.errorMessage.set(this.conflict() ? 'This draft changed elsewhere. Reload the saved draft to continue.' : 'Submission failed. Your saved progress is available; try again.');
    } finally { if (generation === this.loadVersion) this.submitting.set(false); }
  }
  async tryAgain(): Promise<void> {
    await this.router.navigate([], {relativeTo: this.route, queryParams: {returnUrl: this.returnUrl}, replaceUrl: true});

  }
}
