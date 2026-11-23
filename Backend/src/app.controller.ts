import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { HttpErrorResponse } from './openapi/http-error.response.js';
import { rootExamples } from './openapi/openapi.examples.js';

@ApiTags('System')
@ApiBearerAuth('bearerAuth')
@ApiExtraModels(HttpErrorResponse)
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    operationId: 'getRootGreeting',
    summary: 'Read the authenticated API greeting',
    description:
      'Returns the existing bootstrap greeting. Requires a valid JWT whose subject resolves to an existing user. ' +
      'There are no path/query parameters or request body. This is not a database health check. ' +
      'The Express adapter sends the string as text/html; it is not a JSON string or object.',
  })
  @ApiOkResponse({
    description: 'Authenticated request succeeded.',
    content: {
      'text/html': {
        schema: { type: 'string' },
        examples: {
          greeting: {
            summary: 'Successful bootstrap response',
            value: rootExamples.success,
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description:
      'Missing, malformed, expired or otherwise invalid credentials, or an account that no longer exists.',
    headers: {
      'WWW-Authenticate': {
        description:
          'Bearer challenge; invalid credentials also include error details.',
        schema: {
          type: 'string',
          example: 'Bearer realm="ai-study-workspace"',
        },
      },
    },
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(HttpErrorResponse) },
        examples: {
          missingCredentials: {
            summary: 'Authorization header omitted',
            value: rootExamples.missingCredentials,
          },
          malformedToken: {
            summary: 'Bearer value is not a JWT',
            value: rootExamples.malformedToken,
          },
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description:
      'Unexpected server failure, for example the user lookup database is unavailable.',
    content: {
      'application/json': {
        schema: { $ref: getSchemaPath(HttpErrorResponse) },
        examples: {
          internalError: {
            summary: 'Unexpected server failure',
            value: rootExamples.internalError,
          },
        },
      },
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
