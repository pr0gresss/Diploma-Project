import { Prisma } from '../../generated/prisma/client.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors/index.js';

export interface PrismaErrorMessages {
  notFound?: string;
  conflict?: string;
  validation?: string;
}

/**
 * Translates the database errors the API can legitimately produce into domain
 * errors. Anything else is re-thrown and becomes a 500 through the global
 * exception filter, so unexpected defects are never disguised as client errors.
 */
export function rethrowPrismaError(
  error: unknown,
  messages: PrismaErrorMessages = {},
): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
      case 'P2007':
      case 'P2023':
        throw new ValidationError(
          messages.validation ?? 'The provided data is invalid',
          { prismaCode: error.code },
        );
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[]).join(', ')
          : undefined;
        throw new ConflictError(
          messages.conflict ??
            'A record with the same unique value already exists',
          target ? { fields: target } : undefined,
        );
      }
      case 'P2003':
      case 'P2014':
        throw new ConflictError(
          messages.conflict ??
            'The operation conflicts with existing related records, such as assessment history',
          { prismaCode: error.code },
        );
      case 'P2025':
        throw new NotFoundError(messages.notFound ?? 'Resource not found');
      default:
        break;
    }
  }

  throw error;
}
