import { resourceSchemas } from './resource.schemas.js';
import { resourceExamples } from './resource.examples.js';
import {
  registerSchema,
  attemptInputSchema,
  pageSchema,
  quizInputSchema,
} from '../common/http/request.schemas.js';

describe('HTTP schemas and examples', () => {
  it.each(Object.keys(resourceSchemas) as Array<keyof typeof resourceSchemas>)(
    'validates the %s response example',
    (name) => {
      expect(
        resourceSchemas[name].safeParse(resourceExamples[name]).success,
      ).toBe(true);
    },
  );
  it('rejects client-controlled ownership and grading fields', () => {
    expect(
      registerSchema.safeParse({
        email: 'student@example.com',
        password: 'StrongPassword!2026',
        userId: 'other',
      }).success,
    ).toBe(false);
    expect(
      attemptInputSchema.safeParse({ answers: [], scorePercent: 100 }).success,
    ).toBe(false);
  });
  it('coerces pagination and validates nested quiz structure', () => {
    expect(pageSchema.parse({ limit: '10', offset: '2' })).toEqual({
      limit: 10,
      offset: 2,
    });
    expect(
      quizInputSchema.safeParse({
        questions: [{ prompt: 'Question?', options: [] }],
      }).success,
    ).toBe(false);
  });
});
