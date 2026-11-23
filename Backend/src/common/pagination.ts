import { ValidationError } from './errors/index.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageQuery {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface NormalizedPageQuery {
  limit: number;
  offset: number;
  search?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function normalizePageQuery(query: PageQuery = {}): NormalizedPageQuery {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const offset = query.offset ?? 0;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ValidationError(
      `limit must be an integer between 1 and ${MAX_PAGE_SIZE}`,
    );
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ValidationError('offset must be a non-negative integer');
  }

  const search = query.search?.trim();

  return {
    limit,
    offset,
    ...(search ? { search } : {}),
  };
}

export function pageOf<T>(
  items: T[],
  total: number,
  query: NormalizedPageQuery,
): Page<T> {
  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
