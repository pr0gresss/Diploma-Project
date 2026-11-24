import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuizDraftsService } from './quiz-drafts.service';
import { API_BASE_URL } from './api.config';
describe('QuizDraftsService',()=>{
 it('sends exact server draft methods, revisions and empty selections',()=>{
  TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),{provide:API_BASE_URL,useValue:'/api'}]});
  const service=TestBed.inject(QuizDraftsService), http=TestBed.inject(HttpTestingController);
  service.open('q').subscribe(); const open=http.expectOne('/api/quizzes/q/drafts'); expect(open.request.method).toBe('POST'); open.flush({});
  const body={revision:2,answers:[{questionId:'q1',selectedOptionIds:[]}],currentQuestionId:null};
  service.save('d',body).subscribe();const save=http.expectOne('/api/quiz-drafts/d');expect(save.request.method).toBe('PUT');expect(save.request.body).toEqual(body);save.flush({});
  service.get('d').subscribe();http.expectOne('/api/quiz-drafts/d').flush({});
  service.submit('d',3).subscribe();const submit=http.expectOne('/api/quiz-drafts/d/submit');expect(submit.request.body).toEqual({revision:3});submit.flush({});http.verify();
 });
});
