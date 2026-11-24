import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken();
  const isAuthRequest = request.url.includes('/auth/');

  if (!token || isAuthRequest) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  ).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !router.url.startsWith('/login')
      ) {
        auth.signOut();
        void router.navigate(['/login'], {
          queryParams: { returnUrl: router.url },
        });
      }

      return throwError(() => error);
    }),
  );
};
