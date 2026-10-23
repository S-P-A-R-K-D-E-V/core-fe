import { describe, expect, it } from 'vitest';

import type { IPaymentOption, IPaymentChannels } from 'src/types/online-shop';

import { initialSelection, allowedPosMethods } from 'src/components/payment-connection-select';

import { channelDraft, posDefaultChoices, togglePaymentOption } from '../settings/payment-channels-utils';

// ----------------------------------------------------------------------
// Phương thức theo kênh: bản nháp của bảng tích chọn, nguồn mặc định ở quầy, lọc phương thức ở màn bán hàng.
// ----------------------------------------------------------------------

const option = (key: string, kind: IPaymentOption['kind'], channels: IPaymentOption['channels']): IPaymentOption => ({
  key,
  kind,
  label: key,
  channels,
  autoConfirm: kind === 'transfer' && key !== 'transfer:account',
});

const data: IPaymentChannels = {
  paymentServiceEnabled: true,
  options: [
    option('cash', 'cash', ['pos']),
    option('transfer:account', 'transfer', ['pos']),
    option('transfer:apipay', 'transfer', ['pos', 'online']),
  ],
  pos: { configured: true, enabled: ['cash', 'transfer:apipay'], defaultTransfer: 'transfer:apipay' },
  online: { configured: true, enabled: ['transfer:apipay'] },
};

describe('payment channel draft', () => {
  it('tắt nguồn đang là mặc định ở quầy thì bỏ luôn mặc định; cột online độc lập', () => {
    const draft = channelDraft(data);
    expect(draft.posDefault).toBe('transfer:apipay');

    const offPos = togglePaymentOption(draft, 'pos', 'transfer:apipay');
    expect(offPos.pos).toEqual(['cash']);
    expect(offPos.posDefault).toBe('');
    expect(offPos.online).toEqual(['transfer:apipay']);

    const offOnline = togglePaymentOption(draft, 'online', 'transfer:apipay');
    expect(offOnline.online).toEqual([]);
    expect(offOnline.posDefault).toBe('transfer:apipay');
  });

  it('nguồn mặc định chọn được = lựa chọn chuyển khoản đang bật ở quầy', () => {
    expect(posDefaultChoices(data.options, ['cash', 'transfer:account']).map((o) => o.key)).toEqual(['transfer:account']);
  });
});

describe('POS theo cấu hình kênh', () => {
  const connections = [{ id: 'apipay', key: 'apipay' }, { id: 'acb', key: 'acb' }];

  it('nguồn chọn sẵn: mặc định chủ cửa hàng → máy nhớ → theo tài khoản / kết nối đầu tiên', () => {
    expect(initialSelection('acb', 'apipay', connections, true)).toBe('acb');
    expect(initialSelection(null, 'apipay', connections, true)).toBe('apipay');
    expect(initialSelection(null, 'cu', connections, true)).toBe('');
    // Tắt "theo tài khoản": mặc định '' không dùng được, máy nhớ '' cũng không → kết nối đầu tiên.
    expect(initialSelection('', '', connections, false)).toBe('apipay');
    expect(initialSelection(null, null, [], false)).toBe('');
  });

  it('lọc phương thức theo cấu hình; chưa cấu hình = như cũ; F&B gọi chuyển khoản là Transfer', () => {
    const pos = [{ value: 'Cash' }, { value: 'BankTransfer' }, { value: 'Card' }, { value: 'EWallet' }];
    expect(allowedPosMethods(pos, null)).toEqual(pos);
    expect(allowedPosMethods(pos, ['BankTransfer', 'Card']).map((m) => m.value)).toEqual(['BankTransfer', 'Card']);
    const fnb = [{ value: 'Cash' }, { value: 'Transfer' }, { value: 'Card' }];
    expect(allowedPosMethods(fnb, ['BankTransfer']).map((m) => m.value)).toEqual(['Transfer']);
  });
});
