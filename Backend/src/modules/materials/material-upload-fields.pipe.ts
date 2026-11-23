import { Injectable, type PipeTransform } from '@nestjs/common';
import { ValidationError } from '../../common/errors/index.js';
import { uploadFieldsSchema, type UploadFields } from '../../common/http/request.schemas.js';

/**
 * Validates the text fields after Multer has separated out the file.
 * Keeping this schema off @Body({ schema }) prevents Swagger from replacing
 * the explicit multipart binary schema with the text-only validation schema.
 */
@Injectable()
export class MaterialUploadFieldsPipe implements PipeTransform<unknown, UploadFields> {
  transform(value: unknown): UploadFields {
    const result = uploadFieldsSchema.safeParse(value ?? {});
    if (!result.success) throw new ValidationError('Request validation failed');
    return result.data;
  }
}
