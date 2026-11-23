import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Current Nest HTTP error envelope, not the future domain-error mapping. */
export class HttpErrorResponse {
  @ApiProperty({
    description:
      'Human-readable failure description; clients should not parse it.',
    example: 'Unauthorized',
  })
  message!: string;

  @ApiProperty({
    description: 'HTTP response status.',
    example: 401,
    minimum: 400,
    maximum: 599,
    type: 'integer',
  })
  statusCode!: number;

  @ApiPropertyOptional({
    description: 'Optional HTTP error description, present for invalid tokens.',
    example: 'Unauthorized',
  })
  error?: string;

  @ApiPropertyOptional({
    description:
      'Optional machine-readable error code. Missing credentials use missing_credentials.',
    example: 'missing_credentials',
  })
  errorCode?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Optional sanitized business-validation details.',
  })
  details?: Record<string, unknown>;
}
