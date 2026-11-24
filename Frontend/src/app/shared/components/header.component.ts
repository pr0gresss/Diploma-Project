import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import type { SidePanelWorkspace } from '../components/side-panel.component';
import { IconComponent } from '../icon/icon.component';
import type { PlatformSection } from '../layout/platform-state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly section = input<PlatformSection>('workspace');
  readonly currentLabel = input('Workspace');
  readonly currentWorkspaceId = input('');
  readonly query = input('');
  readonly searchOpen = input(false);
  readonly userEmail = input('');
  readonly workspaces = input<readonly SidePanelWorkspace[]>([]);
  readonly selectedWorkspaceId = input<string | null>(null);

  readonly queryChange = output<string>();
  readonly searchToggle = output<void>();
  readonly menuToggle = output<void>();
  readonly workspaceSelect = output<SidePanelWorkspace>();
  readonly signOut = output<void>();

  readonly workspaceMenuOpen = signal(false);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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
      .subscribe(() => this.closeWorkspaceMenu());
  }

  onQueryInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  toggleWorkspaceMenu(): void {
    this.workspaceMenuOpen.update((open) => !open);
  }

  closeWorkspaceMenu(): void {
    this.workspaceMenuOpen.set(false);
  }

  selectWorkspace(workspace: SidePanelWorkspace): void {
    this.workspaceSelect.emit(workspace);
    this.closeWorkspaceMenu();
  }
}
