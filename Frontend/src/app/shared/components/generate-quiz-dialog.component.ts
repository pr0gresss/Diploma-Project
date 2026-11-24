import {
  afterNextRender,
  Component,
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

@Component({
  selector: 'app-generate-quiz-dialog',
  standalone: true,
  template: ` <dialog #dialog (cancel)="onCancel($event)" aria-labelledby="generate-title">
    <form (submit)="submit($event)">
      <h2 id="generate-title">Generate quiz</h2>
      <p>Select documents. A separate quiz will be generated for each document.</p>
      <fieldset [disabled]="busy()">
        <legend>Materials</legend>
        @for (material of materials(); track material.id) {
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
      @if (busy()) {
        <p role="status">Generating quiz {{ completedIds().length + 1 }}…</p>
      }
      <footer>
        <button type="button" [disabled]="busy()" (click)="close()">
          {{ completedIds().length ? 'Done' : 'Cancel' }}
        </button>
        <button type="submit" [disabled]="busy() || !pending().length || !validCount()">
          {{ busy() ? 'Generating…' : completedIds().length ? 'Retry remaining' : 'Generate quiz' }}
        </button>
      </footer>
    </form>
  </dialog>`,
  styles: [
    `
      dialog {
        width: min(560px, calc(100vw - 32px));
        max-height: 85vh;
        border: 1px solid var(--border, #ddd);
        border-radius: 16px;
        padding: 24px;
        background: var(--surface-raised, #fff);
        color: var(--ink, #222);
      }
      dialog::backdrop {
        background: #0006;
      }
      h2 {
        margin: 0 0 12px;
      }
      p {
        line-height: 1.5;
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
        min-height: 44px;
      }
      input[type='number'],
      select,
      button {
        min-height: 44px;
        border: 1px solid var(--border, #ccc);
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
        background: var(--brand, #486944);
        color: white;
      }
      button:disabled {
        opacity: 0.5;
      }
      small {
        color: var(--muted, #666);
      }
    `,
  ],
})
export class GenerateQuizDialogComponent {
  readonly materials = input.required<Material[]>();
  readonly initialSelection = input<string[]>([]);
  readonly cancel = output<void>();
  readonly generated = output<Quiz[]>();
  readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly quizzes = inject(QuizzesService);
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;
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
      this.selected.set(
        this.initialSelection().filter((id) =>
          this.materials().some((m) => m.id === id && m.processingStatus === 'READY'),
        ),
      );
      this.dialog().nativeElement.showModal();
    });
  }
  validCount() {
    return Number.isInteger(this.count()) && this.count() >= 1 && this.count() <= 50;
  }
  pending() {
    return this.materials().filter(
      (m) =>
        m.processingStatus === 'READY' &&
        this.selected().includes(m.id) &&
        !this.completedIds().includes(m.id),
    );
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
