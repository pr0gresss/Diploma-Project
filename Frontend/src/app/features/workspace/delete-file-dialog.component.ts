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
  selector: 'app-delete-file-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-file-dialog.component.html',
  styleUrl: './delete-file-dialog.component.scss',
})
export class DeleteFileDialogComponent {
  readonly fileName = input('');
  readonly deleting = input(false);
  readonly error = input('');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus());
  }
}
