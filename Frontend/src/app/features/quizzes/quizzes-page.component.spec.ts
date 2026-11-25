import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { PlatformState } from '../../shared/layout/platform-state.service';
import type { WorkspaceOverview } from '../../shared/services/workspace-overview.service';
import { QuizzesService } from '../../shared/services/quizzes.service';
import { WorkspaceOverviewService } from '../../shared/services/workspace-overview.service';
import { QuizzesPageComponent } from './quizzes-page.component';

const OVERVIEW: WorkspaceOverview = {
  workspaces: [],
  materials: [],
  guides: [],
  quizzes: [
    {
      id: 'quiz-a',
      materialId: 'material',
      displayName: 'Alpha quiz',
      questionCount: 3,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: 'quiz-b',
      materialId: 'material',
      displayName: 'Beta quiz',
      questionCount: 5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ],
  progress: null,
};

describe('QuizzesPageComponent', () => {
  it('keeps the workspace quiz list independent of the header query', () => {
    const headerQuery = signal('');
    TestBed.configureTestingModule({
      imports: [QuizzesPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: PlatformState,
          useValue: {
            headerQuery,
            activeTab: signal('quizzes'),
            selectedWorkspace: signal({ id: '', name: 'No workspace', marker: '#000' }),
            setTab: () => {},
          },
        },
        {
          provide: WorkspaceOverviewService,
          useValue: { load: () => of(OVERVIEW), loadAll: () => of(OVERVIEW) },
        },
        { provide: QuizzesService, useValue: {} },
      ],
    });

    const fixture = TestBed.createComponent(QuizzesPageComponent);
    fixture.componentRef.setInput('workspaceId', 'workspace');
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleQuizzes().map((quiz) => quiz.title)).toEqual([
      'Alpha quiz',
      'Beta quiz',
    ]);

    headerQuery.set('alpha');
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleQuizzes().map((quiz) => quiz.title)).toEqual([
      'Alpha quiz',
      'Beta quiz',
    ]);
  });
});
