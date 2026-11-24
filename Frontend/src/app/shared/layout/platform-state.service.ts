import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { SidePanelNav, SidePanelTab, SidePanelWorkspace } from '../components/side-panel.component';
import { toWorkspaceSummary } from '../services/adapters';
import { WorkspacesService } from '../services/workspaces.service';

export type PlatformSection = 'workspace' | 'notes' | 'quizzes' | 'runner';

const EMPTY_WORKSPACE: SidePanelWorkspace = {
  id: '',
  name: 'No workspace',
  marker: '#8aa793',
};

@Injectable({ providedIn: 'root' })
export class PlatformState {
  private readonly workspacesService = inject(WorkspacesService);
  private readonly router = inject(Router);
  private workspaceRequest?: Subscription;

  readonly section = signal<PlatformSection>('workspace');
  readonly workspaces = signal<SidePanelWorkspace[]>([]);
  readonly selectedWorkspace = signal<SidePanelWorkspace>(EMPTY_WORKSPACE);
  readonly loadingWorkspaces = signal(false);

  readonly activeNav = signal<SidePanelNav>('workspaces');
  readonly activeTab = signal<SidePanelTab>('files');
  readonly headerQuery = signal('');
  readonly searchOpen = signal(false);
  readonly mobileMenuOpen = signal(false);

  setSection(section: PlatformSection): void {
    this.section.set(section);
    this.activeTab.set(
      section === 'notes' ? 'notes' : section === 'quizzes' || section === 'runner' ? 'quizzes' : 'files',
    );
    this.activeNav.set(
      section === 'workspace' ? 'workspaces' : section === 'notes' ? 'notes' : 'quizzes',
    );
    this.mobileMenuOpen.set(false);
  }

  loadWorkspaces(): void {
    this.loadingWorkspaces.set(true);
    this.workspacesService.listWorkspaces({ limit: 100 }).subscribe({
      next: (page) => {
        this.workspaces.set(page.items.map(toWorkspaceSummary));
        this.loadingWorkspaces.set(false);
      },
      error: () => this.loadingWorkspaces.set(false),
    });
  }

  selectWorkspace(workspace: SidePanelWorkspace): void {
    this.selectedWorkspace.set(workspace);
    this.activeNav.set('workspaces');
    this.mobileMenuOpen.set(false);
  }

  clearWorkspaceSelection(): void {
    this.selectedWorkspace.set(EMPTY_WORKSPACE);
  }

  ensureWorkspaceSelection(): void {
    if (this.selectedWorkspace().id) return;
    const first = this.workspaces()[0];
    if (first) this.selectWorkspace(first);
  }

  selectWorkspaceById(id: string): void {
    if (!id) return;

    const existing = this.workspaces().find((workspace) => workspace.id === id);
    if (existing) {
      this.selectWorkspace(existing);
      return;
    }

    this.workspaceRequest?.unsubscribe();
    this.workspaceRequest = this.workspacesService.getWorkspace(id).subscribe({
      next: (workspace) => this.selectWorkspace(toWorkspaceSummary(workspace)),
    });
  }

  createWorkspace(name: string): void {
    this.workspacesService.createWorkspace(name).subscribe((workspace) => {
      const created = toWorkspaceSummary(workspace);
      this.workspaces.update((list) => [...list, created]);
      this.selectWorkspace(created);
      void this.router.navigate(['/workspaces', created.id]);
    });
  }

  setNav(section: SidePanelNav): void {
    this.activeNav.set(section);
    this.mobileMenuOpen.set(false);
  }

  setTab(tab: SidePanelTab): void {
    this.activeTab.set(tab);
    this.mobileMenuOpen.set(false);
  }

  onHeaderQuery(value: string): void {
    this.headerQuery.set(value);
  }

  clearQuery(): void {
    this.headerQuery.set('');
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
  }

  toggleMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  reset(): void {
    this.workspaceRequest?.unsubscribe();
    this.workspaces.set([]);
    this.selectedWorkspace.set(EMPTY_WORKSPACE);
    this.loadingWorkspaces.set(false);
    this.activeNav.set('workspaces');
    this.activeTab.set('files');
    this.headerQuery.set('');
    this.searchOpen.set(false);
    this.mobileMenuOpen.set(false);
  }
}
