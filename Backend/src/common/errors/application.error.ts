/**
 * Application-level errors. They describe business failures without knowing
 * anything about HTTP; the global exception filter maps them to responses.
 */
export type ApplicationErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'storage_error'
  | 'ai_unavailable'
  | 'internal_error';

export interface ApplicationErrorOptions {
  code?: ApplicationErrorCode;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    { code = 'internal_error', details, cause }: ApplicationErrorOptions = {},
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'validation_error', details });
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(
    message = 'Authentication is required',
    code: ApplicationErrorCode = 'unauthorized',
    details?: Record<string, unknown>,
  ) {
    super(message, { code, details });
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super('Invalid email or password', 'invalid_credentials');
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Access is denied', details?: Record<string, unknown>) {
    super(message, { code: 'forbidden', details });
  }
}

export class NotFoundError extends ApplicationError {
  constructor(
    message = 'Resource not found',
    details?: Record<string, unknown>,
  ) {
    super(message, { code: 'not_found', details });
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'conflict', details });
  }
}

export class PayloadTooLargeError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'payload_too_large', details });
  }
}

export class UnsupportedMediaTypeError extends ApplicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, { code: 'unsupported_media_type', details });
  }
}

export class StorageError extends ApplicationError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: unknown,
  ) {
    super(message, { code: 'storage_error', details, cause });
  }
}

export class AiUnavailableError extends ApplicationError {
  constructor(
    message = 'AI generation is unavailable; reconnect OpenAI or check plan limits',
  ) {
    super(message, { code: 'ai_unavailable' });
  }
}
