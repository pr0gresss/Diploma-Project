import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { QuizRunnerComponent, safeQuizReturn } from './quiz-runner.component';
import { QuizDraftsService } from '../../shared/services/quiz-drafts.service';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { AttemptsService } from '../../shared/services/attempts.service';
import { QuizDraft } from '../../shared/services/api.models';
const draft: QuizDraft = {id:'d',quizId:'q',answers:[],currentQuestionId:null,revision:0,createdAt:'',updatedAt:'',submittedAttemptId:null};
const quiz = {id:'q', displayName:'Quiz',materialId:'m',materialDisplayName:'Material',workspaceId:'w',questions:[
 {id:'q1',questionType:'SINGLE_CHOICE',prompt:'First',options:[{id:'o1',text:'One'},{id:'o2',text:'Two'}]},
 {id:'q2',questionType:'MULTI_SELECT',prompt:'Second',options:[{id:'o3',text:'Three'},{id:'o4',text:'Four'}]},
]};
describe('quiz runner draft flow', () => {
 let component: QuizRunnerComponent;
 let saves: ReturnType<typeof vi.fn>;
 let submits: ReturnType<typeof vi.fn>;
 let get: ReturnType<typeof vi.fn>;
 let result: ReturnType<typeof vi.fn>;
 let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
 async function setup(attemptId: string | null = null) {
  saves = vi.fn().mockImplementation((_id, body) => of({...draft,...body,revision:body.revision+1}));
  submits = vi.fn().mockReturnValue(of({id:'attempt',quizId:'q',answers:[],scorePercent:100}));
  get = vi.fn().mockReturnValue(of({...draft,revision:4}));
  query = new BehaviorSubject(convertToParamMap(attemptId ? {attemptId} : {}));
  result = vi.fn().mockReturnValue(of({quizId:'another',answers:[]}));
  await TestBed.configureTestingModule({imports:[QuizRunnerComponent],providers:[provideRouter([]),
   {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:query.value},queryParamMap:query.asObservable()}},
   {provide:QuizzesService,useValue:{getQuizForTaking:()=>of(quiz)}},
   {provide:QuizDraftsService,useValue:{open:()=>of(draft),save:saves,submit:submits,get}},
   {provide:AttemptsService,useValue:{getAttemptResult:result}},
  ]}).compileComponents();
  const fixture=TestBed.createComponent(QuizRunnerComponent); component=fixture.componentInstance;
  fixture.componentRef.setInput('quizId','q'); fixture.detectChanges();
  await new Promise(resolve=>setTimeout(resolve,0));
  return fixture;
 }
 function choose(id:string) { component.select(id,{target:{checked:true}} as unknown as Event); }
 it('retains UUID edits made while a save is pending and serializes revisions',async()=>{
  await setup(); const pending=new Subject<QuizDraft>(); saves.mockReturnValueOnce(pending);
  choose('o1'); const saving=component.save(); choose('o2');
  expect(saves).toHaveBeenCalledTimes(1);
  pending.next({...draft,revision:1}); pending.complete(); expect(await saving).toBe(true);
  expect(saves).toHaveBeenCalledTimes(2); expect(saves.mock.calls[1][1].revision).toBe(1);
  expect(saves.mock.calls[1][1].answers[0].selectedOptionIds).toEqual(['o2']);
  expect(component.answers()['q1']).toEqual(['o2']);
 });
 it('ignores a previous quiz save response after route reuse',async()=>{
  const fixture=await setup(); const pending=new Subject<QuizDraft>(); saves.mockReturnValueOnce(pending);
  choose('o1'); const saving=component.save();
  fixture.componentRef.setInput('quizId','other'); fixture.detectChanges();
  await new Promise(resolve=>setTimeout(resolve,0));
  choose('o2'); const current=component.answers();
  pending.next({...draft,revision:99}); pending.complete(); expect(await saving).toBe(false);
  expect(component.draft()?.revision).toBe(0); expect(component.answers()).toEqual(current); expect(component.saveState()).toBe('unsaved');
 });
 it('renders per-question types and keeps answers editable without grading',async()=>{
  const fixture=await setup(); choose('o1'); component.goTo(1); choose('o3'); choose('o4'); fixture.detectChanges();
  expect(component.mode()).toBe('multi'); expect(component.completedCount()).toBe(2);
  expect(fixture.nativeElement.querySelectorAll('input[type=checkbox]').length).toBe(2);
  expect(fixture.nativeElement.textContent).not.toContain('Correct answer');
  component.goTo(0); choose('o2'); expect(component.answers()['q1']).toEqual(['o2']);
 });
 it('flushes current answers before leaving',async()=>{
  await setup(); choose('o1'); expect(await component.canLeave()).toBe(true);
  expect(saves.mock.calls[0][1].answers[0].selectedOptionIds).toEqual(['o1']);
 });
 it('flushes before submit and guards duplicate clicks',async()=>{
  await setup(); choose('o1'); component.goTo(1); choose('o3');
  const pending=new Subject<QuizDraft>(); saves.mockReturnValueOnce(pending);
  const first=component.submit(); await component.submit(); expect(submits).not.toHaveBeenCalled();
  pending.next({...draft,revision:1}); pending.complete(); await first;
  expect(submits).toHaveBeenCalledTimes(1); expect(submits).toHaveBeenCalledWith('d',1);
 });
 it('requires explicit server reload after a revision conflict',async()=>{
  await setup(); choose('o1'); saves.mockReturnValueOnce(throwError(()=>({status:409})));
  expect(await component.save()).toBe(false); expect(component.conflict()).toBe(true);
  expect(await component.save()).toBe(false); expect(saves).toHaveBeenCalledTimes(1);
  await component.reloadDraft(); expect(component.conflict()).toBe(false); expect(component.answers()).toEqual({});
 });
 it('warns on browser unload for unsaved changes without sending a request',async()=>{
  await setup(); choose('o1'); const event=new Event('beforeunload',{cancelable:true}); window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true); expect(saves).not.toHaveBeenCalled();
 });
 it('flushes pending autosave on destroy',async()=>{
  const fixture=await setup(); choose('o1');
  fixture.destroy(); await new Promise(resolve=>setTimeout(resolve,0));
  expect(saves).toHaveBeenCalledTimes(1);
  expect(saves.mock.calls[0][1].answers[0].selectedOptionIds).toEqual(['o1']);
 });
 it('shows Submit on the last question and submits from the main action',async()=>{
  const fixture=await setup(); choose('o1'); component.goTo(1); choose('o3'); fixture.detectChanges();
  const nextButton=fixture.nativeElement.querySelector('.question-actions .button.primary') as HTMLButtonElement;
  expect(nextButton.textContent).toContain('Submit');
  nextButton.click(); await new Promise(resolve=>setTimeout(resolve,0));
  expect(submits).toHaveBeenCalledTimes(1);
 });
 it('rejects deep linked results belonging to another quiz',async()=>{
  await setup('attempt'); expect(component.attempt()).toBeNull(); expect(component.errorMessage()).toContain('could not be loaded');
 });
 it('reacts to query-only attempt navigation and back to the draft',async()=>{
  const fixture=await setup(); result.mockReturnValue(of({id:'a',quizId:'q',answers:[]}));
  query.next(convertToParamMap({attemptId:'a'})); fixture.detectChanges(); await new Promise(resolve=>setTimeout(resolve,0));
  expect(component.attempt()?.id).toBe('a');
  query.next(convertToParamMap({})); fixture.detectChanges(); await new Promise(resolve=>setTimeout(resolve,0));
  expect(component.attempt()).toBeNull(); expect(component.draft()?.id).toBe('d');
 });
 it('allowlists only quiz list return destinations',()=>{
  expect(safeQuizReturn('/workspaces/abc/quizzes?search=hello')).toBe('/workspaces/abc/quizzes?search=hello');
  for(const url of ['//example.com','https://example.com','/login','/quizzes/other','/quizzes?x=1#bad']) expect(safeQuizReturn(url)).toBe('/quizzes');
 });
});
