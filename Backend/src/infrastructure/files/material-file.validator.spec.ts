import {
  validateMaterialFile,
  validateDisplayName,
  sanitizeOriginalFilename,
  defaultDisplayName,
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
  MAX_MATERIAL_SIZE_BYTES,
} from './material-file.validator.js';

describe('material file validation', () => {
  const file = (
    buffer: Buffer,
    originalname = 'notes.pdf',
    mimetype = PDF_MIME_TYPE,
  ) => ({
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
  });
  it('accepts PDF signatures and normalizes display names', () => {
    expect(validateMaterialFile(file(Buffer.from('%PDF-1.7')))).toMatchObject({
      extension: 'pdf',
      displayName: 'notes',
      sizeBytes: 8,
    });
    expect(defaultDisplayName('.pdf')).toBe('.pdf');
    expect(validateDisplayName(' Notes ')).toBe('Notes');
    expect(sanitizeOriginalFilename('notes.pdf')).toBe('notes.pdf');
  });
  it('accepts a DOCX package signature with expected parts', () => {
    const buffer = Buffer.concat([
      Buffer.from([0x50, 0x4b, 3, 4]),
      Buffer.from('[Content_Types].xml word/document.xml'),
    ]);
    expect(
      validateMaterialFile(file(buffer, 'notes.docx', DOCX_MIME_TYPE))
        .extension,
    ).toBe('docx');
  });
  it.each([
    Buffer.alloc(0),
    Buffer.from('invalid'),
    Buffer.from('PK'),
    Buffer.from([0x50, 0x4b, 3, 4]),
    Buffer.from('not zip [Content_Types].xml word/'),
  ])('rejects malformed DOCX bytes %#', (buffer) => {
    expect(() =>
      validateMaterialFile(file(buffer, 'notes.docx', DOCX_MIME_TYPE)),
    ).toThrow();
  });
  it('rejects missing files, oversized content and mismatched types', () => {
    expect(() => validateMaterialFile(undefined as never)).toThrow();
    expect(() =>
      validateMaterialFile(file(Buffer.alloc(MAX_MATERIAL_SIZE_BYTES + 1))),
    ).toThrow();
    expect(() => validateMaterialFile(file(Buffer.from('not PDF')))).toThrow();
    expect(() =>
      validateMaterialFile(file(Buffer.from('%PDF-1.7'), 'notes.exe')),
    ).toThrow();
    expect(() =>
      validateMaterialFile(
        file(Buffer.from('%PDF-1.7'), 'notes.pdf', 'text/plain'),
      ),
    ).toThrow();
  });
  it.each(['', ' ', 'a'.repeat(256)])(
    'rejects blank and oversized names',
    (name) => {
      expect(() => validateDisplayName(name)).toThrow();
      expect(() => sanitizeOriginalFilename(name)).toThrow();
    },
  );
});
