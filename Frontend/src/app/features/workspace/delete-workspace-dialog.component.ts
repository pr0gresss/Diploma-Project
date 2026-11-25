import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-delete-workspace-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-workspace-dialog.component.html',
  styleUrl: './delete-workspace-dialog.component.scss',
})
export class DeleteWorkspaceDialogComponent {
  readonly workspaceName = input('');
  readonly deleting = input(false);
  readonly error = input('');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus());
  }
}
