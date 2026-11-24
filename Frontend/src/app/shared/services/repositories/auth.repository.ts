import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api.config';
import { AuthSession, RegisterRequest, SignInRequest } from '../api.models';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  register(request: RegisterRequest): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/register`, request);
  }

  signIn(request: SignInRequest): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/auth/sign-in`, request);
  }
}
