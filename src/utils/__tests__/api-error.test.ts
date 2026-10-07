import { describe, expect, it } from 'vitest';

import { apiErrorMessage, hasApiErrorCode } from '../api-error';

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

describe('apiErrorMessage', () => {
  it('không in trang HTML (đường không được proxy sang BE) ra toast', () => {
    expect(apiErrorMessage('<!DOCTYPE html><html><title>404</title></html>', 'Không tải được')).toBe('Không tải được');
    expect(apiErrorMessage('  <html></html>', 'Lỗi')).toBe('Lỗi');
  });

  it('giữ thông báo dạng chữ và mô tả của Problem', () => {
    expect(apiErrorMessage('Something went wrong', 'Lỗi')).toBe('Something went wrong');
    expect(apiErrorMessage({ title: 'Không tìm thấy chi nhánh.', status: 404 }, 'Lỗi')).toBe('Không tìm thấy chi nhánh.');
  });
});
