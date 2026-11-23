import { basename, extname } from 'node:path';
import {
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../common/errors/index.js';

export const MAX_MATERIAL_SIZE_BYTES = 10 * 1024 * 1024;

export const PDF_MIME_TYPE = 'application/pdf';
export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const ALLOWED_MATERIAL_MIME_TYPES = [
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
] as const;

export type AllowedMaterialMimeType =
  (typeof ALLOWED_MATERIAL_MIME_TYPES)[number];

export interface UploadedMaterialFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface ValidatedMaterialFile {
  mimeType: AllowedMaterialMimeType;
  extension: 'pdf' | 'docx';
  originalFilename: string;
  displayName: string;
  sizeBytes: number;
  buffer: Buffer;
}

/**
 * Validates the actual bytes, not only the browser-supplied MIME type, so a
 * renamed executable cannot enter the document pipeline.
 */
export function validateMaterialFile(
  file: UploadedMaterialFile,
): ValidatedMaterialFile {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new ValidationError('A file is required');
  }
  if (file.size < 1 || file.buffer.length < 1) {
    throw new ValidationError('The file is empty');
  }
  if (
    file.size > MAX_MATERIAL_SIZE_BYTES ||
    file.buffer.length > MAX_MATERIAL_SIZE_BYTES
  ) {
    throw new PayloadTooLargeError('The file exceeds the 10 MiB limit', {
      maxBytes: MAX_MATERIAL_SIZE_BYTES,
    });
  }

  const originalFilename = sanitizeOriginalFilename(file.originalname);
  const extension = extname(originalFilename).toLowerCase();

  if (file.mimetype === PDF_MIME_TYPE && extension === '.pdf') {
    if (!isPdf(file.buffer)) {
      throw new UnsupportedMediaTypeError(
        'The file content is not a valid PDF document',
      );
    }
    return {
      mimeType: PDF_MIME_TYPE,
      extension: 'pdf',
      originalFilename,
      displayName: defaultDisplayName(originalFilename),
      sizeBytes: file.buffer.length,
      buffer: file.buffer,
    };
  }

  if (file.mimetype === DOCX_MIME_TYPE && extension === '.docx') {
    if (!isDocx(file.buffer)) {
      throw new UnsupportedMediaTypeError(
        'The file content is not a valid DOCX document',
      );
    }
    return {
      mimeType: DOCX_MIME_TYPE,
      extension: 'docx',
      originalFilename,
      displayName: defaultDisplayName(originalFilename),
      sizeBytes: file.buffer.length,
      buffer: file.buffer,
    };
  }

  throw new UnsupportedMediaTypeError(
    'Only PDF and DOCX documents are supported',
    { allowedMimeTypes: [...ALLOWED_MATERIAL_MIME_TYPES] },
  );
}

export function sanitizeOriginalFilename(filename: string): string {
  const safe = basename(filename ?? '').trim();

  if (!safe) {
    throw new ValidationError('The file name is required');
  }
  if (safe.length > 255) {
    throw new ValidationError('The file name must not exceed 255 characters');
  }

  return safe;
}

export function defaultDisplayName(filename: string): string {
  const name = filename
    .slice(0, filename.length - extname(filename).length)
    .trim();
  return (name || filename).slice(0, 255);
}

export function validateDisplayName(
  value: string,
  field = 'displayName',
): string {
  const normalized = value?.trim();

  if (!normalized) {
    throw new ValidationError(`${field} must not be blank`);
  }
  if (normalized.length > 255) {
    throw new ValidationError(`${field} must not exceed 255 characters`);
  }

  return normalized;
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * A DOCX file is an OOXML package: a ZIP archive that contains the mandatory
 * `[Content_Types].xml` part and a `word/` directory.
 */
function isDocx(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  const zipSignature = buffer.subarray(0, 4);
  if (
    zipSignature[0] !== 0x50 ||
    zipSignature[1] !== 0x4b ||
    zipSignature[2] !== 0x03 ||
    zipSignature[3] !== 0x04
  ) {
    return false;
  }

  return (
    buffer.includes(Buffer.from('[Content_Types].xml')) &&
    buffer.includes(Buffer.from('word/'))
  );
}
