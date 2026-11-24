import { InjectionToken } from '@angular/core';

/** Same-origin API prefix: Angular dev server and production nginx proxy to NestJS. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
