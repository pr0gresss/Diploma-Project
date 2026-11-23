import { MaterialUploadFieldsPipe } from './material-upload-fields.pipe.js';
import { ValidationError } from '../../common/errors/index.js';

describe('MaterialUploadFieldsPipe', () => {
  const pipe = new MaterialUploadFieldsPipe();
  it('accepts omitted fields and trims an optional name', () => {
    expect(pipe.transform(undefined)).toEqual({});
    expect(pipe.transform({ displayName: ' Lecture ' })).toEqual({ displayName: 'Lecture' });
  });
  it.each([{ displayName: '' }, { displayName: 'a'.repeat(256) }, { ownerUserId: 'other' }])(
    'rejects invalid multipart text fields %#', (value) => {
      expect(() => pipe.transform(value)).toThrow(ValidationError);
    },
  );
});
