import { describe, expect, it } from 'vitest';

import { apiErrorMessage } from 'src/utils/api-error';
import { toApiError, FORBIDDEN_MESSAGE } from 'src/utils/axios';

// ----------------------------------------------------------------------
// axiosInstance reject bằng body của response — giờ kèm `status` HTTP để màn hình phân biệt được 403, và 403 body rỗng
// có thông báo tiếng Việt thay vì "Something went wrong".
// ----------------------------------------------------------------------

const err = (status: number | undefined, data?: unknown) => ({ response: status ? { status, data } : undefined });

describe('toApiError', () => {
  it('body JSON: giữ nguyên, thêm status HTTP nếu body chưa có', () => {
    expect(toApiError(err(403, { message: 'Chỉ Admin.' }))).toEqual({ message: 'Chỉ Admin.', status: 403 });
    expect(toApiError(err(400, { title: 'Sai', status: 400 }))).toEqual({ title: 'Sai', status: 400 });
  });

  it('403 body rỗng → lỗi forbidden đọc được', () => {
    const e = toApiError(err(403, ''));

    expect(e).toMatchObject({ status: 403, error: 'forbidden' });
    expect(apiErrorMessage(e, 'x')).toBe(FORBIDDEN_MESSAGE);
  });

  it('body chuỗi / Blob giữ nguyên (nơi gọi tự đọc)', () => {
    expect(toApiError(err(400, 'Invalid status'))).toBe('Invalid status');
    const blob = new Blob(['{}']);
    expect(toApiError(err(500, blob))).toBe(blob);
  });

  it('không có response (mất mạng) / lỗi khác body rỗng → giữ chuỗi cũ', () => {
    expect(toApiError(err(undefined))).toBe('Something went wrong');
    expect(toApiError(err(500, ''))).toBe('Something went wrong');
  });
});
