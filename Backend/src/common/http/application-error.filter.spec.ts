import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ApplicationErrorFilter } from './application-error.filter.js';
import {
  ConflictError,
  InvalidCredentialsError,
  NotFoundError,
  StorageError,
  ValidationError,
} from '../errors/index.js';

describe('ApplicationErrorFilter', () => {
  const response = {};
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as ArgumentsHost;
  it.each([
    [new ValidationError('Invalid name'), 400],
    [new InvalidCredentialsError(), 401],
    [new NotFoundError('Missing material'), 404],
    [new ConflictError('History prevents deletion'), 409],
    [
      new StorageError(
        'secret bucket path',
        { key: 'private/key' },
        new Error('secret'),
      ),
      503,
    ],
  ])(
    'maps domain error %# without leaking storage internals',
    (error, statusCode) => {
      const adapter = { reply: vi.fn(), setHeader: vi.fn() };
      new ApplicationErrorFilter({
        httpAdapter: adapter,
      } as unknown as HttpAdapterHost).catch(error, host);
      expect(adapter.reply).toHaveBeenCalledWith(
        response,
        expect.objectContaining({ statusCode, errorCode: error.code }),
        statusCode,
      );
      if (statusCode === 503) {
        expect(adapter.reply.mock.calls[0][1]).toEqual({
          statusCode: 503,
          errorCode: 'storage_error',
          message: 'Service temporarily unavailable',
        });
      }
      if (statusCode === 401)
        expect(adapter.setHeader).toHaveBeenCalledWith(
          response,
          'WWW-Authenticate',
          expect.any(String),
        );
    },
  );
});
