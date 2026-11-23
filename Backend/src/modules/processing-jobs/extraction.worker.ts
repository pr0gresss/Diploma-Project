import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OBJECT_STORAGE, type ObjectStorage } from '../../infrastructure/storage/object-storage.interface.js';
import { ProcessingJobsService } from './processing-jobs.service.js';

/** Database-backed polling: one job per process, atomic claims across instances. */
@Injectable()
export class ExtractionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ExtractionWorker.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopping = false;
  private active?: Promise<void>;
  private controller?: AbortController;

  constructor(
    private readonly config: ConfigService,
    private readonly jobs: ProcessingJobsService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('TIKA_URL')) this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.timer);
    this.controller?.abort();
    await this.active;
  }

  private schedule(delay: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => {
      this.active = this.runOnce().catch(() => {
        this.logger.warn('extraction_worker_cycle_failed');
      }).finally(() => this.schedule(1000));
    }, delay);
    this.timer.unref();
  }

  async runOnce(): Promise<void> {
    const base = this.config.get<string>('TIKA_URL');
    if (!base || this.stopping) return;
    const job = await this.jobs.claimNextJob();
    if (!job) return;
    try {
      const original = await this.storage.get(job.material.storageKey);
      if (this.stopping) throw new Error('Worker stopped');
      this.controller = new AbortController();
      const response = await fetch(`${base.replace(/\/+$/, '')}/tika`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', Accept: 'text/plain' },
        body: new Uint8Array(original),
        redirect: 'error',
        signal: AbortSignal.any([
          this.controller.signal,
          AbortSignal.timeout(this.config.get<number>('TIKA_TIMEOUT_MS', 60000)),
        ]),
      });
      if (!response.ok || !response.body) throw new Error('Extraction unavailable');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 20 * 1024 * 1024) throw new Error('Extraction too large');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const text = Buffer.concat(chunks).toString('utf8').replace(/\u0000/g, '').trim();
      await this.jobs.completeExtraction(job.id, text);
    } catch {
      // Never persist provider bodies, credentials, source text or storage errors.
      await this.jobs.failExtraction(job.id, 'Text extraction failed; check Tika availability, document validity and storage');
    } finally {
      this.controller = undefined;
    }
  }
}
