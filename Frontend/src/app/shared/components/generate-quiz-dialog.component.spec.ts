import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { GenerateQuizDialogComponent } from './generate-quiz-dialog.component';
import { QuizzesService } from '../services/quizzes.service';
import { Material, Quiz } from '../services/api.models';

describe('Quiz generation dialog', () => {
  const materials = [
    { id: 'a', displayName: 'First', processingStatus: 'READY' },
    { id: 'b', displayName: 'Second', processingStatus: 'READY' },
    { id: 'c', displayName: 'Processing', processingStatus: 'PROCESSING' },
  ] as Material[];
  async function setup() {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    const generateQuiz = vi.fn().mockReturnValue(of({ id: 'quiz' }));
    await TestBed.configureTestingModule({
      imports: [GenerateQuizDialogComponent],
      providers: [{ provide: QuizzesService, useValue: { generateQuiz } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(GenerateQuizDialogComponent);
    fixture.componentRef.setInput('materials', materials);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, generateQuiz };
  }
  it('requires explicit selection and excludes unprocessed documents', async () => {
    const { component, generateQuiz } = await setup();
    await component.submit(new Event('submit'));
    expect(generateQuiz).not.toHaveBeenCalled();
    component.selected.set(['b', 'c']);
    component.count.set(7);
    component.type.set('SELECT');
    await component.submit(new Event('submit'));
    expect(generateQuiz).toHaveBeenCalledExactlyOnceWith('b', {
      questionCount: 7,
      questionTypes: ['SELECT'],
    });
  });
  it('rejects invalid counts and prevents duplicate requests', async () => {
    const { component, generateQuiz } = await setup();
    component.selected.set(['a']);
    component.count.set(1.5);
    await component.submit(new Event('submit'));
    expect(generateQuiz).not.toHaveBeenCalled();
    component.count.set(10);
    const pending = new Subject<Quiz>();
    generateQuiz.mockReturnValue(pending);
    const first = component.submit(new Event('submit'));
    await component.submit(new Event('submit'));
    expect(generateQuiz).toHaveBeenCalledTimes(1);
    pending.next({ id: 'quiz' } as Quiz);
    pending.complete();
    await first;
  });
  it('retries only remaining documents after partial success', async () => {
    const { component, generateQuiz } = await setup();
    component.selected.set(['a', 'b']);
    generateQuiz
      .mockReturnValueOnce(of({ id: 'one' }))
      .mockReturnValueOnce(throwError(() => new Error('Unavailable')))
      .mockReturnValueOnce(of({ id: 'two' }));
    await component.submit(new Event('submit'));
    expect(component.completedIds()).toEqual(['a']);
    expect(component.error()).toContain('Completed quizzes are saved');
    await component.submit(new Event('submit'));
    expect(generateQuiz.mock.calls.map((call) => call[0])).toEqual(['a', 'b', 'b']);
  });
});
