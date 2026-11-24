import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './features/auth/auth.guard';
import { PlatformTemplateComponent } from './shared/layout/platform-template.component';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Log in · AI study workspace',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    title: 'Create an account · AI study workspace',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    component: PlatformTemplateComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'workspaces' },
      {
        path: 'workspaces',
        title: 'My workspaces · AI study workspace',
        loadComponent: () =>
          import('./features/workspaces/workspaces-page.component').then(
            (m) => m.WorkspacesPageComponent,
          ),
      },
      {
        path: 'workspaces/:workspaceId/study-notes',
        title: 'Workspace study notes · AI study workspace',
        loadComponent: () =>
          import('./features/study-notes/study-notes-page.component').then(
            (m) => m.StudyNotesPageComponent,
          ),
      },
      {
        path: 'workspaces/:workspaceId/quizzes',
        title: 'Workspace quizzes · AI study workspace',
        loadComponent: () =>
          import('./features/quizzes/quizzes-page.component').then((m) => m.QuizzesPageComponent),
      },
      {
        path: 'workspaces/:workspaceId',
        title: 'Workspace · AI study workspace',
        loadComponent: () =>
          import('./features/workspace/workspace-page.component').then(
            (m) => m.WorkspacePageComponent,
          ),
      },
      {
        path: 'study-notes',
        title: 'Study notes · AI study workspace',
        loadComponent: () =>
          import('./features/study-notes/study-notes-page.component').then(
            (m) => m.StudyNotesPageComponent,
          ),
      },
      {
        path: 'quizzes',
        title: 'Quizzes · AI study workspace',
        loadComponent: () =>
          import('./features/quizzes/quizzes-page.component').then((m) => m.QuizzesPageComponent),
      },
      {
        path: 'quizzes/:quizId',
        runGuardsAndResolvers: 'always',
        canDeactivate: [(component: { canLeave: () => Promise<boolean> }) => component.canLeave()],
        title: 'Quiz · AI study workspace',
        loadComponent: () =>
          import('./features/quizzes/quiz-runner.component').then((m) => m.QuizRunnerComponent),
      },
      { path: '**', redirectTo: 'workspaces' },
    ],
  },
];
