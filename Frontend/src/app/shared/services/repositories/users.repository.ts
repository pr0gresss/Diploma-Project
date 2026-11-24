import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import { User } from '../api.models';

@Injectable({ providedIn: 'root' })
export class UsersRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/me`);
  }
}
