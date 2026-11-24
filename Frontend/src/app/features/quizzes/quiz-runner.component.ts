import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { questionTypeToMode } from '../../shared/services/adapters';
import {
  AttemptAnswerResult,
  AttemptResult,
  QuizForTaking,
  QuestionType,
} from '../../shared/services/api.models';
import { AttemptsService } from '../../shared/services/attempts.service';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { IconComponent } from '../../shared/icon/icon.component';
import type { QuizMode } from '../../shared/models';
import { MODE_HELP, MODE_LABELS } from './quiz-ui.config';

interface RunnerQuestion {
  id: string;
  prompt: string;
  helper?: string;
  options: string[];
  optionIds: string[];
  questionType: QuestionType;
}

@Component({
  selector: 'app-quiz-runner',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quiz-runner.component.html',
  styleUrl: './quiz-runner.component.scss',
})
export class QuizRunnerComponent {
  readonly quizId = input.required<string>();

  private readonly quizzes = inject(QuizzesService);
  private readonly attempts = inject(AttemptsService);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private attemptSubscription?: Subscription;

  readonly quiz = signal<QuizForTaking | null>(null);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly submitting = signal(false);

  readonly questions = computed<RunnerQuestion[]>(() =>
    (this.quiz()?.questions ?? []).map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map((option) => option.text),
      optionIds: question.options.map((option) => option.id),
      questionType: question.questionType,
    })),
  );
  readonly total = computed(() => this.questions().length);
  readonly questionNumbers = computed(() => Array.from({ length: this.total() }, (_, i) => i));
  readonly question = computed(
    () => this.questions()[Math.min(this.index(), Math.max(this.total() - 1, 0))],
  );
  readonly mode = computed<QuizMode>(() =>
    questionTypeToMode(this.questions()[0]?.questionType),
  );
  readonly modeLabel = computed(() => MODE_LABELS[this.mode()]);
  readonly helpText = computed(() => MODE_HELP[this.mode()]);
  readonly title = computed(() => this.quiz()?.displayName ?? 'Quiz');
  readonly materialName = computed(() => this.quiz()?.materialDisplayName ?? 'your materials');

  readonly index = signal(0);
  readonly selection = signal<number[]>([]);
  readonly results = signal<Array<boolean | undefined>>([]);
  readonly responses = signal<Array<number[] | null>>([]);
  readonly checked = signal(false);
  readonly finished = signal(false);
  readonly attempt = signal<AttemptResult | null>(null);

  readonly correct = computed(() => {
    const question = this.question();
    return question ? (this.feedbackFor(question)?.isCorrect ?? false) : false;
  });
  readonly completedCount = computed(() => this.results().filter((value) => value !== undefined).length);
  readonly score = computed(() => this.attempt()?.correctAnswers ?? 0);
  readonly progress = computed(() =>
    this.total() ? Math.round((this.completedCount() / this.total()) * 100) : 0,
  );
  readonly primaryLabel = computed(() =>
    !this.checked()
      ? 'Check answer'
      : this.index() >= this.total() - 1
        ? 'Finish'
        : 'Next question',
  );

  constructor() {
    effect(() => {
      const quizId = this.quizId();
      this.loadSubscription?.unsubscribe();
      this.loading.set(true);
      this.errorMessage.set(null);
      this.loadSubscription = this.quizzes
        .getQuizForTaking(quizId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (quiz) => {
            this.quiz.set(quiz);
            this.reset();
            this.loading.set(false);
          },
          error: () => {
            this.quiz.set(null);
            this.errorMessage.set('This quiz could not be loaded.');
            this.loading.set(false);
          },
        });
    });
  }

  reset(): void {
    const count = this.questions().length;
    this.results.set(Array.from({ length: count }, () => undefined));
    this.responses.set(Array.from({ length: count }, () => null));
    this.index.set(0);
    this.selection.set([]);
    this.checked.set(false);
    this.finished.set(false);
    this.attempt.set(null);
    this.errorMessage.set(null);
  }

  isAnswered(index: number): boolean {
    return this.results()[index] !== undefined;
  }

  feedbackFor(question: RunnerQuestion): AttemptAnswerResult | undefined {
    return this.attempt()?.answers.find((answer) => answer.questionId === question.id);
  }

  isCorrectOption(index: number): boolean {
    return this.feedbackFor(this.question())?.correctOptionIds.includes(this.question().optionIds[index]) ?? false;
  }

  correctAnswerText(question: RunnerQuestion): string {
    return this.feedbackFor(question)?.correctOptionTexts.join(', ') ?? 'Available with your result';
  }

  onOptionChange(option: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (this.mode() === 'multi') {
      const next = new Set(this.selection());
      if (input.checked) {
        next.add(option);
      } else {
        next.delete(option);
      }
      this.selection.set([...next].sort((a, b) => a - b));
      return;
    }
    if (input.checked) {
      this.selection.set([option]);
    }
  }

  onDropdown(event: Event): void {
    this.selection.set([Number((event.target as HTMLSelectElement).value)]);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.checked()) {
      this.advance();
    } else {
      this.check();
    }
  }

  previous(): void {
    if (this.index() > 0) {
      this.persistSelection();
      this.index.update((value) => value - 1);
      this.loadQuestion();
    }
  }

  goTo(index: number): void {
    if (index === this.index() || this.finished()) {
      return;
    }
    this.persistSelection();
    this.index.set(index);
    this.loadQuestion();
  }

  private check(): void {
    if (this.checked() || !this.selection().length || !this.question()) {
      return;
    }
    const index = this.index();
    this.checked.set(true);
    this.results.update((results) =>
      results.map((value, i) => (i === index ? value ?? true : value)),
    );
    this.responses.update((responses) =>
      responses.map((value, i) => (i === index ? [...this.selection()] : value)),
    );
  }

  private advance(): void {
    if (this.index() < this.total() - 1) {
      this.persistSelection();
      this.index.update((value) => value + 1);
      this.loadQuestion();
    } else {
      this.persistSelection();
      this.submit();
    }
  }

  private submit(): void {
    const quizId = this.quizId();
    if (this.responses().some((answer) => !answer?.length)) {
      this.errorMessage.set('Answer every question before finishing.');
      return;
    }

    this.attemptSubscription?.unsubscribe();
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.attemptSubscription = this.attempts
      .submitQuizAttempt(quizId, {
        answers: this.questions().map((question, index) => ({
          questionId: question.id,
          selectedOptionIds: (this.responses()[index] ?? []).map(
            (optionIndex) => question.optionIds[optionIndex],
          ),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (attempt) => {
          this.attempt.set(attempt);
          this.results.set(attempt.answers.map((answer) => answer.isCorrect));
          this.finished.set(true);
          this.submitting.set(false);
        },
        error: () => {
          this.errorMessage.set('Your attempt could not be submitted. Please try again.');
          this.submitting.set(false);
        },
      });
  }

  private persistSelection(): void {
    this.responses.update((responses) =>
      responses.map((value, i) => (i === this.index() ? [...this.selection()] : value)),
    );
  }

  private loadQuestion(): void {
    const index = this.index();
    const stored = this.responses()[index];
    this.selection.set(stored ? [...stored] : []);
    this.checked.set(this.isAnswered(index));
  }
}
