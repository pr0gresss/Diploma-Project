// Run after `npm run build`. Creates and removes its own disposable test account.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
import { UsersService } from '../dist/modules/users/users.service.js';
import { WorkspacesService } from '../dist/modules/workspaces/workspaces.service.js';
import { MaterialsService } from '../dist/modules/materials/materials.service.js';
import { ProcessingJobsService } from '../dist/modules/processing-jobs/processing-jobs.service.js';
import { StudyGuidesService } from '../dist/modules/study-guides/study-guides.service.js';
import { QuizzesService } from '../dist/modules/quizzes/quizzes.service.js';
import { AttemptsService } from '../dist/modules/attempts/attempts.service.js';
import { ProgressService } from '../dist/modules/progress/progress.service.js';

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
const prisma = app.get(PrismaService);
const workspaces = app.get(WorkspacesService);
const materials = app.get(MaterialsService);
const jobs = app.get(ProcessingJobsService);
const guides = app.get(StudyGuidesService);
const quizzes = app.get(QuizzesService);
const attempts = app.get(AttemptsService);
let userId;
let workspaceId;
try {
  const password = 'SmokeTest!Password2026';
  const email = `service-smoke-${randomUUID()}@example.com`;
  const session = await app.get(AuthService).register({ email, password });
  userId = session.user.id;
  assert.ok(session.accessToken);
  assert.equal(
    (await app.get(AuthService).signIn({ email, password })).user.id,
    userId,
  );
  assert.equal((await app.get(UsersService).getProfile(userId)).email, email);

  const workspace = await workspaces.create(userId, {
    name: 'Service smoke test',
  });
  workspaceId = workspace.id;
  await workspaces.rename(userId, workspaceId, { name: 'Renamed smoke test' });
  const buffer = Buffer.from(
    '%PDF-1.7\n% Service test upload fixture\n%%EOF\n',
  );
  const material = await materials.upload(userId, workspaceId, {
    file: {
      buffer,
      size: buffer.length,
      originalname: 'fixture.pdf',
      mimetype: 'application/pdf',
    },
  });
  assert.equal(material.processingStatus, 'UPLOADED');
  // Do not claim the global queue: seeded jobs and other users' work must stay untouched.
  const job = material.processingJobs.find(
    (entry) => entry.jobType === 'EXTRACT_TEXT',
  );
  assert.ok(job);
  await prisma.$transaction([
    prisma.processingJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    }),
    prisma.material.update({
      where: { id: material.id },
      data: { processingStatus: 'PROCESSING' },
    }),
  ]);
  await jobs.completeExtraction(job.id, 'A database transaction is atomic.');
  assert.equal(
    await materials.readExtractedText(userId, material.id),
    'A database transaction is atomic.',
  );
  await assert.rejects(materials.retryExtraction(userId, material.id), {
    code: 'conflict',
  });
  const guide = await guides.create(userId, material.id, {
    content: '# Transactions\n\nTransactions are atomic.',
  });
  assert.match((await guides.get(userId, guide.id)).content, /Transactions/);
  await guides.rename(userId, guide.id, { displayName: 'Transactions guide' });
  const quiz = await quizzes.create(userId, material.id, {
    questions: [
      {
        prompt: 'Are transactions atomic?',
        explanation: 'All operations commit together or roll back.',
        options: [
          { text: 'Yes', isCorrect: true },
          { text: 'No', isCorrect: false },
        ],
      },
    ],
  });
  const taking = await quizzes.getForTaking(userId, quiz.id);
  assert.ok(!('explanation' in taking.questions[0]));
  assert.ok(
    taking.questions[0].options.every((option) => !('isCorrect' in option)),
  );
  const question = taking.questions[0];
  const result = await attempts.submit(userId, quiz.id, {
    answers: [
      { questionId: question.id, selectedOptionId: question.options[0].id },
    ],
  });
  assert.equal(result.scorePercent, 100);
  assert.equal((await attempts.getResult(userId, result.id)).correctAnswers, 1);
  assert.equal((await attempts.listForQuiz(userId, quiz.id)).total, 1);
  const report = await app.get(ProgressService).getReport(userId);
  assert.equal(report.overview.totalAttempts, 1);
  assert.equal(report.items[0].latestScorePercent, 100);
  const stranger = randomUUID();
  for (const operation of [
    () => workspaces.get(stranger, workspaceId),
    () => materials.get(stranger, material.id),
    () => guides.get(stranger, guide.id),
    () => quizzes.getForTaking(stranger, quiz.id),
    () => attempts.getResult(stranger, result.id),
  ]) {
    await assert.rejects(operation(), { code: 'not_found' });
  }
  await assert.rejects(quizzes.delete(userId, quiz.id), { code: 'conflict' });
  await assert.rejects(workspaces.delete(userId, workspaceId), {
    code: 'conflict',
  });
  console.log(
    'PASS: auth, users, workspaces, uploads, extraction completion, guides, quizzes, grading, progress, ownership and history protection',
  );
} finally {
  try {
    if (userId) {
      // Only this run's disposable account and its test history are removed.
      await prisma.quizAttempt.deleteMany({ where: { userId } });
      if (workspaceId) await workspaces.delete(userId, workspaceId);
      await prisma.user.delete({ where: { id: userId } });
    }
  } finally {
    await app.close();
  }
}
