import { z } from 'zod';

export const questionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'SELECT',
  'MULTI_SELECT',
]);
export const generateQuizSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(255).optional(),
  questionCount: z.number().int().min(1).max(50).default(10),
  questionTypes: z
    .array(questionTypeSchema)
    .min(1)
    .max(3)
    .default(['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'])
    .refine(
      (values) => new Set(values).size === values.length,
      'Question types must be distinct',
    ),
});
export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;

// Strict, all-required shape suitable for provider structured output. Business
// cardinality and requested counts/types are checked separately before publishing.
export const generatedQuizSchema = z.strictObject({
  displayName: z.string().min(1).max(255),
  questions: z
    .array(
      z.strictObject({
        questionType: questionTypeSchema,
        prompt: z.string().min(1).max(4000),
        explanation: z.string().max(4000).nullable(),
        options: z
          .array(
            z.strictObject({
              text: z.string().min(1).max(1000),
              isCorrect: z.boolean(),
            }),
          )
          .min(2)
          .max(10),
      }),
    )
    .min(1)
    .max(50),
});
