import { HttpParams } from '@angular/common/http';

export function toHttpParams(params: object = {}): HttpParams {
  return Object.entries(params).reduce((result, [key, value]) => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return result;
    }
    if (value === '') {
      return result;
    }
    return result.set(key, value);
  }, new HttpParams());
}
