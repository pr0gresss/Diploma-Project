import { z } from 'zod';

export const uuidSchema = z.uuid();
const displayName = z.string().trim().min(1).max(255);
export const pageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().max(255).optional(),
});
export const attemptPageSchema = pageSchema.omit({ search: true });
export const materialPageSchema = pageSchema.extend({
  status: z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']).optional(),
});
export const registerSchema = z.strictObject({
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
});
export const signInSchema = registerSchema.extend({
  password: z.string().min(1).max(128),
});
export const workspaceInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});
export const renameSchema = z.strictObject({ displayName });
export const uploadFieldsSchema = z.strictObject({
  displayName: displayName.optional(),
});
export const guideInputSchema = z.strictObject({
  displayName: displayName.optional(),
  content: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= 5 * 1024 * 1024,
      'Content exceeds the 5 MiB limit',
    ),
});
export const guideContentSchema = guideInputSchema.omit({ displayName: true });
export const quizInputSchema = z.strictObject({
  displayName: displayName.optional(),
  questions: z
    .array(
      z.strictObject({
        questionType: z
          .enum(['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'])
          .optional(),
        prompt: z.string().trim().min(1).max(4000),
        explanation: z.string().trim().max(4000).nullable().optional(),
        options: z
          .array(
            z.strictObject({
              text: z.string().trim().min(1).max(1000),
              isCorrect: z.boolean(),
            }),
          )
          .min(2)
          .max(10),
      }),
    )
    .min(1)
    .max(100),
});
export const attemptInputSchema = z.strictObject({
  answers: z
    .array(
      z
        .strictObject({
          questionId: uuidSchema,
          selectedOptionId: uuidSchema
            .describe(
              'Legacy single-selection field. Prefer selectedOptionIds; do not supply both.',
            )
            .optional(),
          selectedOptionIds: z.array(uuidSchema).max(10).optional(),
        })
        .refine(
          (value) =>
            (value.selectedOptionId === undefined) !==
            (value.selectedOptionIds === undefined),
          'Supply selectedOptionIds or legacy selectedOptionId, not both',
        ),
    )
    .max(100),
});
export type ListQuery = z.infer<typeof pageSchema>;
export type MaterialQuery = z.infer<typeof materialPageSchema>;
export type RegisterBody = z.infer<typeof registerSchema>;
export type WorkspaceBody = z.infer<typeof workspaceInputSchema>;
export type RenameBody = z.infer<typeof renameSchema>;
export type UploadFields = z.infer<typeof uploadFieldsSchema>;
export type GuideBody = z.infer<typeof guideInputSchema>;
export type GuideContentBody = z.infer<typeof guideContentSchema>;
export type QuizBody = z.infer<typeof quizInputSchema>;
export type AttemptBody = z.infer<typeof attemptInputSchema>;
