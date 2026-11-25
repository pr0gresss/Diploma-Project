import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import type { SidePanelWorkspace } from '../components/side-panel.component';
import { HeaderSearchResultsComponent } from './header-search-results.component';
import { LogoutDialogComponent } from './logout-dialog.component';
import { IconComponent } from '../icon/icon.component';
import type { PlatformSection } from '../layout/platform-state.service';
import { HeaderSearchService, type HeaderSearchResult } from '../services/header-search.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    IconComponent,
    HeaderSearchResultsComponent,
    LogoutDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly section = input<PlatformSection>('workspace');
  readonly currentLabel = input('Workspace');
  readonly currentWorkspaceId = input('');
  readonly searchOpen = input(false);
  readonly userEmail = input('');
  readonly workspaces = input<readonly SidePanelWorkspace[]>([]);
  readonly selectedWorkspaceId = input<string | null>(null);

  readonly searchToggle = output<void>();
  readonly menuToggle = output<void>();
  readonly workspaceSelect = output<SidePanelWorkspace>();
  readonly searchResult = output<HeaderSearchResult>();
  readonly signOut = output<void>();

  readonly workspaceMenuOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly logoutDialogOpen = signal(false);
  readonly search = inject(HeaderSearchService);

  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabletSearchInput = viewChild<ElementRef<HTMLInputElement>>('tabletSearchInput');
  private readonly mobileSearchInput = viewChild<ElementRef<HTMLInputElement>>('mobileSearchInput');

  readonly userInitial = computed(() => {
    const email = this.userEmail().trim();
    return email ? email.charAt(0).toUpperCase() : '?';
  });

  readonly sectionLabel = computed(() => {
    switch (this.section()) {
      case 'notes':
        return 'Study notes';
      case 'quizzes':
        return 'Quizzes';
      case 'runner':
        return 'Practice quiz';
      default:
        return '';
    }
  });

  readonly isGeneralSection = computed(() => !this.currentWorkspaceId() && !!this.sectionLabel());

  readonly workspaceLink = computed(() => {
    const id = this.currentWorkspaceId();
    return id ? ['/workspaces', id] : ['/workspaces'];
  });

  readonly sectionLink = computed(() => {
    const workspaceId = this.currentWorkspaceId();
    switch (this.section()) {
      case 'notes':
        return workspaceId ? `/workspaces/${workspaceId}/study-notes` : '/study-notes';
      case 'quizzes':
      case 'runner':
        return workspaceId ? `/workspaces/${workspaceId}/quizzes` : '/quizzes';
      default:
        return '';
    }
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.closeWorkspaceMenu();
        this.closeAccountMenu();
        this.logoutDialogOpen.set(false);
        this.closeSearch();
      });
  }

  onQueryInput(event: Event): void {
    this.search.setQuery((event.target as HTMLInputElement).value);
  }

  onHeaderSearchButton(): void {
    this.closeAccountMenu();
    if (this.searchOpen()) {
      this.closeSearch();
      return;
    }
    this.submitSearch();
  }

  submitSearch(): void {
    this.closeAccountMenu();
    const wasOpen = this.searchOpen();
    this.search.searchNow();
    if (wasOpen) return;

    this.searchToggle.emit();

    const view = this.document.defaultView;
    const width = view?.innerWidth ?? 0;
    setTimeout(() => {
      const input =
        width < 700
          ? this.mobileSearchInput()?.nativeElement
          : width < 1100
            ? this.tabletSearchInput()?.nativeElement
            : undefined;
      input?.focus();
      input?.select();
    }, 0);
  }

  closeSearch(): void {
    if (this.searchOpen()) this.searchToggle.emit();
  }

  selectSearchResult(result: HeaderSearchResult): void {
    this.closeSearch();
    this.search.clearQuery();

    const activeElement = this.document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    this.searchResult.emit(result);
  }

  toggleWorkspaceMenu(): void {
    this.closeAccountMenu();
    this.workspaceMenuOpen.update((open) => !open);
  }

  closeWorkspaceMenu(): void {
    this.workspaceMenuOpen.set(false);
  }

  toggleAccountMenu(): void {
    this.workspaceMenuOpen.set(false);
    if (this.searchOpen()) this.closeSearch();
    if (!this.logoutDialogOpen()) {
      this.accountMenuOpen.update((open) => !open);
    }
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  requestLogout(): void {
    this.accountMenuOpen.set(false);
    this.logoutDialogOpen.set(true);
  }

  cancelLogout(): void {
    this.logoutDialogOpen.set(false);
  }

  confirmLogout(): void {
    this.logoutDialogOpen.set(false);
    this.signOut.emit();
  }

  selectWorkspace(workspace: SidePanelWorkspace): void {
    this.workspaceSelect.emit(workspace);
    this.closeWorkspaceMenu();
  }
}
