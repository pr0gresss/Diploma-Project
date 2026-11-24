import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CreateWorkspaceDialogComponent } from '../../shared/components/create-workspace-dialog.component';
import { IconComponent } from '../../shared/icon/icon.component';
import { PlatformState } from '../../shared/layout/platform-state.service';

@Component({
  selector: 'app-workspaces-page',
  standalone: true,
  imports: [RouterLink, IconComponent, CreateWorkspaceDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspaces-page.component.html',
  styleUrl: './workspaces-page.component.scss',
})
export class WorkspacesPageComponent {
  readonly layout = inject(PlatformState);

  readonly createDialogOpen = signal(false);

  openCreateWorkspace(): void {
    this.createDialogOpen.set(true);
  }

  closeCreateWorkspace(): void {
    this.createDialogOpen.set(false);
  }

  confirmCreateWorkspace(title: string): void {
    this.layout.createWorkspace(title);
    this.closeCreateWorkspace();
  }
}
