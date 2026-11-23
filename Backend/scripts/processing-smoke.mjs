// Real PostgreSQL concurrency checks in a disposable, private schema.
import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { ProcessingJobsRepository } from '../dist/modules/processing-jobs/processing-jobs.repository.js';
import { MaterialsRepository } from '../dist/modules/materials/materials.repository.js';
import { WorkspacesRepository } from '../dist/modules/workspaces/workspaces.repository.js';

const schema = `processing_smoke_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^processing_smoke_[a-f0-9]{32}$/);
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
await admin.connect();
let prisma;
try {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  await admin.query(`SET search_path TO "${schema}", public`);
  // Only isolated DDL: do not run role setup or migrate the application's schema.
  const initial = await readFile(
    new URL(
      '../prisma/migrations/20261114121500_init/migration.sql',
      import.meta.url,
    ),
    'utf8',
  );
  await admin.query(
    initial.replace('CREATE SCHEMA IF NOT EXISTS "public";', ''),
  );
  await admin.query('ALTER TABLE materials ADD COLUMN extracted_text TEXT');
  const connection = new URL(process.env.DATABASE_URL);
  connection.searchParams.set('options', `-c search_path=${schema},public`);
  prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: connection.toString() },
      { schema },
    ),
  });
  const jobs = new ProcessingJobsRepository(prisma);
  const materials = new MaterialsRepository(prisma);
  const workspaces = new WorkspacesRepository(prisma);
  const user = await prisma.user.create({
    data: { email: 'processing-test@example.com', passwordHash: 'test-only' },
  });
  const workspace = await prisma.workspace.create({
    data: { ownerUserId: user.id, name: 'Isolated processing test' },
  });
  async function upload() {
    const id = randomUUID();
    return prisma.material.create({
      data: {
        id,
        workspaceId: workspace.id,
        originalFilename: 'fixture.pdf',
        displayName: 'Fixture',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storageKey: `materials/${id}/original.pdf`,
        processingJobs: { create: { jobType: 'EXTRACT_TEXT' } },
      },
    });
  }
  const material = await upload();
  const claims = await Promise.all([
    jobs.claimNextQueued(),
    jobs.claimNextQueued(),
  ]);
  assert.equal(
    claims.filter(Boolean).length,
    1,
    'Concurrent workers must not claim the same job',
  );
  const claimed = claims.find(Boolean);
  assert.equal(claimed.materialId, material.id);
  await assert.rejects(materials.delete(material.id), { code: 'conflict' });
  await assert.rejects(workspaces.delete(workspace.id), { code: 'conflict' });

  const old = new Date(Date.now() - 16 * 60000);
  await prisma.processingJob.update({
    where: { id: claimed.id },
    data: { startedAt: old },
  });
  const quizJob = await prisma.processingJob.create({
    data: {
      materialId: material.id,
      jobType: 'GENERATE_QUIZ',
      status: 'RUNNING',
      startedAt: old,
    },
  });
  assert.equal(await jobs.recoverStaleJobs(), 2);
  assert.equal(
    (await prisma.material.findUniqueOrThrow({ where: { id: material.id } }))
      .processingStatus,
    'FAILED',
  );
  assert.equal(
    (
      await prisma.processingJob.findUniqueOrThrow({
        where: { id: quizJob.id },
      })
    ).status,
    'FAILED',
  );
  await jobs.createExtractionJob(material.id);
  assert.equal((await jobs.claimNextQueued()).materialId, material.id);
  const active = await prisma.processingJob.findFirstOrThrow({
    where: { materialId: material.id, status: 'RUNNING' },
  });
  assert.equal(
    await jobs.recoverStaleJobs(),
    0,
    'Recovery must preserve fresh work',
  );
  await jobs.failExtraction(active.id, material.id, 'Test finished');
  assert.deepEqual(await materials.delete(material.id), [material.storageKey]);

  const queued = await upload();
  // Keep a material locked on another connection; polling must skip rather than block.
  await admin.query('BEGIN');
  try {
    await admin.query('SELECT id FROM materials WHERE id = $1 FOR UPDATE', [
      queued.id,
    ]);
    assert.equal(await jobs.claimNextQueued(), null);
  } finally {
    await admin.query('ROLLBACK');
  }
  assert.deepEqual(await workspaces.delete(workspace.id), [queued.storageKey]);
  assert.equal(await prisma.processingJob.count(), 0);
  console.log(
    'PASS: concurrent queue claims, locked-material skipping, interrupted job recovery, retry, active-job deletion protection and queued-tree cleanup',
  );
} finally {
  await prisma?.$disconnect();
  // The name is generated and validated above; only this test's schema is removed.
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
}
