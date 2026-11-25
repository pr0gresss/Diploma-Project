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
  selector: 'app-delete-quiz-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-quiz-dialog.component.html',
  styleUrl: './delete-quiz-dialog.component.scss',
})
export class DeleteQuizDialogComponent {
  readonly quizTitle = input('');
  readonly deleting = input(false);
  readonly error = input('');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus());
  }
}
