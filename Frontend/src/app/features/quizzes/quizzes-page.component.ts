import { GenerateQuizDialogComponent } from '../../shared/components/generate-quiz-dialog.component';
import { DeleteQuizDialogComponent } from './delete-quiz-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { findQuizProgress, toQuizSummary } from '../../shared/services/adapters';
import { Material, ProgressReport, Quiz } from '../../shared/services/api.models';
import { WorkspaceOverviewService } from '../../shared/services/workspace-overview.service';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { PlatformState } from '../../shared/layout/platform-state.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { WorkspaceTabsComponent } from '../../shared/components/workspace-tabs.component';
import type { QuizSummary } from '../../shared/models';

type QuizFilter = 'all' | 'in-progress';

@Component({
  selector: 'app-quizzes-page',
  standalone: true,
  imports: [
    RouterLink,
    IconComponent,
    WorkspaceTabsComponent,
    GenerateQuizDialogComponent,
    DeleteQuizDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quizzes-page.component.html',
  styleUrl: './quizzes-page.component.scss',
})
export class QuizzesPageComponent {
  readonly workspaceId = input('');
  readonly layout = inject(PlatformState);

  private readonly overview = inject(WorkspaceOverviewService);
  private readonly quizzesApi = inject(QuizzesService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;

  readonly showGenerator = signal(false);
  readonly deleteQuizTarget = signal<QuizSummary | null>(null);
  readonly deletingQuiz = signal(false);
  readonly deleteQuizError = signal('');

  readonly filter = signal<QuizFilter>('all');

  readonly quizzes = signal<QuizSummary[]>([]);
  readonly materials = signal<Material[]>([]);
  readonly guidesCount = signal(0);
  readonly progressReport = signal<ProgressReport | null>(null);

  readonly isWorkspaceScoped = computed(() => !!this.workspaceId());
  readonly pageEyebrow = computed(() =>
    this.isWorkspaceScoped() ? 'YOUR WORKSPACE / PRACTICE' : 'ALL MATERIALS / PRACTICE',
  );
  readonly pageHeading = computed(() =>
    this.isWorkspaceScoped() ? 'Your quizzes' : 'All quizzes',
  );
  readonly pageSubtitle = computed(() =>
    this.isWorkspaceScoped()
      ? 'Turn what you’ve learned into what you know.'
      : 'Practice with quizzes from every workspace and material.',
  );

  readonly counts = computed(() => ({
    all: this.quizzes().length,
    inProgress: this.quizzes().filter((quiz) => quiz.status === 'In progress').length,
  }));

  readonly visibleQuizzes = computed(() => {
    const filter = this.filter();
    return this.quizzes().filter((quiz) => filter === 'all' || quiz.status === 'In progress');
  });

  constructor() {
    effect(() => {
      const workspaceId = this.workspaceId();
      this.loadSubscription?.unsubscribe();

      const overview$ = workspaceId ? this.overview.load(workspaceId) : this.overview.loadAll();
      this.loadSubscription = overview$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (overview) => {
          const materialById = new Map(
            overview.materials.map((material) => [material.id, material]),
          );
          this.materials.set(overview.materials);
          this.guidesCount.set(overview.guides.length);
          this.progressReport.set(overview.progress);
          this.quizzes.set(
            overview.quizzes.map((quiz) =>
              toQuizSummary(
                quiz,
                findQuizProgress(overview.progress, quiz.id),
                'single',
                materialById.get(quiz.materialId),
              ),
            ),
          );
        },
        error: () => {
          this.quizzes.set([]);
          this.materials.set([]);
          this.guidesCount.set(0);
          this.progressReport.set(null);
        },
      });
    });
  }

  returnUrl(): string {
    return this.router.url;
  }

  progress(quiz: QuizSummary): number {
    return quiz.questions ? Math.round(((quiz.answeredCount ?? 0) / quiz.questions) * 100) : 0;
  }

  generateQuiz(): void {
    this.showGenerator.set(true);
  }
  generated(results: Quiz[]): void {
    this.showGenerator.set(false);
    if (results.length === 1)
      void this.router.navigate(['/quizzes', results[0].id], {
        queryParams: { returnUrl: this.router.url },
      });
    else
      this.quizzes.update((current) => [
        ...results.map((quiz) =>
          toQuizSummary(
            quiz,
            undefined,
            'single',
            this.materials().find((m) => m.id === quiz.materialId),
          ),
        ),
        ...current,
      ]);
  }

  openDeleteQuiz(quiz: QuizSummary): void {
    if (this.deletingQuiz()) return;
    this.deleteQuizError.set('');
    this.deleteQuizTarget.set(quiz);
  }

  closeDeleteQuiz(): void {
    if (this.deletingQuiz()) return;
    this.deleteQuizError.set('');
    this.deleteQuizTarget.set(null);
  }

  confirmDeleteQuiz(): void {
    const target = this.deleteQuizTarget();
    if (!target || this.deletingQuiz()) return;

    this.deletingQuiz.set(true);
    this.deleteQuizError.set('');

    this.quizzesApi
      .deleteQuiz(target.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.quizzes.update((current) => current.filter((quiz) => quiz.id !== target.id));
          this.progressReport.update((report) =>
            report
              ? {
                  ...report,
                  items: report.items.filter((item) => item.quizId !== target.id),
                }
              : report,
          );
          this.deletingQuiz.set(false);
          this.deleteQuizTarget.set(null);
        },
        error: (error: unknown) => {
          this.deleteQuizError.set(this.apiErrorMessage(error, 'Delete failed. Please try again.'));
          this.deletingQuiz.set(false);
        },
      });
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    }

    return fallback;
  }

  setFilter(next: QuizFilter): void {
    this.filter.set(next);
  }
}
