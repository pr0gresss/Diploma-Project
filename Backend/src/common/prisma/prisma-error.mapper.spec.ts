import { Prisma } from '../../generated/prisma/client.js';
import { rethrowPrismaError } from './prisma-error.mapper.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';

describe('rethrowPrismaError', () => {
  it.each([
    ['P2000', ValidationError],
    ['P2007', ValidationError],
    ['P2023', ValidationError],
    ['P2002', ConflictError],
    ['P2003', ConflictError],
    ['P2014', ConflictError],
    ['P2025', NotFoundError],
  ])('maps %s to a domain error', (code, expected) => {
    const error = new Prisma.PrismaClientKnownRequestError(code, {
      code,
      clientVersion: '7',
    });
    expect(() => rethrowPrismaError(error)).toThrow(expected);
    expect(() =>
      rethrowPrismaError(error, {
        notFound: 'Custom',
        conflict: 'Custom',
        validation: 'Custom',
      }),
    ).toThrow('Custom');
  });
  it('preserves unique constraint field details', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '7',
      meta: { target: ['email'] },
    });
    expect(() => rethrowPrismaError(error)).toThrow(
      expect.objectContaining({ details: { fields: 'email' } }),
    );
  });
  it('never disguises unexpected failures as client errors', () => {
    const error = new Error('unexpected');
    expect(() => rethrowPrismaError(error)).toThrow(error);
    const unknown = new Prisma.PrismaClientKnownRequestError('unknown', {
      code: 'P9999',
      clientVersion: '7',
    });
    expect(() => rethrowPrismaError(unknown)).toThrow(unknown);
  });
});
