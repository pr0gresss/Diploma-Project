/**
 * The public representation of an account. Password hashes never leave the
 * repository, so a user object is safe to log or return from a route.
 */
export interface AuthUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials {
  user: AuthUser;
  passwordHash: string;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
    // Access tokens only; the client signs in again when a token expires.
    refreshTokens: false;
  }
}
