import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

import type { IconName } from '../icon/icon.component';
import { WorkspaceOverview, WorkspaceOverviewService } from './workspace-overview.service';

export type HeaderSearchCategory = 'workspace' | 'material' | 'note' | 'quiz';

export interface HeaderSearchResult {
  id: string;
  category: HeaderSearchCategory;
  categoryLabel: string;
  icon: IconName;
  title: string;
  subtitle: string;
  workspaceId: string;
  route: string;
  queryParams?: Record<string, string>;
}

const CATEGORY_LABELS: Record<HeaderSearchCategory, string> = {
  workspace: 'Workspace',
  material: 'File',
  note: 'Study note',
  quiz: 'Quiz',
};

const CATEGORY_ORDER: HeaderSearchCategory[] = ['workspace', 'material', 'note', 'quiz'];
const SEARCH_DEBOUNCE_MS = 3000;

@Injectable({ providedIn: 'root' })
export class HeaderSearchService {
  private readonly overview = inject(WorkspaceOverviewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entries = signal<HeaderSearchResult[]>([]);
  private debounceTimer?: ReturnType<typeof setTimeout>;

  readonly query = signal('');
  readonly draftQuery = signal('');
  readonly pending = signal(false);
  readonly loading = signal(false);
  readonly ready = signal(false);

  readonly results = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    if (!term || !this.ready()) return [];

    return this.entries()
      .filter((entry) => this.searchText(entry).includes(term))
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
          a.title.localeCompare(b.title),
      )
      .slice(0, 20);
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
  }

  load(): void {
    if (this.loading() || this.ready()) return;

    this.loading.set(true);
    this.overview.loadAll().subscribe({
      next: (overview) => {
        this.entries.set(buildEntries(overview));
        this.ready.set(true);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setQuery(value: string): void {
    if (this.draftQuery() === value) return;

    this.draftQuery.set(value);
    this.clearTimer();

    const next = value.trim();
    if (!next || (next === this.query().trim() && this.ready())) {
      this.pending.set(false);
      if (!next) this.query.set('');
      return;
    }

    this.pending.set(true);
    this.debounceTimer = setTimeout(() => this.searchNow(), SEARCH_DEBOUNCE_MS);
  }

  searchNow(): void {
    this.clearTimer();
    this.pending.set(false);

    const next = this.draftQuery().trim();
    if (!next) {
      this.query.set('');
      return;
    }

    if (next === this.query().trim() && this.ready()) return;

    this.query.set(next);
    this.load();
  }

  clearQuery(): void {
    this.clearTimer();
    this.pending.set(false);
    this.query.set('');
    this.draftQuery.set('');
  }

  reset(): void {
    this.clearQuery();
    this.ready.set(false);
    this.entries.set([]);
    this.loading.set(false);
  }

  private clearTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  private searchText(entry: HeaderSearchResult): string {
    return `${entry.title} ${entry.subtitle} ${entry.categoryLabel}`.toLocaleLowerCase();
  }
}

function buildEntries(overview: WorkspaceOverview): HeaderSearchResult[] {
  const workspaceNames = new Map(
    overview.workspaces.map((workspace) => [workspace.id, workspace.name]),
  );
  const materialNames = new Map(
    overview.materials.map((material) => [material.id, material.displayName]),
  );
  const workspaceName = (workspaceId: string) => workspaceNames.get(workspaceId) ?? 'Workspace';

  return [
    ...overview.workspaces.map((workspace) => ({
      id: workspace.id,
      category: 'workspace' as const,
      categoryLabel: CATEGORY_LABELS.workspace,
      icon: 'grid' as const,
      title: workspace.name,
      subtitle: `${workspace.materialCount} file${workspace.materialCount === 1 ? '' : 's'}`,
      workspaceId: workspace.id,
      route: `/workspaces/${workspace.id}`,
    })),
    ...overview.materials.map((material) => ({
      id: material.id,
      category: 'material' as const,
      categoryLabel: CATEGORY_LABELS.material,
      icon: 'file' as const,
      title: material.displayName,
      subtitle: workspaceName(material.workspaceId),
      workspaceId: material.workspaceId,
      route: `/workspaces/${material.workspaceId}`,
    })),
    ...overview.guides.map((guide) => {
      const material = overview.materials.find((item) => item.id === guide.materialId);
      return {
        id: guide.id,
        category: 'note' as const,
        categoryLabel: CATEGORY_LABELS.note,
        icon: 'note' as const,
        title: guide.displayName,
        subtitle: `${materialNames.get(guide.materialId) ?? 'File'} · ${workspaceName(material?.workspaceId ?? '')}`,
        workspaceId: material?.workspaceId ?? '',
        route: `/workspaces/${material?.workspaceId ?? ''}/study-notes`,
        queryParams: { guide: guide.id },
      };
    }),
    ...overview.quizzes.map((quiz) => {
      const material = overview.materials.find((item) => item.id === quiz.materialId);
      return {
        id: quiz.id,
        category: 'quiz' as const,
        categoryLabel: CATEGORY_LABELS.quiz,
        icon: 'quiz' as const,
        title: quiz.displayName,
        subtitle: `${materialNames.get(quiz.materialId) ?? 'File'} · ${workspaceName(material?.workspaceId ?? '')}`,
        workspaceId: material?.workspaceId ?? '',
        route: `/quizzes/${quiz.id}`,
      };
    }),
  ];
}
