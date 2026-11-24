import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlatformState } from '../layout/platform-state.service';

@Component({
  selector: 'app-workspace-tabs',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-tabs.component.html',
  styleUrl: './workspace-tabs.component.scss',
})
export class WorkspaceTabsComponent {
  readonly layout = inject(PlatformState);

  readonly workspaceId = input('');
  readonly filesCount = input(0);
  readonly notesCount = input(0);
  readonly quizzesCount = input(0);

  readonly filesLink = computed(() => {
    const workspaceId = this.workspaceId() || this.layout.selectedWorkspace().id;
    return workspaceId ? ['/workspaces', workspaceId] : ['/workspaces'];
  });

  readonly notesLink = computed(() => {
    const workspaceId = this.workspaceId();
    return workspaceId ? ['/workspaces', workspaceId, 'study-notes'] : ['/study-notes'];
  });

  readonly quizzesLink = computed(() => {
    const workspaceId = this.workspaceId();
    return workspaceId ? ['/workspaces', workspaceId, 'quizzes'] : ['/quizzes'];
  });
}
