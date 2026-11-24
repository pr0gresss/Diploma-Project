import { InjectionToken } from '@angular/core';

/** Direct backend URL for local development. Switch back to `/api` to use the dev proxy. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
