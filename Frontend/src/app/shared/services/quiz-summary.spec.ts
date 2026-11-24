import { toQuizSummary } from './adapters';
import { Quiz } from './api.models';
const quiz: Quiz = {id:'q',materialId:'m',displayName:'Quiz',questionCount:2,createdAt:'',updatedAt:''};
describe('quiz summary status',()=>{
 it('marks a zero-score submitted quiz completed',()=>{
  const summary=toQuizSummary({...quiz,attemptCount:1,latestAttemptId:'a',latestScorePercent:0});
  expect(summary.status).toBe('Completed'); expect(summary.latestAttemptId).toBe('a'); expect(summary.meta).toContain('0%');
 });
 it('prefers an active draft over previous completion',()=>{
  const summary=toQuizSummary({...quiz,attemptCount:1,activeDraft:{id:'d',answeredCount:1,totalQuestions:2,updatedAt:''}});
  expect(summary.status).toBe('In progress');expect(summary.answeredCount).toBe(1);
 });
 it('marks a quiz without attempts or drafts not started',()=>expect(toQuizSummary(quiz).status).toBe('Not started'));
});
