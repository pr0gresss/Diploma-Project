import { GenerateQuizDialogComponent } from '../../shared/components/generate-quiz-dialog.component';
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
import { concatMap, from, Subscription } from 'rxjs';

import { findQuizProgress, toWorkspaceFile } from '../../shared/services/adapters';
import { Material, ProgressReport, Quiz } from '../../shared/services/api.models';
import { MaterialsService } from '../../shared/services/materials.service';
import { WorkspaceOverviewService } from '../../shared/services/workspace-overview.service';
import { PlatformState } from '../../shared/layout/platform-state.service';
import { IconComponent } from '../../shared/icon/icon.component';
import { WorkspaceTabsComponent } from '../../shared/components/workspace-tabs.component';
import { FileKind, WorkspaceFile } from '../../shared/models';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [RouterLink, IconComponent, WorkspaceTabsComponent, GenerateQuizDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-page.component.html',
  styleUrl: './workspace-page.component.scss',
})
export class WorkspacePageComponent {
  readonly workspaceId = input('');
  readonly layout = inject(PlatformState);

  private readonly materials = inject(MaterialsService);
  private readonly overview = inject(WorkspaceOverviewService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private overviewSubscription?: Subscription;
  private uploadSubscription?: Subscription;
  private activeWorkspaceId = '';
  private activeRouteId = '';

  readonly generationMaterials = signal<Material[]>([]);
  readonly showGenerator = signal(false);
  readonly selectedMaterialIds = computed(() => this.selectedFiles().map((f) => f.id));

  readonly files = signal<WorkspaceFile[]>([]);
  readonly notesCount = signal(0);
  readonly quizzesCount = signal(0);
  readonly quizzes = signal<Quiz[]>([]);
  readonly progress = signal<ProgressReport | null>(null);
  readonly loadingFiles = signal(false);
  readonly uploading = signal(false);
  readonly uploadError = signal('');

  readonly selectedFiles = computed(() => this.files().filter((file) => file.selected));
  readonly selectedCount = computed(() => this.selectedFiles().length);
  readonly resumeQuiz = computed(() => {
    const workspaceId = this.layout.selectedWorkspace().id;
    const report = this.progress();
    let resume: Quiz | null = null;
    let lastInteraction = Number.NEGATIVE_INFINITY;

    for (const quiz of this.quizzes()) {
      const item = findQuizProgress(report, quiz.id);
      if (!item || item.workspaceId !== workspaceId || item.completedAttempts <= 0) continue;

      const timestamp = Date.parse(item.lastCompletedAt);
      const interactionTime = Number.isNaN(timestamp) ? 0 : timestamp;
      if (resume && interactionTime <= lastInteraction) continue;

      resume = quiz;
      lastInteraction = interactionTime;
    }

    return resume;
  });
  readonly filteredFiles = computed(() => {
    const query = this.fileQuery().trim().toLowerCase();
    return query
      ? this.files().filter((file) => file.name.toLowerCase().includes(query))
      : this.files();
  });

  readonly fileQuery = signal('');
  readonly dragging = signal(false);

  constructor() {
    effect(() => {
      const routeWorkspaceId = this.workspaceId();
      if (!routeWorkspaceId || routeWorkspaceId === this.activeRouteId) {
        return;
      }

      this.activeRouteId = routeWorkspaceId;
      this.layout.selectWorkspaceById(routeWorkspaceId);
    });

    effect(() => {
      const workspaceId = this.layout.selectedWorkspace().id;
      if (workspaceId === this.activeWorkspaceId) {
        return;
      }

      this.activeWorkspaceId = workspaceId;
      this.overviewSubscription?.unsubscribe();

      if (!workspaceId) {
        this.reset();
        return;
      }

      this.loadOverview(workspaceId);
    });
  }

  toggleFile(id: string): void {
    this.files.update((files) =>
      files.map((file) => (file.id === id ? { ...file, selected: !file.selected } : file)),
    );
  }

  onFileQuery(event: Event): void {
    this.fileQuery.set((event.target as HTMLInputElement).value);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(event.dataTransfer?.files);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  openQuiz(): void {
    if (!this.selectedCount()) return;
    this.showGenerator.set(true);
  }

  generated(results: Quiz[]): void {
    this.showGenerator.set(false);
    const returnUrl = '/workspaces/' + this.workspaceId() + '/quizzes';
    if (results.length === 1)
      void this.router.navigate(['/quizzes', results[0].id], { queryParams: { returnUrl } });
    else void this.router.navigate(['/workspaces', this.workspaceId(), 'quizzes']);
  }

  kindStyle(kind: FileKind): string {
    const palette =
      kind === 'DOC'
        ? 'background:var(--doc-bg);color:var(--doc-ink)'
        : kind === 'PPT'
          ? 'background:var(--ppt-bg);color:var(--ppt-ink)'
          : kind === 'TXT'
            ? 'background:var(--surface-tint);color:var(--muted)'
            : 'background:var(--pdf-bg);color:var(--pdf-ink)';
    return `${palette};width:30px;height:35px;border-radius:5px;display:grid;place-items:center;font-size:8px;font-weight:600;flex:none`;
  }

  quizMeta(quiz: Quiz): string {
    const item = findQuizProgress(this.progress(), quiz.id);
    return item
      ? `In progress · ${item.latestScorePercent}% latest · ${item.completedAttempts} ${item.completedAttempts === 1 ? 'attempt' : 'attempts'}`
      : `${quiz.questionCount} questions · Not started`;
  }

  private reset(): void {
    this.files.set([]);
    this.generationMaterials.set([]);
    this.notesCount.set(0);
    this.quizzesCount.set(0);
    this.quizzes.set([]);
    this.progress.set(null);
    this.loadingFiles.set(false);
    this.uploading.set(false);
    this.uploadError.set('');
  }

  private loadOverview(workspaceId: string): void {
    this.loadingFiles.set(true);
    this.overviewSubscription = this.overview
      .load(workspaceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (overview) => {
          this.generationMaterials.set(overview.materials);
          this.files.set(overview.materials.map(toWorkspaceFile));
          this.notesCount.set(overview.guides.length);
          this.quizzesCount.set(overview.quizzes.length);
          this.quizzes.set(overview.quizzes);
          this.progress.set(overview.progress);
          this.loadingFiles.set(false);
        },
        error: () => this.loadingFiles.set(false),
      });
  }

  private addFiles(list: FileList | null | undefined): void {
    const files = Array.from(list ?? []);
    const workspaceId = this.layout.selectedWorkspace().id;
    if (!workspaceId || !files.length) return;

    this.uploadSubscription?.unsubscribe();
    this.uploadError.set('');
    this.uploading.set(true);

    this.uploadSubscription = from(files)
      .pipe(
        concatMap((file) => this.materials.uploadMaterial(workspaceId, file)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        error: (error: unknown) => {
          this.uploadError.set(this.uploadErrorMessage(error));
          this.uploading.set(false);
          this.loadOverview(workspaceId);
        },
        complete: () => {
          this.uploading.set(false);
          this.loadOverview(workspaceId);
        },
      });
  }

  private uploadErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    }

    return 'Upload failed. Use a PDF or DOCX file under 10 MB and try again.';
  }
}
