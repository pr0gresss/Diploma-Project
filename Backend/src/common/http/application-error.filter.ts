import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  ApplicationError,
  type ApplicationErrorCode,
} from '../errors/index.js';

const statuses: Record<ApplicationErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  storage_error: 503,
  ai_unavailable: 503,
  internal_error: 500,
};

@Catch(ApplicationError)
export class ApplicationErrorFilter implements ExceptionFilter<ApplicationError> {
  private readonly logger = new Logger(ApplicationErrorFilter.name);
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(error: ApplicationError, host: ArgumentsHost): void {
    const statusCode = statuses[error.code];
    if (statusCode >= 500) {
      this.logger.error('Application operation failed', {
        errorCode: error.code,
      });
    }
    const response = host.switchToHttp().getResponse();
    if (statusCode === 401) {
      this.adapterHost.httpAdapter.setHeader(
        response,
        'WWW-Authenticate',
        'Bearer realm="ai-study-workspace"',
      );
    }
    this.adapterHost.httpAdapter.reply(
      response,
      {
        statusCode,
        message:
          statusCode >= 500 ? 'Service temporarily unavailable' : error.message,
        errorCode: error.code,
        // Storage keys, database metadata and original causes must stay private.
        ...(statusCode < 500 &&
        error.code === 'validation_error' &&
        error.details
          ? { details: error.details }
          : {}),
      },
      statusCode,
    );
  }
}
