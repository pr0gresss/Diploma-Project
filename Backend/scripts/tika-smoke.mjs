// Live Tika + PostgreSQL + isolated local storage. Never claims other users' jobs.
import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { crc32 } from 'node:zlib';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { AuthService } from '../dist/modules/auth/auth.service.js';
import { WorkspacesService } from '../dist/modules/workspaces/workspaces.service.js';
import { MaterialsService } from '../dist/modules/materials/materials.service.js';
import { ProcessingJobsService } from '../dist/modules/processing-jobs/processing-jobs.service.js';
import { ExtractionWorker } from '../dist/modules/processing-jobs/extraction.worker.js';
import { OBJECT_STORAGE } from '../dist/infrastructure/storage/object-storage.interface.js';

// A self-contained ZIP with CRCs and a central directory, containing a real DOCX.
function docx(text) {
  const parts = {
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  };
  const local = [],
    central = [];
  let offset = 0;
  for (const [path, value] of Object.entries(parts)) {
    const name = Buffer.from(path),
      data = Buffer.from(value);
    const header = Buffer.alloc(30),
      directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(data.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    header.copy(directory, 8, 6, 28);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, data);
    central.push(directory, name);
    offset += header.length + name.length + data.length;
  }
  const end = Buffer.alloc(22),
    index = Buffer.concat(central);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(3, 8);
  end.writeUInt16LE(3, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}

function pdf(text) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(value));
    value += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(value);
  value += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}

const tikaUrl = process.env.TIKA_URL || 'http://127.0.0.1:9998';
process.env.TIKA_URL = ''; // Disable background polling; only this test's jobs run.
const useR2 = process.argv.includes('--r2');
if (useR2)
  assert.equal(
    process.env.STORAGE_DRIVER,
    's3',
    '--r2 requires STORAGE_DRIVER=s3',
  );
else process.env.STORAGE_DRIVER = 'local';
const storageRoot = `.storage/tika-smoke-${randomUUID()}`;
if (!useR2) process.env.STORAGE_ROOT = storageRoot;
process.env.OPENAI_OAUTH_ENABLED = 'false';
const { AppModule } = await import('../dist/app.module.js');
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
const prisma = app.get(PrismaService),
  materials = app.get(MaterialsService);
const jobs = app.get(ProcessingJobsService);
let userId, workspaceId;
try {
  const version = await fetch(`${tikaUrl}/version`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(version.ok);
  console.log((await version.text()).trim());
  const session = await app.get(AuthService).register({
    email: `tika-smoke-${randomUUID()}@example.com`,
    password: 'TikaSmoke!Password2026',
  });
  userId = session.user.id;
  workspaceId = (
    await app.get(WorkspacesService).create(userId, { name: 'Tika smoke' })
  ).id;
  for (const [extension, mimetype, buffer, expected] of [
    [
      'pdf',
      'application/pdf',
      pdf('Tika PDF extraction works.'),
      'Tika PDF extraction works.',
    ],
    [
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docx('Tika DOCX: Žąsis, café, 日本語.'),
      'Tika DOCX: Žąsis, café, 日本語.',
    ],
    [
      'pdf',
      'application/pdf',
      Buffer.from('%PDF-1.7\ninvalid document\n%%EOF'),
      null,
    ],
  ]) {
    const material = await materials.upload(userId, workspaceId, {
      file: {
        buffer,
        size: buffer.length,
        originalname: `fixture.${extension}`,
        mimetype,
      },
    });
    const queued = material.processingJobs[0];
    // Scope the claim to our fixture, preserving every unrelated queue entry.
    const claimed = await prisma.$transaction(async (tx) => {
      const job = await tx.processingJob.update({
        where: { id: queued.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      const source = await tx.material.update({
        where: { id: material.id },
        data: { processingStatus: 'PROCESSING' },
      });
      return { ...job, material: source };
    });
    const worker = new ExtractionWorker(
      new ConfigService({ TIKA_URL: tikaUrl, TIKA_TIMEOUT_MS: 60000 }),
      {
        claimNextJob: async () => claimed,
        completeExtraction: jobs.completeExtraction.bind(jobs),
        failExtraction: jobs.failExtraction.bind(jobs),
      },
      app.get(OBJECT_STORAGE),
    );
    await worker.runOnce();
    const result = await materials.get(userId, material.id);
    assert.equal(result.processingStatus, expected ? 'READY' : 'FAILED');
    assert.equal(
      result.processingJobs[0].status,
      expected ? 'SUCCEEDED' : 'FAILED',
    );
    if (expected) {
      assert.ok(
        (await materials.readExtractedText(userId, material.id)).includes(
          expected,
        ),
      );
      const stored = await prisma.material.findUniqueOrThrow({
        where: { id: material.id },
      });
      assert.ok(stored.extractedText.includes(expected));
      await assert.rejects(
        materials.readExtractedText(randomUUID(), material.id),
      );
    }
    console.log(
      `PASS: ${expected ? extension + ' extraction, storage, database text and ownership' : 'corrupt PDF fails safely'}`,
    );
  }
} finally {
  try {
    if (workspaceId)
      await app.get(WorkspacesService).delete(userId, workspaceId);
    if (userId) await prisma.user.delete({ where: { id: userId } });
  } finally {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  }
}
