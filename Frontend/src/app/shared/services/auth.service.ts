import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  AuthSession,
  AuthUser,
  RegisterRequest,
  SignInRequest,
} from './api.models';
import { AuthRepository } from './repositories/auth.repository';

const TOKEN_KEY = 'ai-study.accessToken';
const USER_KEY = 'ai-study.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(AuthRepository);

  private readonly accessTokenState = signal<string | null>(this.readToken());
  private readonly userState = signal<AuthUser | null>(this.readUser());

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.accessTokenState()));

  register(request: RegisterRequest): Observable<AuthSession> {
    return this.repository.register(request).pipe(tap((session) => this.storeSession(session)));
  }

  signIn(request: SignInRequest): Observable<AuthSession> {
    return this.repository.signIn(request).pipe(tap((session) => this.storeSession(session)));
  }

  signOut(): void {
    this.accessTokenState.set(null);
    this.userState.set(null);
    this.storage()?.removeItem(TOKEN_KEY);
    this.storage()?.removeItem(USER_KEY);
  }

  private storeSession(session: AuthSession): void {
    this.accessTokenState.set(session.accessToken);
    this.userState.set(session.user);
    this.storage()?.setItem(TOKEN_KEY, session.accessToken);
    this.storage()?.setItem(USER_KEY, JSON.stringify(session.user));
  }

  private readToken(): string | null {
    return this.storage()?.getItem(TOKEN_KEY) ?? null;
  }

  private readUser(): AuthUser | null {
    const value = this.storage()?.getItem(USER_KEY);
    if (!value) return null;
    try {
      return JSON.parse(value) as AuthUser;
    } catch {
      return null;
    }
  }

  private storage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
