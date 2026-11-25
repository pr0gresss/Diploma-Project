import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HeaderSearchService } from './header-search.service';
import type { WorkspaceOverview } from './workspace-overview.service';
import { WorkspaceOverviewService } from './workspace-overview.service';

const OVERVIEW: WorkspaceOverview = {
  workspaces: [
    {
      id: 'workspace',
      name: 'Alpha workspace',
      materialCount: 2,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  materials: [
    {
      id: 'material',
      workspaceId: 'workspace',
      displayName: 'Alpha file',
      originalFilename: 'alpha.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      processingStatus: 'READY',
      jobCount: 0,
      guideCount: 1,
      quizCount: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  guides: [
    {
      id: 'guide',
      materialId: 'material',
      displayName: 'Alpha note',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  quizzes: [
    {
      id: 'quiz',
      materialId: 'material',
      displayName: 'Alpha quiz',
      questionCount: 3,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  progress: null,
};

const EXPECTED_ICONS = [
  { category: 'workspace', icon: 'grid' },
  { category: 'material', icon: 'file' },
  { category: 'note', icon: 'note' },
  { category: 'quiz', icon: 'quiz' },
];

function setup() {
  const loadAll = vi.fn(() => of(OVERVIEW));
  TestBed.configureTestingModule({
    providers: [{ provide: WorkspaceOverviewService, useValue: { loadAll } }],
  });

  return { service: TestBed.inject(HeaderSearchService), loadAll };
}

describe('HeaderSearchService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits 3 seconds after a value change before searching', () => {
    const { service, loadAll } = setup();

    service.setQuery('alpha');

    expect(service.pending()).toBe(true);
    expect(service.results()).toEqual([]);
    expect(loadAll).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2999);
    expect(service.results()).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(service.pending()).toBe(false);
    expect(service.results().map(({ category, icon }) => ({ category, icon }))).toEqual(
      EXPECTED_ICONS,
    );
    expect(loadAll).toHaveBeenCalledTimes(1);
  });

  it('searches immediately when submitted and skips unchanged queries', () => {
    const { service, loadAll } = setup();

    service.setQuery('alpha');
    service.searchNow();

    expect(service.pending()).toBe(false);
    expect(service.results().map(({ category, icon }) => ({ category, icon }))).toEqual(
      EXPECTED_ICONS,
    );

    service.setQuery('alpha');
    service.searchNow();
    vi.advanceTimersByTime(3000);

    expect(loadAll).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated input events with the same value', () => {
    const { service, loadAll } = setup();

    service.setQuery('alpha');
    service.setQuery('alpha');
    vi.advanceTimersByTime(3000);

    expect(loadAll).toHaveBeenCalledTimes(1);
    expect(service.results().length).toBe(4);
  });
});
