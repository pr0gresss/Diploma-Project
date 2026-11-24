import { HttpErrorResponse } from '@angular/common/http';

type ApiErrorBody = {
  message?: unknown;
  error?: { message?: unknown };
} | null;

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody;
    const message = body?.message ?? body?.error?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}
