import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconComponent } from '../icon/icon.component';
import { CreateWorkspaceDialogComponent } from './create-workspace-dialog.component';

export type SidePanelTab = 'files' | 'notes' | 'quizzes';
export type SidePanelNav = 'workspaces' | 'notes' | 'quizzes';

export interface SidePanelWorkspace {
  id: string;
  name: string;
  marker: string;
}

@Component({
  selector: 'app-side-panel',
  standalone: true,
  imports: [RouterLink, IconComponent, CreateWorkspaceDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './side-panel.component.html',
  styleUrl: './side-panel.component.scss',
})
export class SidePanelComponent {
  readonly workspaces = input<readonly SidePanelWorkspace[]>([]);
  readonly selectedWorkspaceId = input<string | null>(null);
  readonly activeNav = input<SidePanelNav>('workspaces');
  readonly activeTab = input<SidePanelTab>('files');
  readonly mobileMenuOpen = input(false);

  readonly createDialogOpen = signal(false);

  readonly workspaceSelect = output<SidePanelWorkspace>();
  readonly navSelect = output<SidePanelNav>();
  readonly tabSelect = output<SidePanelTab>();
  readonly createWorkspace = output<string>();
  readonly menuClose = output<void>();

  openCreateDialog(): void {
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    this.createDialogOpen.set(false);
  }

  confirmCreateWorkspace(title: string): void {
    this.createWorkspace.emit(title);
    this.closeCreateDialog();
  }
}
