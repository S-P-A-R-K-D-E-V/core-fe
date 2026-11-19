import { describe, expect, it } from 'vitest';

import { agentAdminAppLink, agentAdminWebLink, agentAdminLinkState } from '../links';

// ----------------------------------------------------------------------

describe('link nhóm quản trị (A3)', () => {
  const id = '3f2a9c1e-0000-4000-8000-000000000001';

  it('mở trong app bằng scheme app cửa hàng, màn chat/[id]', () => {
    expect(agentAdminAppLink(id)).toBe(`sparkstore://chat/${id}`);
  });

  it('mở trên web vào Messenger với ?c=', () => {
    expect(agentAdminWebLink(id)).toBe(`/dashboard/messenger?c=${id}`);
  });

  it('mã hoá id lạ', () => {
    expect(agentAdminAppLink('a b/c')).toBe('sparkstore://chat/a%20b%2Fc');
    expect(agentAdminWebLink('a&b')).toBe('/dashboard/messenger?c=a%26b');
  });
});

describe('agentAdminLinkState', () => {
  it('đang tải', () => {
    expect(agentAdminLinkState({ loading: true })).toBe('loading');
    expect(agentAdminLinkState({ loading: false, info: undefined })).toBe('loading');
  });

  it('có nhóm → ready', () => {
    expect(
      agentAdminLinkState({ loading: false, info: { conversationId: 'c1', enabled: true } })
    ).toBe('ready');
  });

  it('chưa tạo / tính năng tắt / 404 → missing', () => {
    expect(
      agentAdminLinkState({ loading: false, info: { conversationId: null, enabled: true } })
    ).toBe('missing');
    expect(
      agentAdminLinkState({ loading: false, info: { conversationId: 'c1', enabled: false } })
    ).toBe('missing');
    expect(agentAdminLinkState({ loading: false, error: { status: 404 } })).toBe('missing');
  });

  it('403 → forbidden, lỗi khác → error', () => {
    expect(agentAdminLinkState({ loading: false, error: { status: 403 } })).toBe('forbidden');
    expect(agentAdminLinkState({ loading: false, error: 'Something went wrong' })).toBe('error');
  });
});
