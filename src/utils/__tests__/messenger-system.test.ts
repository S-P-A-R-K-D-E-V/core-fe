import { describe, expect, it } from 'vitest';

import type { InternalUser } from 'src/api/messenger';

import {
  isSystemUser,
  SYSTEM_USER_ID,
  isSystemUserId,
  SYSTEM_USER_NAME,
  excludeSystemUsers,
  isSystemConversation,
  resolveMessengerUser,
  incomingMessageNotice,
  messengerErrorMessage,
} from '../messenger-system';

// ----------------------------------------------------------------------
// Người gửi hệ thống của Messenger nội bộ: đúng hợp đồng với core-be — GET messenger/users trả thêm một mục
// isSystem = true (id cố định, tên "Trợ lý hệ thống", email rỗng) cho Admin / người trong kênh cảnh báo; người
// khác KHÔNG có mục đó nhưng vẫn có thể thấy tin của nó.
// ----------------------------------------------------------------------

const lan: InternalUser = {
  id: '11111111-1111-1111-1111-111111111111',
  fullName: 'Trần Thị Lan',
  email: 'lan@test.vn',
  avatarUrl: 'avatars/lan.jpg',
  online: true,
  isSystem: false,
};

const systemEntry: InternalUser = {
  id: SYSTEM_USER_ID,
  fullName: 'Trợ lý hệ thống',
  email: '',
  avatarUrl: null,
  online: false,
  isSystem: true,
};

