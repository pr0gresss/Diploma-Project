import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiEndpoint } from '../../openapi/api-endpoint.decorator.js';
import {
  materialPageSchema,
  renameSchema,
  uuidSchema,
  type MaterialQuery,
  type RenameBody,
  type UploadFields,
} from '../../common/http/request.schemas.js';
import { MAX_MATERIAL_SIZE_BYTES } from '../../infrastructure/files/material-file.validator.js';
import type { UploadedMaterialFile } from '../../infrastructure/files/material-file.validator.js';
import { MaterialsService } from './materials.service.js';
import { MaterialUploadFieldsPipe } from './material-upload-fields.pipe.js';

@ApiTags('Materials')
@ApiBearerAuth('bearerAuth')
@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Get('workspaces/:workspaceId/materials')
  @ApiEndpoint({
    id: 'listMaterials',
    summary: 'List materials in an owned workspace',
    params: ['workspaceId'],
    query: materialPageSchema,
    response: 'MaterialPage',
    errors: [404],
  })
  list(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', { schema: uuidSchema }) id: string,
    @Query({ schema: materialPageSchema }) query: MaterialQuery,
  ) {
    return this.materials.list(userId, id, query);
  }

  @Post('workspaces/:workspaceId/materials')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_MATERIAL_SIZE_BYTES,
        files: 1,
        fields: 1,
        fieldSize: 1024,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      additionalProperties: false,
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'PDF or DOCX, 1 byte–10 MiB. MIME, extension and signatures are checked.',
        },
        displayName: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          example: 'Lecture 1',
        },
      },
    },
  })
  @ApiEndpoint({
    id: 'uploadMaterial',
    summary: 'Upload a PDF or DOCX and enqueue extraction',
    description:
      'Stores the original file privately and queues extraction. When TIKA_URL is configured, the background worker extracts text and marks the material READY, or FAILED if extraction fails.',
    params: ['workspaceId'],
    status: 201,
    response: 'MaterialDetails',
    errors: [404, 413, 415, 503],
  })
  upload(
    @CurrentUser('id') userId: string,
    @Param('workspaceId', { schema: uuidSchema }) id: string,
    @UploadedFile() file: UploadedMaterialFile,
    @Body(MaterialUploadFieldsPipe) body: UploadFields,
  ) {
    return this.materials.upload(userId, id, { ...body, file });
  }

  @Get('materials/:materialId')
  @ApiEndpoint({
    id: 'getMaterial',
    summary: 'Read material metadata and processing jobs',
    params: ['materialId'],
    response: 'MaterialDetails',
    errors: [404],
  })
  get(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
  ) {
    return this.materials.get(userId, id);
  }

  @Patch('materials/:materialId')
  @ApiEndpoint({
    id: 'renameMaterial',
    summary: 'Rename a material',
    params: ['materialId'],
    body: renameSchema,
    example: { displayName: 'Lecture notes' },
    response: 'Material',
    errors: [404],
  })
  rename(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
    @Body({ schema: renameSchema }) body: RenameBody,
  ) {
    return this.materials.rename(userId, id, body);
  }

  @Delete('materials/:materialId')
  @HttpCode(204)
  @ApiEndpoint({
    id: 'deleteMaterial',
    summary: 'Delete a material without assessment history',
    params: ['materialId'],
    status: 204,
    errors: [404, 409],
  })
  delete(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
  ) {
    return this.materials.delete(userId, id);
  }

  @Get('materials/:materialId/text')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiResponse({
    status: 200,
    description: 'Extracted UTF-8 text.',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
          example: 'A database transaction is atomic.',
        },
      },
    },
  })
  @ApiEndpoint({
    id: 'getMaterialText',
    summary: 'Read extracted text',
    params: ['materialId'],
    description:
      'Returns text only when extraction output is available in private storage.',
    errors: [404, 503],
  })
  text(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
  ) {
    return this.materials.readExtractedText(userId, id);
  }

  @Post('materials/:materialId/extraction/retry')
  @ApiEndpoint({
    id: 'retryExtraction',
    summary: 'Queue a new extraction attempt',
    description:
      'Only uploaded or failed materials can be retried. An existing queued/running extraction conflicts.',
    params: ['materialId'],
    status: 201,
    response: 'ProcessingJob',
    errors: [404, 409],
  })
  retry(
    @CurrentUser('id') userId: string,
    @Param('materialId', { schema: uuidSchema }) id: string,
  ) {
    return this.materials.retryExtraction(userId, id);
  }
}
