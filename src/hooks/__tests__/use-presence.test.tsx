import { afterEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import { SYSTEM_USER_ID } from 'src/utils/messenger-system';

import { useMessengerStore } from 'src/store/messenger-store';

import { usePresence } from '../use-presence';

// ----------------------------------------------------------------------
// usePresence nuôi danh sách "Người dùng nội bộ" ở header (bấm vào một người = mở chat riêng). Người gửi hệ
// thống nằm trong danh bạ chỉ để hiện tên ở tin cảnh báo — core-be từ chối mở chat riêng với nó — nên không
// được có trong danh sách này lẫn số người đang online.
// ----------------------------------------------------------------------

const user = (id: string, fullName: string, isSystem = false) => ({
  id,
  fullName,
  email: isSystem ? '' : `${id}@test.vn`,
  avatarUrl: null,
  online: false,
  isSystem,
});

afterEach(() => {
  useMessengerStore.setState({ userCache: {}, onlineIds: [] });
});

describe('usePresence', () => {
  it('bỏ người gửi hệ thống khỏi danh sách người dùng và số người online', () => {
    useMessengerStore.setState({
      userCache: {
        u1: user('u1', 'Trần Thị Lan'),
        u2: user('u2', 'Nguyễn Văn Hùng'),
        [SYSTEM_USER_ID]: user(SYSTEM_USER_ID, 'Trợ lý hệ thống', true),
      },
      onlineIds: ['u2', SYSTEM_USER_ID],
    });

    const { result } = renderHook(() => usePresence());

    expect(result.current.users.map((u) => u.fullName)).toEqual([
      'Trần Thị Lan',
      'Nguyễn Văn Hùng',
    ]);
    expect(result.current.users.map((u) => u.online)).toEqual([false, true]);
    expect(result.current.onlineCount).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('danh bạ chưa tải → vẫn báo đang tải như trước', () => {
    const { result } = renderHook(() => usePresence());

    expect(result.current.users).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});
