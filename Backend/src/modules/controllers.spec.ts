import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';
import { WorkspacesController } from './workspaces/workspaces.controller.js';
import { WorkspacesService } from './workspaces/workspaces.service.js';
import { MaterialsController } from './materials/materials.controller.js';
import { MaterialsService } from './materials/materials.service.js';
import { ProcessingJobsController } from './processing-jobs/processing-jobs.controller.js';
import { ProcessingJobsService } from './processing-jobs/processing-jobs.service.js';
import { StudyGuidesController } from './study-guides/study-guides.controller.js';
import { StudyGuidesService } from './study-guides/study-guides.service.js';
import { QuizzesController } from './quizzes/quizzes.controller.js';
import { QuizzesService } from './quizzes/quizzes.service.js';
import { QuizGenerationService } from './quizzes/quiz-generation.service.js';
import { AttemptsController } from './attempts/attempts.controller.js';
import { AttemptsService } from './attempts/attempts.service.js';
import { ProgressController } from './progress/progress.controller.js';
import { ProgressService } from './progress/progress.service.js';

const query = { limit: 20, offset: 0 };
const names = { displayName: 'Name' };
const mock = () => vi.fn().mockResolvedValue({ result: 'service response' });

describe('Controller to service delegation', () => {
  it('auth forwards credentials without manufacturing a session', async () => {
    const service = { register: mock(), signIn: mock() };
    const controller = new AuthController(service as unknown as AuthService);
    const body = {
      email: 'student@example.com',
      password: 'StrongPassword!2026',
    };
    await controller.register(body);
    await controller.signIn(body);
    expect(service.register).toHaveBeenCalledWith(body);
    expect(service.signIn).toHaveBeenCalledWith(body);
  });
  it('users forwards the authenticated account identity', async () => {
    const service = { getProfile: mock() };
    expect(
      await new UsersController(service as unknown as UsersService).getProfile(
        'user',
      ),
    ).toEqual({ result: 'service response' });
    expect(service.getProfile).toHaveBeenCalledWith('user');
  });
  it('workspaces passes the authenticated user for every operation', async () => {
    const service = {
      list: mock(),
      create: mock(),
      get: mock(),
      rename: mock(),
      delete: mock(),
    };
    const controller = new WorkspacesController(
      service as unknown as WorkspacesService,
    );
    await controller.list('user', query);
    await controller.create('user', { name: 'Workspace' });
    await controller.get('user', 'workspace');
    await controller.rename('user', 'workspace', { name: 'Updated' });
    await controller.delete('user', 'workspace');
    expect(service.list).toHaveBeenCalledWith('user', query);
    expect(service.create).toHaveBeenCalledWith('user', { name: 'Workspace' });
    expect(service.get).toHaveBeenCalledWith('user', 'workspace');
    expect(service.rename).toHaveBeenCalledWith('user', 'workspace', {
      name: 'Updated',
    });
    expect(service.delete).toHaveBeenCalledWith('user', 'workspace');
  });
  it('materials delegates uploads, reads, renames, deletion and retries', async () => {
    const service = {
      list: mock(),
      upload: mock(),
      get: mock(),
      rename: mock(),
      delete: mock(),
      readExtractedText: mock(),
      retryExtraction: mock(),
    };
    const controller = new MaterialsController(
      service as unknown as MaterialsService,
    );
    const file = {
      buffer: Buffer.from('%PDF-1.7'),
      originalname: 'notes.pdf',
      mimetype: 'application/pdf',
      size: 8,
    };
    await controller.list('user', 'workspace', query);
    await controller.upload('user', 'workspace', file, names);
    await controller.get('user', 'material');
    await controller.rename('user', 'material', names);
    await controller.delete('user', 'material');
    await controller.text('user', 'material');
    await controller.retry('user', 'material');
    expect(service.upload).toHaveBeenCalledWith('user', 'workspace', {
      ...names,
      file,
    });
    expect(service.list).toHaveBeenCalledWith('user', 'workspace', query);
    for (const name of [
      'get',
      'delete',
      'readExtractedText',
      'retryExtraction',
    ] as const) {
      expect(service[name]).toHaveBeenCalledWith('user', 'material');
    }
    expect(service.rename).toHaveBeenCalledWith('user', 'material', names);
  });
  it('processing jobs exposes only the owned-material read operation', async () => {
    const service = { listForMaterial: mock() };
    const controller = new ProcessingJobsController(
      service as unknown as ProcessingJobsService,
    );
    await controller.list('user', 'material');
    expect(service.listForMaterial).toHaveBeenCalledWith('user', 'material');
    expect(
      Object.getOwnPropertyNames(ProcessingJobsController.prototype),
    ).toEqual(['constructor', 'list']);
  });
  it('study guides delegates all owned operations', async () => {
    const service = {
      list: mock(),
      create: mock(),
      get: mock(),
      rename: mock(),
      delete: mock(),
    };
    const controller = new StudyGuidesController(
      service as unknown as StudyGuidesService,
    );
    const body = { content: '# Notes' };
    await controller.list('user', 'material', query);
    await controller.create('user', 'material', body);
    await controller.get('user', 'guide');
    await controller.rename('user', 'guide', names);
    await controller.delete('user', 'guide');
    expect(service.list).toHaveBeenCalledWith('user', 'material', query);
    expect(service.create).toHaveBeenCalledWith('user', 'material', body);
    expect(service.get).toHaveBeenCalledWith('user', 'guide');
    expect(service.rename).toHaveBeenCalledWith('user', 'guide', names);
    expect(service.delete).toHaveBeenCalledWith('user', 'guide');
  });
  it('quizzes always fetches the safe taking representation', async () => {
    const service = {
      list: mock(),
      create: mock(),
      getForTaking: mock(),
      rename: mock(),
      delete: mock(),
    };
    const controller = new QuizzesController(
      service as unknown as QuizzesService,
      { generate: mock() } as unknown as QuizGenerationService,
    );
    const body = { questions: [] };
    await controller.list('user', 'material', query);
    await controller.create('user', 'material', body);
    await controller.get('user', 'quiz');
    await controller.rename('user', 'quiz', names);
    await controller.delete('user', 'quiz');
    expect(service.list).toHaveBeenCalledWith('user', 'material', query);
    expect(service.create).toHaveBeenCalledWith('user', 'material', body);
    expect(service.getForTaking).toHaveBeenCalledWith('user', 'quiz');
    expect(service.rename).toHaveBeenCalledWith('user', 'quiz', names);
    expect(service.delete).toHaveBeenCalledWith('user', 'quiz');
  });
  it('attempts passes identity and answer IDs to server-side grading', async () => {
    const service = {
      listMine: mock(),
      listForQuiz: mock(),
      submit: mock(),
      getResult: mock(),
    };
    const controller = new AttemptsController(
      service as unknown as AttemptsService,
    );
    const body = {
      answers: [{ questionId: 'question', selectedOptionId: 'option' }],
    };
    await controller.listMine('user', query);
    await controller.listForQuiz('user', 'quiz', query);
    await controller.submit('user', 'quiz', body);
    await controller.get('user', 'attempt');
    expect(service.listMine).toHaveBeenCalledWith('user', query);
    expect(service.listForQuiz).toHaveBeenCalledWith('user', 'quiz', query);
    expect(service.submit).toHaveBeenCalledWith('user', 'quiz', body);
    expect(service.getResult).toHaveBeenCalledWith('user', 'attempt');
  });
  it('progress delegates only authenticated-user reporting', async () => {
    const service = { getReport: mock(), getOverview: mock() };
    const controller = new ProgressController(
      service as unknown as ProgressService,
    );
    await controller.report('user', query);
    await controller.overview('user');
    expect(service.getReport).toHaveBeenCalledWith('user', query);
    expect(service.getOverview).toHaveBeenCalledWith('user');
  });
});