describe('nhận diện người gửi hệ thống', () => {
  it('id hệ thống là hằng số của core-be, so không phân biệt hoa/thường', () => {
    expect(SYSTEM_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
    expect(isSystemUserId(SYSTEM_USER_ID)).toBe(true);
    expect(isSystemUserId(SYSTEM_USER_ID.toUpperCase())).toBe(true);
    expect(isSystemUserId(lan.id)).toBe(false);
    expect(isSystemUserId('')).toBe(false);
    expect(isSystemUserId(null)).toBe(false);
    expect(isSystemUserId(undefined)).toBe(false);
  });

  it('mục danh bạ: theo cờ isSystem, hoặc theo id khi máy chủ bản cũ chưa có cờ', () => {
    expect(isSystemUser(systemEntry)).toBe(true);
    expect(isSystemUser({ id: 'bot-khac', isSystem: true })).toBe(true);
    expect(isSystemUser({ id: SYSTEM_USER_ID })).toBe(true);
    expect(isSystemUser(lan)).toBe(false);
    expect(isSystemUser({ id: lan.id })).toBe(false);
    expect(isSystemUser(null)).toBe(false);
  });

  it('hội thoại hệ thống = có systemKey', () => {
    expect(isSystemConversation({ systemKey: 'admin-alerts' })).toBe(true);
    expect(isSystemConversation({ systemKey: null })).toBe(false);
    expect(isSystemConversation({})).toBe(false);
    expect(isSystemConversation(undefined)).toBe(false);
  });
});

describe('excludeSystemUsers — danh sách người để chọn', () => {
  it('bỏ người gửi hệ thống, giữ nguyên thứ tự người thật', () => {
    const hung = {
      ...lan,
      id: '22222222-2222-2222-2222-222222222222',
      fullName: 'Nguyễn Văn Hùng',
    };

    expect(excludeSystemUsers([hung, lan, systemEntry])).toEqual([hung, lan]);
    expect(excludeSystemUsers([{ ...systemEntry, isSystem: undefined }])).toEqual([]);
    expect(excludeSystemUsers([])).toEqual([]);
  });
});

describe('resolveMessengerUser — tên + avatar của người gửi', () => {
  it('người gửi hệ thống có trong danh bạ', () => {
    expect(resolveMessengerUser(SYSTEM_USER_ID, systemEntry)).toEqual({
      name: 'Trợ lý hệ thống',
      avatarUrl: null,
      isSystem: true,
    });
  });

  it('người gửi hệ thống KHÔNG có trong danh bạ → vẫn ra tên, không hiện id trần', () => {
    const fallback = { name: SYSTEM_USER_NAME, avatarUrl: null, isSystem: true };

    expect(resolveMessengerUser(SYSTEM_USER_ID, undefined)).toEqual(fallback);
    expect(resolveMessengerUser(SYSTEM_USER_ID.toUpperCase(), null)).toEqual(fallback);
    // Mục danh bạ thiếu tên cũng không làm mất tên hiển thị
    expect(resolveMessengerUser(SYSTEM_USER_ID, { ...systemEntry, fullName: '  ' })).toEqual(
      fallback
    );
  });

  it('người thường: như trước — họ tên + ảnh trong danh bạ, chưa có trong danh bạ thì hiện id', () => {
    expect(resolveMessengerUser(lan.id, lan)).toEqual({
      name: 'Trần Thị Lan',
      avatarUrl: 'avatars/lan.jpg',
      isSystem: false,
    });
    expect(resolveMessengerUser('abc', undefined)).toEqual({
      name: 'abc',
      avatarUrl: null,
      isSystem: false,
    });
  });
});

describe('incomingMessageNotice — toast trong app / thông báo desktop', () => {
  const alert = 'Chốt quầy lệch tiền\n\nQuầy thiếu 150.000đ so với sổ.';

  it('tin của người gửi hệ thống mang tên "Trợ lý hệ thống", có hay không có mục danh bạ', () => {
    const expected = { senderName: 'Trợ lý hệ thống', preview: alert, system: true };

    expect(
      incomingMessageNotice(
        { senderId: SYSTEM_USER_ID, content: alert },
        { [SYSTEM_USER_ID]: systemEntry }
      )
    ).toEqual(expected);
    expect(incomingMessageNotice({ senderId: SYSTEM_USER_ID, content: alert }, {})).toEqual(
      expected
    );
  });

  it('tin của người thường giữ như trước: họ tên, người lạ là "Tin nhắn mới", xem trước 80 ký tự', () => {
    const long = 'a'.repeat(200);

    expect(incomingMessageNotice({ senderId: lan.id, content: long }, { [lan.id]: lan })).toEqual({
      senderName: 'Trần Thị Lan',
      preview: 'a'.repeat(80),
      system: false,
    });
    expect(incomingMessageNotice({ senderId: 'nguoi-la', content: 'chào' }, {})).toEqual({
      senderName: 'Tin nhắn mới',
      preview: 'chào',
      system: false,
    });
    // Tin chỉ có tệp đính kèm: không có nội dung chữ
    expect(
      incomingMessageNotice({ senderId: lan.id, content: null }, { [lan.id]: lan }).preview
    ).toBe('');
  });
});

describe('messengerErrorMessage', () => {
  it('thao tác bị từ chối 400 { error, code } → hiện câu error của máy chủ', () => {
    expect(
      messengerErrorMessage(
        {
          error: 'Không thể gỡ Trợ lý hệ thống khỏi kênh cảnh báo của hệ thống.',
          code: 'system_sender',
        },
        'dự phòng'
      )
    ).toBe('Không thể gỡ Trợ lý hệ thống khỏi kênh cảnh báo của hệ thống.');
  });

  it('các dạng lỗi khác: lỗi ném tại chỗ, body { message }, không có body', () => {
    expect(messengerErrorMessage(new Error('Nhập UserId của đối phương'), 'dự phòng')).toBe(
      'Nhập UserId của đối phương'
    );
    expect(messengerErrorMessage({ message: 'Lỗi máy chủ' }, 'dự phòng')).toBe('Lỗi máy chủ');
    expect(messengerErrorMessage('Something went wrong', 'dự phòng')).toBe('dự phòng');
    expect(messengerErrorMessage({ error: '' }, 'dự phòng')).toBe('dự phòng');
    expect(messengerErrorMessage(undefined, 'dự phòng')).toBe('dự phòng');
  });
});
