import type { PaymentChannel, IPaymentOption, IPaymentChannels } from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Bản nháp của bảng "Phương thức theo kênh" (thuần — test được).
// ----------------------------------------------------------------------

export type ChannelDraft = {
  pos: string[];
  online: string[];
  /** '' = máy quầy tự nhớ */
  posDefault: string;
};

export function channelDraft(data: IPaymentChannels): ChannelDraft {
  return {
    pos: [...data.pos.enabled],
    online: [...data.online.enabled],
    posDefault: data.pos.defaultTransfer ?? '',
  };
}

/** Bật / tắt một ô. Tắt nguồn chuyển khoản đang là mặc định ở quầy thì bỏ luôn mặc định. */
export function togglePaymentOption(draft: ChannelDraft, channel: PaymentChannel, key: string): ChannelDraft {
  const list = channel === 'pos' ? draft.pos : draft.online;
  const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  if (channel === 'online') return { ...draft, online: next };
  return { ...draft, pos: next, posDefault: next.includes(draft.posDefault) ? draft.posDefault : '' };
}

/** Nguồn chuyển khoản chọn được làm mặc định ở quầy: lựa chọn chuyển khoản đang được tích ở cột Quầy. */
export function posDefaultChoices(options: IPaymentOption[], posEnabled: string[]): IPaymentOption[] {
  return options.filter((o) => o.kind === 'transfer' && posEnabled.includes(o.key));
}
