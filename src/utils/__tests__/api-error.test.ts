import { describe, expect, it } from 'vitest';

import { hasApiErrorCode } from '../api-error';

const CODE = 'Auth.ProviderAlreadyLinked';

describe('hasApiErrorCode', () => {
  it('đọc errorCodes của Problem (409)', () => {
    expect(hasApiErrorCode({ title: 'x', status: 409, errorCodes: [CODE] }, CODE)).toBe(true);
  });

  it('đọc khoá errors của ValidationProblem', () => {
    expect(hasApiErrorCode({ title: 'x', errors: { [CODE]: ['x'] } }, CODE)).toBe(true);
  });

  it('đọc { error } của body tự viết', () => {
    expect(hasApiErrorCode({ error: CODE, message: 'x' }, CODE)).toBe(true);
  });

  it('không khớp mã khác hoặc body lạ', () => {
    expect(hasApiErrorCode({ errorCodes: ['Auth.LastSignInMethod'] }, CODE)).toBe(false);
    expect(hasApiErrorCode({ errors: { Email: ['x'] } }, CODE)).toBe(false);
    expect(hasApiErrorCode('Something went wrong', CODE)).toBe(false);
    expect(hasApiErrorCode(null, CODE)).toBe(false);
    expect(hasApiErrorCode(undefined, CODE)).toBe(false);
  });
});
