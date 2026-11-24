import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { HeaderComponent } from '../components/header.component';
import { SidePanelComponent, SidePanelWorkspace } from '../components/side-panel.component';
import { AuthService } from '../services/auth.service';
import { PlatformState } from './platform-state.service';

@Component({
  selector: 'app-platform-template',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './platform-template.component.html',
  styleUrl: './platform-template.component.scss',
})
export class PlatformTemplateComponent {
  readonly state = inject(PlatformState);
  readonly auth = inject(AuthService);

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      if (this.state.loadingWorkspaces()) return;
      this.state.selectedWorkspace();
      this.syncSection(this.router.url);
    });

    this.state.loadWorkspaces();
    this.syncSection(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.syncSection(this.router.url));
  }

  openWorkspace(workspace: SidePanelWorkspace): void {
    this.state.selectWorkspace(workspace);
    void this.router.navigate(['/workspaces', workspace.id]);
  }

  signOut(): void {
    this.state.reset();
    this.auth.signOut();
    void this.router.navigate(['/login']);
  }

  private syncSection(url: string): void {
    const path = url.split('?')[0];

    const workspaceTab = /^\/workspaces\/([^/]+)\/(study-notes|quizzes)(?:\/|$)/.exec(path);
    if (workspaceTab) {
      this.state.setSection(workspaceTab[2] === 'study-notes' ? 'notes' : 'quizzes');
      this.state.selectWorkspaceById(workspaceTab[1]);
      return;
    }

    if (path.startsWith('/study-notes') || path === '/study-notes/') {
      this.state.setSection('notes');
      this.state.clearWorkspaceSelection();
      return;
    }

    if (/^\/quizzes\/[^/]+/.test(path)) {
      this.state.setSection('runner');
      return;
    }

    if (path.startsWith('/quizzes') || path === '/quizzes/') {
      this.state.setSection('quizzes');
      this.state.clearWorkspaceSelection();
      return;
    }

    this.state.setSection('workspace');
    if (path === '/workspaces' || path === '/workspaces/') {
      this.state.clearWorkspaceSelection();
    } else if (!/^\/workspaces\/[^/]+/.test(path)) {
      this.state.ensureWorkspaceSelection();
    }
  }
}
