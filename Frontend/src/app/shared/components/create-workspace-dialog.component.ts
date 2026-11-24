import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-create-workspace-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-workspace-dialog.component.html',
  styleUrl: './create-workspace-dialog.component.scss',
})
export class CreateWorkspaceDialogComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly confirm = output<string>();
  readonly cancel = output<void>();

  readonly submitted = signal(false);
  readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
  });

  constructor() {
    afterNextRender(() => this.titleInput().nativeElement.focus());
  }

  submit(): void {
    this.submitted.set(true);

    if (this.form.invalid) {
      return;
    }

    this.confirm.emit(this.form.controls.title.value.trim());
  }

  titleError(): string {
    const control = this.form.controls.title;

    if (!control.touched && !this.submitted()) {
      return '';
    }
    if (control.hasError('required') || control.hasError('pattern')) {
      return 'Enter a workspace title.';
    }
    if (control.hasError('maxlength')) {
      return 'Use 80 characters or fewer.';
    }

    return '';
  }
}
