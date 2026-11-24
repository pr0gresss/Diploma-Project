import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

export interface CreateStudyNoteWorkspaceOption {
  id: string;
  name: string;
}

export interface CreateStudyNoteFileOption {
  id: string;
  workspaceId: string;
  name: string;
}

export interface CreateStudyNoteValue {
  title: string;
  workspaceId: string;
  materialId: string;
}

@Component({
  selector: 'app-create-study-note-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-study-note-dialog.component.html',
  styleUrl: './create-study-note-dialog.component.scss',
})
export class CreateStudyNoteDialogComponent {
  private readonly formBuilder = inject(FormBuilder);

  readonly saving = input(false);
  readonly errorMessage = input('');
  readonly workspaces = input<readonly CreateStudyNoteWorkspaceOption[]>([]);
  readonly files = input<readonly CreateStudyNoteFileOption[]>([]);
  readonly selectedWorkspaceId = input('');

  readonly confirm = output<CreateStudyNoteValue>();
  readonly cancel = output<void>();

  readonly submitted = signal(false);
  readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(80)]],
    workspaceId: ['', Validators.required],
    materialId: ['', Validators.required],
  });

  private readonly activeWorkspaceId = toSignal(
    this.form.controls.workspaceId.valueChanges,
    { initialValue: '' },
  );
  readonly availableFiles = computed(() =>
    this.files().filter((file) => file.workspaceId === this.activeWorkspaceId()),
  );

  constructor() {
    effect(() => {
      const workspaces = this.workspaces();
      if (!workspaces.length) return;

      const preferredId = this.selectedWorkspaceId();
      const workspaceId = workspaces.some((workspace) => workspace.id === preferredId)
        ? preferredId
        : workspaces[0].id;
      if (this.form.controls.workspaceId.value !== workspaceId) {
        this.form.controls.workspaceId.setValue(workspaceId);
      }
    });

    effect(() => {
      const files = this.availableFiles();
      const currentId = this.form.controls.materialId.value;
      if (files.length && !files.some((file) => file.id === currentId)) {
        this.form.controls.materialId.setValue(files[0].id);
      } else if (!files.length && currentId) {
        this.form.controls.materialId.setValue('');
      }
    });

    afterNextRender(() => this.titleInput().nativeElement.focus());
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.saving()) return;

    this.confirm.emit({
      title: this.form.controls.title.value.trim(),
      workspaceId: this.form.controls.workspaceId.value,
      materialId: this.form.controls.materialId.value,
    });
  }

  titleError(): string {
    const control = this.form.controls.title;
    if (!control.touched && !this.submitted()) return '';
    if (control.hasError('required') || control.hasError('pattern')) {
      return 'Enter a study note title.';
    }
    if (control.hasError('maxlength')) {
      return 'Use 80 characters or fewer.';
    }
    return '';
  }

  workspaceError(): string {
    const control = this.form.controls.workspaceId;
    if (!control.touched && !this.submitted()) return '';
    return control.hasError('required') ? 'Choose a workspace.' : '';
  }

  materialError(): string {
    const control = this.form.controls.materialId;
    if (!control.touched && !this.submitted()) return '';
    return control.hasError('required') ? 'Choose a source file.' : '';
  }
}
