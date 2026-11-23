import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import type { ResourceSchemaName } from './resource.schemas.js';
import { resourceExamples } from './resource.examples.js';

export function apiSchema(schema: z.ZodType): SchemaObject {
  return z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io: 'input',
    unrepresentable: 'any',
  }) as SchemaObject;
}

/** Shared HTTP documentation conventions; each handler still declares its contract. */
export function ApiEndpoint(options: {
  id: string;
  summary: string;
  description?: string;
  response?: ResourceSchemaName;
  status?: number;
  array?: boolean;
  body?: z.ZodType;
  example?: unknown;
  params?: string[];
  query?: z.ZodType;
  errors?: number[];
  public?: boolean;
}) {
  const status = options.status ?? 200;
  const decorators: Array<MethodDecorator> = [
    ApiOperation({
      operationId: options.id,
      summary: options.summary,
      description: options.description ?? options.summary,
      ...(options.public ? { security: [] } : {}),
    }),
    ApiResponse({
      status,
      description:
        status === 204
          ? 'Deleted successfully; no response body.'
          : 'Operation succeeded.',
      ...(options.response
        ? {
            content: {
              'application/json': {
                schema: options.array
                  ? {
                      type: 'array',
                      items: {
                        $ref: `#/components/schemas/${options.response}`,
                      },
                    }
                  : { $ref: `#/components/schemas/${options.response}` },
                example: options.array
                  ? [resourceExamples[options.response]]
                  : resourceExamples[options.response],
              },
            },
          }
        : {}),
    }),
  ];
  if (options.body) {
    decorators.push(
      ApiBody({
        schema: apiSchema(options.body),
        ...(options.example
          ? {
              examples: {
                typical: { summary: 'Typical request', value: options.example },
              },
            }
          : {}),
      }),
    );
  }
  for (const name of options.params ?? []) {
    decorators.push(
      ApiParam({
        name,
        required: true,
        description: 'Owned resource identifier.',
        schema: {
          type: 'string',
          format: 'uuid',
          example: '11111111-1111-4111-8111-111111111111',
        },
      }),
    );
  }
  if (options.query) {
    const query = apiSchema(options.query);
    for (const [name, schema] of Object.entries(query.properties ?? {})) {
      decorators.push(
        ApiQuery({ name, required: false, schema: schema as SchemaObject }),
      );
    }
  }
  for (const error of new Set([400, 401, 500, ...(options.errors ?? [])])) {
    decorators.push(
      ApiResponse({
        status: error,
        description: (
          {
            400: 'Invalid request parameters or body.',
            401: 'Missing or invalid credentials.',
            403: 'Operation is not allowed for this account.',
            404: 'Resource not found, including resources owned by another user.',
            409: 'Operation conflicts with resource state, uniqueness or assessment history.',
            413: 'Uploaded document exceeds the size limit.',
            415: 'Unsupported document type.',
            500: 'Unexpected server failure.',
            503: 'Private object storage or the AI provider is unavailable or not configured.',
          } as Record<number, string>
        )[error],
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HttpErrorResponse' },
            example: (
              {
                400: {
                  statusCode: 400,
                  message: 'Request validation failed',
                  errorCode: 'validation_error',
                },
                401: options.public
                  ? {
                      statusCode: 401,
                      message: 'Invalid email or password',
                      errorCode: 'invalid_credentials',
                    }
                  : {
                      statusCode: 401,
                      message: 'Unauthorized',
                      errorCode: 'missing_credentials',
                    },
                403: {
                  statusCode: 403,
                  message: 'Operation is not allowed for this account',
                  errorCode: 'forbidden',
                },
                404: {
                  statusCode: 404,
                  message: 'Resource not found',
                  errorCode: 'not_found',
                },
                409: {
                  statusCode: 409,
                  message: 'Operation conflicts with resource state',
                  errorCode: 'conflict',
                },
                413: {
                  statusCode: 413,
                  message: 'The file exceeds the 10 MiB limit',
                  errorCode: 'payload_too_large',
                },
                415: {
                  statusCode: 415,
                  message: 'Only PDF and DOCX documents are supported',
                  errorCode: 'unsupported_media_type',
                },
                500: { statusCode: 500, message: 'Internal server error' },
                503: {
                  statusCode: 503,
                  message: 'Service temporarily unavailable',
                  errorCode: 'storage_error',
                },
              } as Record<number, unknown>
            )[error],
          },
        },
      }),
    );
  }
  return applyDecorators(...decorators);
}
