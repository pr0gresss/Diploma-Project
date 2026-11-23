import 'reflect-metadata';
process.env.PROCESSING_WORKER_ENABLED = 'false';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { WorkspacesService } from '../dist/modules/workspaces/workspaces.service.js';
import { ProcessingJobsService } from '../dist/modules/processing-jobs/processing-jobs.service.js';
import { configureHttp } from '../dist/common/http/configure-http.js';
import { CompletionsService } from '../dist/infrastructure/ai/completions.service.js';

// Isolate test uploads from real R2 buckets and other local objects.
const storageRoot = `.storage/http-smoke-${randomUUID()}`;
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_ROOT = storageRoot;
process.env.OPENAI_OAUTH_ENABLED = 'false';
process.env.LLM_MODEL = '';
process.env.LLM_API_KEY = '';
process.env.TIKA_URL = '';
const { AppModule } = await import('../dist/app.module.js');
const app = await NestFactory.create(AppModule, { logger: false });
configureHttp(app);
const prisma = app.get(PrismaService);
const users = [];
const workspaceIds = [];
try {
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function call(method, path, { token, body, status = 200 } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !(body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
    });
    const value = response.status === 204 ? undefined : await response.json();
    assert.equal(
      response.status,
      status,
      `${method} ${path}: ${JSON.stringify(value)}`,
    );
    return value;
  }
  await call('POST', '/auth/register', {
    body: { email: 'invalid', password: 'short' },
    status: 400,
  });
  await call('GET', '/workspaces', { status: 401 });
  const credentials = {
    email: `http-smoke-${randomUUID()}@example.com`,
    password: 'HttpSmokeTest!Password2026',
  };
  const registered = await call('POST', '/auth/register', {
    body: credentials,
    status: 201,
  });
  users.push(registered.user.id);
  const token = registered.accessToken;
  const strangerCredentials = {
    ...credentials,
    email: `http-smoke-${randomUUID()}@example.com`,
  };
  const stranger = await call('POST', '/auth/register', {
    body: strangerCredentials,
    status: 201,
  });
  users.push(stranger.user.id);
  await call('POST', '/auth/register', { body: credentials, status: 409 });
  await call('POST', '/auth/sign-in', {
    body: { ...credentials, password: 'wrong' },
    status: 401,
  });
  assert.equal(
    (await call('POST', '/auth/sign-in', { body: credentials })).user.id,
    registered.user.id,
  );
  assert.equal((await call('GET', '/me', { token })).id, registered.user.id);
  await call('POST', '/workspaces', {
    token,
    body: { name: 'Workspace', ownerUserId: stranger.user.id },
    status: 400,
  });
  await call('GET', '/workspaces?limit=0', { token, status: 400 });
  await call('GET', '/workspaces/not-a-uuid', { token, status: 400 });
  const workspace = await call('POST', '/workspaces', {
    token,
    body: { name: 'HTTP smoke' },
    status: 201,
  });
  workspaceIds.push({ userId: registered.user.id, id: workspace.id });
  assert.equal((await call('GET', '/workspaces', { token })).total, 1);
  await call('GET', `/workspaces/${workspace.id}`, { token });
  await call('PATCH', `/workspaces/${workspace.id}`, {
    token,
    body: { name: 'HTTP integration' },
  });
  await call('GET', `/workspaces/${workspace.id}`, {
    token: stranger.accessToken,
    status: 404,
  });
  const makeUpload = (bytes, name, type) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    form.append('displayName', 'Transactions');
    return form;
  };
  await call('POST', `/workspaces/${workspace.id}/materials`, {
    token,
    body: makeUpload('not a document', 'bad.txt', 'text/plain'),
    status: 415,
  });
  const material = await call('POST', `/workspaces/${workspace.id}/materials`, {
    token,
    body: makeUpload(
      '%PDF-1.7\n% Upload fixture\n%%EOF\n',
      'notes.pdf',
      'application/pdf',
    ),
    status: 201,
  });
  assert.equal(material.processingStatus, 'UPLOADED');
  await call('GET', `/workspaces/${workspace.id}/materials?status=UPLOADED`, {
    token,
  });
  await call('GET', `/materials/${material.id}`, { token });
  await call('PATCH', `/materials/${material.id}`, {
    token,
    body: { displayName: 'Transaction notes' },
  });
  await call('GET', `/materials/${material.id}/text`, { token, status: 404 });
  await call('GET', `/materials/${material.id}/jobs`, { token });
  await call('POST', `/materials/${material.id}/extraction/retry`, {
    token,
    status: 409,
  });
  await call('POST', `/materials/${material.id}/study-guides`, {
    token,
    body: { content: '# Guide' },
    status: 409,
  });
  const job = material.processingJobs[0];
  // Complete only this test's own job internally; worker mutations are not HTTP endpoints.
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
  await app
    .get(ProcessingJobsService)
    .completeExtraction(job.id, 'Transactions are atomic.');
  const text = await fetch(`${base}/materials/${material.id}/text`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(text.status, 200);
  assert.match(text.headers.get('content-type'), /^text\/plain/);
  assert.equal(await text.text(), 'Transactions are atomic.');
  const guide = await call('POST', `/materials/${material.id}/study-guides`, {
    token,
    body: { content: '# Transactions\n\nTransactions are atomic.' },
    status: 201,
  });
  await call('GET', `/materials/${material.id}/study-guides`, { token });
  assert.match(
    (await call('GET', `/study-guides/${guide.id}`, { token })).content,
    /Transactions/,
  );
  await call('PATCH', `/study-guides/${guide.id}`, {
    token,
    body: { displayName: 'Guide' },
  });
  await call('DELETE', `/study-guides/${guide.id}`, { token, status: 204 });
  const quiz = await call('POST', `/materials/${material.id}/quizzes`, {
    token,
    status: 201,
    body: {
      questions: [
        {
          questionType: 'SINGLE_CHOICE',
          prompt: 'Are transactions atomic?',
          options: [
            { text: 'Yes', isCorrect: true },
            { text: 'No', isCorrect: false },
          ],
        },
        {
          questionType: 'SELECT',
          prompt: 'Choose a transaction property',
          options: [
            { text: 'Atomicity', isCorrect: true },
            { text: 'Randomness', isCorrect: false },
          ],
        },
        {
          questionType: 'MULTI_SELECT',
          prompt: 'Select transaction properties',
          options: [
            { text: 'Atomicity', isCorrect: true },
            { text: 'Consistency', isCorrect: true },
            { text: 'Randomness', isCorrect: false },
          ],
        },
      ],
    },
  });
  await call('GET', `/materials/${material.id}/quizzes`, { token });
  await call('PATCH', `/quizzes/${quiz.id}`, {
    token,
    body: { displayName: 'Practice quiz' },
  });
  const taking = await call('GET', `/quizzes/${quiz.id}`, { token });
  assert.ok(!('explanation' in taking.questions[0]));
  assert.ok(
    taking.questions[0].options.every((option) => !('isCorrect' in option)),
  );
  const correctAnswers = taking.questions.map((question) => ({
    questionId: question.id,
    selectedOptionIds: question.options
      .slice(0, question.questionType === 'MULTI_SELECT' ? 2 : 1)
      .map((option) => option.id),
  }));
  await call('POST', `/quizzes/${quiz.id}/attempts`, {
    token,
    status: 400,
    body: {
      answers: correctAnswers.map((answer, index) =>
        index === 0
          ? {
              ...answer,
              selectedOptionIds: taking.questions[0].options.map(
                (option) => option.id,
              ),
            }
          : answer,
      ),
    },
  });
  const partial = await call('POST', `/quizzes/${quiz.id}/attempts`, {
    token,
    status: 201,
    body: {
      answers: correctAnswers.map((answer, index) =>
        index === 2
          ? {
              ...answer,
              selectedOptionIds: answer.selectedOptionIds.slice(0, 1),
            }
          : answer,
      ),
    },
  });
  assert.equal(partial.scorePercent, 66.67);
  const extra = await call('POST', `/quizzes/${quiz.id}/attempts`, {
    token,
    status: 201,
    body: {
      answers: correctAnswers.map((answer, index) =>
        index === 2
          ? {
              ...answer,
              selectedOptionIds: taking.questions[2].options.map(
                (option) => option.id,
              ),
            }
          : answer,
      ),
    },
  });
  assert.equal(extra.scorePercent, 66.67);
  const result = await call('POST', `/quizzes/${quiz.id}/attempts`, {
    token,
    status: 201,
    body: {
      answers: correctAnswers.map((answer) => ({
        ...answer,
        selectedOptionIds: [...answer.selectedOptionIds].reverse(),
      })),
    },
  });
  assert.equal(result.scorePercent, 100);
  assert.equal(result.answers[2].selectedOptionId, null);
  assert.equal(result.answers[2].selectedOptionIds.length, 2);
  const stored = await call('GET', `/attempts/${result.id}`, { token });
  assert.deepEqual(
    stored.answers[2].selectedOptionIds,
    result.answers[2].selectedOptionIds,
  );
  await call('POST', `/materials/${material.id}/quizzes/generate`, {
    token,
    status: 503,
    body: {
      questionCount: 3,
      questionTypes: ['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'],
    },
  });
  // Exercise durable generation publishing through HTTP without spending plan
  // allowance. Only the external model boundary is replaced in this test process.
  const completions = app.get(CompletionsService);
  const originalAssert = completions.assertAllowed;
  const originalComplete = completions.completeJson;
  try {
    completions.assertAllowed = (userId) =>
      assert.equal(userId, registered.user.id);
    completions.completeJson = async () => ({
      displayName: 'Generated mixed quiz',
      questions: [
        {
          questionType: 'SINGLE_CHOICE',
          prompt: 'Are transactions atomic?',
          explanation: null,
          options: [
            { text: 'Yes', isCorrect: true },
            { text: 'No', isCorrect: false },
          ],
        },
        {
          questionType: 'SELECT',
          prompt: 'Choose a transaction property',
          explanation: null,
          options: [
            { text: 'Atomicity', isCorrect: true },
            { text: 'Randomness', isCorrect: false },
          ],
        },
        {
          questionType: 'MULTI_SELECT',
          prompt: 'Select transaction properties',
          explanation: null,
          options: [
            { text: 'Atomicity', isCorrect: true },
            { text: 'Consistency', isCorrect: true },
            { text: 'Randomness', isCorrect: false },
          ],
        },
      ],
    });
    const generated = await call(
      'POST',
      `/materials/${material.id}/quizzes/generate`,
      {
        token,
        status: 201,
        body: {
          questionCount: 3,
          questionTypes: ['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'],
        },
      },
    );
    assert.equal(generated.questionCount, 3);
    const beforeFailure = await prisma.quiz.count({
      where: { materialId: material.id },
    });
    completions.completeJson = async () => ({
      displayName: 'Invalid',
      questions: [],
    });
    await call('POST', `/materials/${material.id}/quizzes/generate`, {
      token,
      status: 503,
      body: {
        questionCount: 3,
        questionTypes: ['SINGLE_CHOICE', 'SELECT', 'MULTI_SELECT'],
      },
    });
    assert.equal(
      await prisma.quiz.count({ where: { materialId: material.id } }),
      beforeFailure,
    );
    const generationJobs = (
      await call('GET', `/materials/${material.id}/jobs`, { token })
    ).filter((job) => job.jobType === 'GENERATE_QUIZ');
    assert.ok(generationJobs.some((job) => job.status === 'SUCCEEDED'));
    assert.ok(generationJobs.some((job) => job.status === 'FAILED'));
  } finally {
    completions.assertAllowed = originalAssert;
    completions.completeJson = originalComplete;
  }
  await call('GET', '/me/attempts', { token });
  await call('GET', `/quizzes/${quiz.id}/attempts`, { token });
  assert.equal(
    (await call('GET', '/me/progress', { token })).overview.totalAttempts,
    3,
  );
  assert.equal(
    (await call('GET', '/me/progress/overview', { token })).bestScorePercent,
    100,
  );
  await call('GET', `/attempts/${result.id}`, {
    token: stranger.accessToken,
    status: 404,
  });
  await call('DELETE', `/quizzes/${quiz.id}`, { token, status: 409 });
  await call('DELETE', `/materials/${material.id}`, { token, status: 409 });
  await call('DELETE', `/workspaces/${workspace.id}`, { token, status: 409 });
  // Remove only this test's assessment history to exercise eligible deletion routes.
  await prisma.quizAttempt.deleteMany({
    where: { userId: registered.user.id },
  });
  await call('DELETE', `/quizzes/${quiz.id}`, { token, status: 204 });
  await call('DELETE', `/materials/${material.id}`, { token, status: 204 });
  await call('DELETE', `/workspaces/${workspace.id}`, { token, status: 204 });
  workspaceIds.length = 0;
  console.log(
    'PASS: user-facing HTTP controllers, validation, multipart uploads, grading, progress, ownership and deletion constraints',
  );
} finally {
  try {
    for (const userId of users)
      await prisma.quizAttempt.deleteMany({ where: { userId } });
    for (const workspace of workspaceIds)
      await app.get(WorkspacesService).delete(workspace.userId, workspace.id);
    for (const id of users) await prisma.user.delete({ where: { id } });
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
}
