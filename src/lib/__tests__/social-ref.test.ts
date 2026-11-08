import { it, expect, describe, beforeEach } from 'vitest';

import {
  readSocialRef,
  captureSocialRef,
  SOCIAL_REF_TTL_MS,
  normalizeSocialRef,
  SOCIAL_REF_STORAGE_KEY,
} from '../social-ref';

// ----------------------------------------------------------------------
// Mã nguồn bài đăng: chỉ nhận mã đúng dạng, nhớ 30 ngày, lần bấm sau cùng thắng.

describe('social-ref', () => {
  beforeEach(() => window.localStorage.clear());

  it('chỉ nhận mã 8 ký tự đúng bảng chữ', () => {
    expect(normalizeSocialRef(' ABCD2345 ')).toBe('abcd2345');
    expect(normalizeSocialRef('abcd234')).toBeNull();
    expect(normalizeSocialRef('abcd2340')).toBeNull(); // 0 không có trong bảng chữ
    expect(normalizeSocialRef(null)).toBeNull();
  });

  it('nhớ mã từ ?r= và hết hạn sau 30 ngày', () => {
    const now = 1_000_000;
    expect(captureSocialRef('?x=1&r=abcd2345', now)).toBe('abcd2345');
    expect(readSocialRef(now + SOCIAL_REF_TTL_MS - 1)).toBe('abcd2345');
    expect(readSocialRef(now + SOCIAL_REF_TTL_MS + 1)).toBeNull();
  });

  it('địa chỉ không có mã thì giữ mã cũ; mã mới thay mã cũ', () => {
    captureSocialRef('?r=abcd2345', 1);
    expect(captureSocialRef('?q=kep', 2)).toBeNull();
    expect(readSocialRef(3)).toBe('abcd2345');
    captureSocialRef('?r=zzzz9999', 4);
    expect(readSocialRef(5)).toBe('zzzz9999');
  });

  it('dữ liệu hỏng trong bộ nhớ thì bỏ qua', () => {
    window.localStorage.setItem(SOCIAL_REF_STORAGE_KEY, '{oops');
    expect(readSocialRef()).toBeNull();
  });
});
