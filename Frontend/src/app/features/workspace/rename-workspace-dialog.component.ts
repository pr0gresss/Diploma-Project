import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-rename-workspace-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rename-workspace-dialog.component.html',
  styleUrl: './rename-workspace-dialog.component.scss',
})
export class RenameWorkspaceDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);

  readonly currentName = input('');
  readonly saving = input(false);
  readonly error = input('');

  readonly confirm = output<string>();
  readonly cancel = output<void>();

  readonly submitted = signal(false);
  readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
  });

  constructor() {
    afterNextRender(() => {
      const input = this.titleInput().nativeElement;
      input.focus();
      input.select();
    });
  }

  ngOnInit(): void {
    this.form.controls.name.setValue(this.currentName());
  }

  submit(): void {
    this.submitted.set(true);

    if (this.form.invalid || this.saving()) {
      return;
    }

    this.confirm.emit(this.form.controls.name.value.trim());
  }

  nameError(): string {
    const control = this.form.controls.name;

    if (!control.touched && !this.submitted()) {
      return '';
    }
    if (control.hasError('required') || control.hasError('pattern')) {
      return 'Enter a workspace name.';
    }
    if (control.hasError('maxlength')) {
      return 'Use 80 characters or fewer.';
    }

    return '';
  }
}
