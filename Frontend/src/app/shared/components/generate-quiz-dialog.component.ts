import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Material, QuestionType, Quiz } from '../services/api.models';
import { QuizzesService } from '../services/quizzes.service';
import { LoaderComponent } from './loader.component';

export interface GenerateQuizWorkspace {
  id: string;
  name: string;
}

@Component({
  selector: 'app-generate-quiz-dialog',
  standalone: true,
  imports: [LoaderComponent],
  template: ` <dialog #dialog (cancel)="onCancel($event)" aria-labelledby="generate-title">
    <h2 id="generate-title">Generate quiz</h2>
    @if (busy()) {
      <div class="generating">
        <app-loader label="Generating quiz" [compact]="true" />
      </div>
    } @else {
      <form (submit)="submit($event)">
        <p>Select documents. A separate quiz will be generated for each document.</p>
        <fieldset>
          <legend>Materials</legend>
          <label>
            Workspace
            <select [value]="selectedWorkspaceId()" (change)="onWorkspaceChange($event)">
              @for (workspace of workspaceOptions(); track workspace.id) {
                <option [value]="workspace.id">{{ workspace.name }}</option>
              }
            </select>
          </label>
          @for (material of visibleMaterials(); track material.id) {
            <label class="material"
              ><input
                type="checkbox"
                [checked]="selected().includes(material.id)"
                [disabled]="
                  material.processingStatus !== 'READY' || completedIds().includes(material.id)
                "
                (change)="toggle(material.id, $event)"
              />
              {{ material.displayName }}
              @if (material.processingStatus !== 'READY') {
                <small> — {{ material.processingStatus }}</small>
              }
              @if (completedIds().includes(material.id)) {
                <small> — generated</small>
              }
            </label>
          } @empty {
            <p>No materials available. Upload a document first.</p>
          }
          <label
            >Question type
            <select [value]="type()" (change)="type.set($any($event.target).value)">
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="SELECT">Dropdown</option>
              <option value="MULTI_SELECT">Multi select</option>
              <option value="mixed">Mixed types</option>
            </select>
          </label>
          <label
            >Number of questions per quiz
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              required
              [value]="count()"
              (input)="count.set(+$any($event.target).value)"
            />
          </label>
        </fieldset>
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        <footer>
          <button type="button" (click)="close()">
            {{ completedIds().length ? 'Done' : 'Cancel' }}
          </button>
          <button type="submit" [disabled]="!pending().length || !validCount()">
            {{ completedIds().length ? 'Retry remaining' : 'Generate quiz' }}
          </button>
        </footer>
      </form>
    }
  </dialog>`,
  styles: [
    `
      dialog {
        width: min(560px, calc(100vw - 32px));
        max-height: 85vh;
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        background: var(--surface-raised);
        color: var(--ink);
      }
      dialog::backdrop {
        background: var(--scrim-dark);
      }
      h2 {
        margin: 0 0 12px;
      }
      p {
        line-height: 1.5;
      }
      .generating {
        min-height: 220px;
        display: grid;
        place-items: center;
      }
      fieldset {
        border: 0;
        padding: 0;
        margin: 20px 0;
        display: grid;
        gap: 14px;
      }
      label {
        display: grid;
        gap: 7px;
      }
      .material {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        cursor: pointer;
      }
      .material input[type='checkbox'] {
        appearance: none;
        width: 18px;
        height: 18px;
        flex: 0 0 18px;
        margin: 0;
        border: 1px solid var(--border-strong);
        border-radius: 4px;
        background: var(--surface);
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .material input[type='checkbox']::before {
        content: '';
        width: 5px;
        height: 9px;
        border: solid var(--on-dark);
        border-width: 0 2px 2px 0;
        transform: rotate(45deg) translateY(-1px);
        opacity: 0;
      }
      .material input[type='checkbox']:checked {
        border-color: var(--brand);
        background: var(--brand);
      }
      .material input[type='checkbox']:checked::before {
        opacity: 1;
      }
      .material input[type='checkbox']:focus-visible {
        outline: 2px solid var(--brand);
        outline-offset: 2px;
      }
      .material input[type='checkbox']:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }
      input[type='number'],
      select,
      button {
        min-height: 44px;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px 12px;
        font: inherit;
      }
      footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      button[type='submit'] {
        background: var(--brand);
        color: var(--on-dark);
      }
      button:disabled {
        opacity: 0.5;
      }
      small {
        color: var(--muted);
      }
    `,
  ],
})
export class GenerateQuizDialogComponent {
  readonly materials = input.required<Material[]>();
  readonly workspaces = input<GenerateQuizWorkspace[]>([]);
  readonly initialWorkspaceId = input('');
  readonly initialSelection = input<string[]>([]);
  readonly cancel = output<void>();
  readonly generated = output<Quiz[]>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly quizzes = inject(QuizzesService);
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;
  readonly selectedWorkspaceId = signal('');
  readonly workspaceOptions = computed(() => {
    const names = new Map(this.workspaces().map((workspace) => [workspace.id, workspace.name]));
    const ids = new Set(
      this.materials()
        .map((material) => material.workspaceId)
        .filter((id): id is string => !!id),
    );
    const initial = this.initialWorkspaceId();
    if (initial) ids.add(initial);

    return [
      { id: '', name: 'All workspaces' },
      ...[...ids].map((id) => ({
        id,
        name: names.get(id) ?? `Workspace ${id.slice(0, 8)}`,
      })),
    ];
  });
  readonly visibleMaterials = computed(() => {
    const workspaceId = this.selectedWorkspaceId();
    return workspaceId
      ? this.materials().filter((material) => material.workspaceId === workspaceId)
      : this.materials();
  });
  readonly selected = signal<string[]>([]);
  readonly completedIds = signal<string[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly type = signal<QuestionType | 'mixed'>('SINGLE_CHOICE');
  readonly count = signal(10);
  private results: Quiz[] = [];
  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
    afterNextRender(() => {
      this.selectedWorkspaceId.set(this.initialWorkspaceId());
      this.selected.set(
        this.initialSelection().filter((id) =>
          this.visibleMaterials().some((m) => m.id === id && m.processingStatus === 'READY'),
        ),
      );
      this.dialog().nativeElement.showModal();
    });
  }
  validCount() {
    return Number.isInteger(this.count()) && this.count() >= 1 && this.count() <= 50;
  }
  pending() {
    return this.visibleMaterials().filter(
      (m) =>
        m.processingStatus === 'READY' &&
        this.selected().includes(m.id) &&
        !this.completedIds().includes(m.id),
    );
  }
  onWorkspaceChange(event: Event): void {
    this.selectedWorkspaceId.set((event.target as HTMLSelectElement).value);
    const visibleIds = new Set(this.visibleMaterials().map((material) => material.id));
    this.selected.update((ids) => ids.filter((id) => visibleIds.has(id)));
  }
  toggle(id: string, event: Event) {
    this.selected.update((ids) =>
      (event.target as HTMLInputElement).checked
        ? [...new Set([...ids, id])]
        : ids.filter((i) => i !== id),
    );
  }
  onCancel(event: Event) {
    event.preventDefault();
    if (!this.busy()) this.close();
  }
  close() {
    if (!this.busy()) {
      if (this.results.length) this.generated.emit(this.results);
      else this.cancel.emit();
    }
  }
  async submit(event: Event) {
    event.preventDefault();
    if (this.busy() || !this.validCount() || !this.pending().length) return;
    const pending = this.pending();
    const questionCount = this.count();
    const questionTypes: QuestionType[] =
      this.type() === 'mixed'
        ? ['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT']
        : [this.type() as QuestionType];
    this.busy.set(true);
    this.error.set('');
    try {
      for (const material of pending) {
        if (this.destroyed) return;
        const quiz = await firstValueFrom(
          this.quizzes
            .generateQuiz(material.id, { questionCount, questionTypes })
            .pipe(takeUntilDestroyed(this.destroyRef)),
        );
        this.results.push(quiz);
        this.completedIds.update((ids) => [...ids, material.id]);
      }
      if (!this.destroyed) this.generated.emit(this.results);
    } catch (error) {
      if (this.destroyed) return;
      const message =
        error instanceof HttpErrorResponse &&
        error.status === 400 &&
        typeof error.error?.message === 'string'
          ? error.error.message
          : 'Could not generate a quiz. Please try again.';
      this.error.set(
        message +
          (this.results.length
            ? ' Completed quizzes are saved; retry the remaining documents.'
            : ''),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
