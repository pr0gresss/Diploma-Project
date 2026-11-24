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

import { findQuizProgress, modeToQuestionTypes, toQuizSummary } from '../../shared/services/adapters';
import { Material, ProgressReport } from '../../shared/services/api.models';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { WorkspaceOverviewService } from '../../shared/services/workspace-overview.service';
import { PlatformState } from '../../shared/layout/platform-state.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { WorkspaceTabsComponent } from '../../shared/components/workspace-tabs.component';
import type { QuizMode, QuizSummary } from '../../shared/models';

type QuizFilter = 'all' | 'in-progress';

@Component({
  selector: 'app-quizzes-page',
  standalone: true,
  imports: [RouterLink, IconComponent, WorkspaceTabsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quizzes-page.component.html',
  styleUrl: './quizzes-page.component.scss',
})
export class QuizzesPageComponent {
  readonly workspaceId = input('');
  readonly layout = inject(PlatformState);

  private readonly overview = inject(WorkspaceOverviewService);
  private readonly quizzesService = inject(QuizzesService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private generateSubscription?: Subscription;

  readonly filter = signal<QuizFilter>('all');
  readonly questionCount = signal(10);
  readonly questionType = signal<QuizMode>('single');
  readonly generating = signal(false);
  readonly generateError = signal('');

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
      this.loadSubscription = overview$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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

  progress(quiz: QuizSummary): number {
    return findQuizProgress(this.progressReport(), quiz.id)?.latestScorePercent ?? 0;
  }

  onQuestionCount(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.questionCount.set(Math.min(50, Math.max(1, Math.round(raw) || 1)));
  }

  onQuestionType(event: Event): void {
    this.questionType.set((event.target as HTMLSelectElement).value as QuizMode);
  }

  generateQuiz(): void {
    const materialId = this.materials()[0]?.id;
    if (!materialId || this.generating()) return;

    this.generateError.set('');
    this.generating.set(true);
    this.generateSubscription?.unsubscribe();
    this.generateSubscription = this.quizzesService
      .generateQuiz(materialId, {
        questionCount: this.questionCount(),
        questionTypes: modeToQuestionTypes(this.questionType()),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quiz) => void this.router.navigate(['/quizzes', quiz.id]),
        error: () => {
          this.generating.set(false);
          this.generateError.set('Could not generate the quiz. Try again.');
        },
      });
  }

  setFilter(next: QuizFilter): void {
    this.filter.set(next);
  }
}
