// @vitest-environment node
import { it, expect, describe } from 'vitest';

import { countLinks, isEditable, type SocialPost, isValidThreadsAppId } from 'src/lib/social';
import { requiredPermissionsFor } from 'src/auth/route-roles';
import { paths } from 'src/routes/paths';

import { socialPostListKey } from '../social';

// ----------------------------------------------------------------------
// Bán hàng online: khoá danh sách bài, đếm link (Threads ≤ 5), bài nào còn sửa được, quyền theo trang.

const post = (over: Partial<SocialPost>): SocialPost => ({
  id: 'p',
  text: '',
  imageUrls: [],
  productId: null,
  status: 'scheduled',
  scheduledAt: null,
  publishedAt: null,
  createdByName: null,
  createdAt: '',
  updatedAt: '',
  targets: [],
  ...over,
});

describe('social api / helpers', () => {
  it('khoá danh sách bỏ status=all và trang 1', () => {
    expect(socialPostListKey('all', 1)).toBe('/social/posts');
    expect(socialPostListKey('failed', 2)).toBe('/social/posts?status=failed&page=2');
  });

  it('đếm link http/https', () => {
    expect(countLinks('xem https://cici21chualang.vn và http://a.test, không tính cici.vn')).toBe(2);
  });

  it('bài đã có kênh bắt đầu đăng thì không sửa được', () => {
    const target = { id: 't', channelId: 'c', channelUsername: 'cici', platform: 'threads', permalink: null, lastError: null, attempts: 0, publishedAt: null };
    expect(isEditable(post({ targets: [{ ...target, status: 'pending' }] }))).toBe(true);
    expect(isEditable(post({ targets: [{ ...target, status: 'publishing' }] }))).toBe(false);
    expect(isEditable(post({ status: 'published' }))).toBe(false);
  });

  it('trang Kênh kết nối cần social.channels, trang bài đăng cần social.posts', () => {
    expect(requiredPermissionsFor(paths.dashboard.social.channels)).toEqual(['social.channels']);
    expect(requiredPermissionsFor(paths.dashboard.social.new)).toEqual(['social.posts']);
    expect(requiredPermissionsFor(paths.dashboard.social.settings)).toEqual(['social.channels']);
  });

  it('Threads app ID phải là dãy số', () => {
    expect(isValidThreadsAppId(' 2418901455589871 ')).toBe(true);
    expect(isValidThreadsAppId('1234')).toBe(false);
    expect(isValidThreadsAppId('abc123456')).toBe(false);
  });
});
