import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

import {
  Material,
  ProgressReport,
  Quiz,
  QuizPage,
  StudyGuide,
  StudyGuidePage,
} from './api.models';
import { MaterialsService } from './materials.service';
import { ProgressService } from './progress.service';
import { QuizzesService } from './quizzes.service';
import { StudyGuidesService } from './study-guides.service';
import { WorkspacesService } from './workspaces.service';

export interface WorkspaceOverview {
  materials: Material[];
  guides: StudyGuide[];
  quizzes: Quiz[];
  progress: ProgressReport | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceOverviewService {
  private readonly materials = inject(MaterialsService);
  private readonly studyGuides = inject(StudyGuidesService);
  private readonly quizzes = inject(QuizzesService);
  private readonly progress = inject(ProgressService);
  private readonly workspaces = inject(WorkspacesService);

  load(workspaceId: string): Observable<WorkspaceOverview> {
    return this.materials
      .listMaterials(workspaceId, { limit: 100 })
      .pipe(
        switchMap((page) =>
          this.withMaterialContent(page.items, this.progress.getMyProgress({ limit: 100 })),
        ),
      );
  }

  loadAll(): Observable<WorkspaceOverview> {
    return this.workspaces.listWorkspaces({ limit: 100 }).pipe(
      switchMap((workspacePage) => {
        const workspaceIds = workspacePage.items.map((workspace) => workspace.id);
        const progress$ = this.progress.getMyProgress({ limit: 100 });

        if (!workspaceIds.length) {
          return this.withMaterialContent([], progress$);
        }

        return forkJoin(
          workspaceIds.map((workspaceId) =>
            this.materials.listMaterials(workspaceId, { limit: 100 }),
          ),
        ).pipe(
          switchMap((materialPages) =>
            this.withMaterialContent(
              materialPages.flatMap((page) => page.items),
              progress$,
            ),
          ),
        );
      }),
    );
  }

  private withMaterialContent(
    materials: Material[],
    progress$: Observable<ProgressReport>,
  ): Observable<WorkspaceOverview> {
    const guidePages$: Observable<StudyGuidePage[]> = materials.length
      ? forkJoin(
          materials.map((material) =>
            this.studyGuides.listStudyGuides(material.id, { limit: 100 }),
          ),
        )
      : of([]);
    const quizPages$: Observable<QuizPage[]> = materials.length
      ? forkJoin(materials.map((material) => this.quizzes.listQuizzes(material.id, { limit: 100 })))
      : of([]);

    return forkJoin({
      guidePages: guidePages$,
      quizPages: quizPages$,
      progress: progress$,
    }).pipe(
      map(({ guidePages, quizPages, progress }) => ({
        materials,
        guides: guidePages.flatMap((page) => page.items).sort(byNewest),
        quizzes: quizPages.flatMap((page) => page.items).sort(byNewest),
        progress,
      })),
    );
  }
}

function byNewest<T extends { updatedAt: string }>(a: T, b: T): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}
