import { GenerateQuizDialogComponent } from '../../shared/components/generate-quiz-dialog.component';
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
import { PlatformState } from '../../shared/layout/platform-state.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { WorkspaceTabsComponent } from '../../shared/components/workspace-tabs.component';
import type { QuizSummary } from '../../shared/models';

type QuizFilter = 'all' | 'in-progress';

@Component({
  selector: 'app-quizzes-page',
  standalone: true,
  imports: [RouterLink, IconComponent, WorkspaceTabsComponent, GenerateQuizDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quizzes-page.component.html',
  styleUrl: './quizzes-page.component.scss',
})
export class QuizzesPageComponent {
  readonly workspaceId = input('');
  readonly layout = inject(PlatformState);

  private readonly overview = inject(WorkspaceOverviewService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;

  readonly showGenerator = signal(false);

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
    const term = this.layout.headerQuery().trim().toLowerCase();
    const filter = this.filter();
    return this.quizzes().filter((quiz) => {
      const matchesFilter = filter === 'all' || quiz.status === 'In progress';
      const matchesTerm =
        !term || `${quiz.title} ${quiz.subject} ${quiz.meta}`.toLowerCase().includes(term);
      return matchesFilter && matchesTerm;
    });
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

  setFilter(next: QuizFilter): void {
    this.filter.set(next);
  }
}
