import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class AppRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getRootGreeting(): Observable<string> {
    return this.http.get(`${this.baseUrl}/`, { responseType: 'text' });
  }
}
