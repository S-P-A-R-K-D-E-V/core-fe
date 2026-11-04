'use client';

import type { PaymentProvider } from 'src/types/payment-service';
import type {
  IPosAccountSource,
  IKiotVietBankAccount,
  IPosAccountCapability,
} from 'src/types/corecms-api';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { paymentProviderLabel } from 'src/utils/payment-status';

import { getPosAccountCapabilities } from 'src/api/payment-qr';

// ----------------------------------------------------------------------
// Quầy chọn tài khoản nhận: S Payment cho biết tài khoản nào tiền về được tự xác nhận (Open Banking ưu tiên, rồi payOS /
// ApiPay còn hạn mức — luân phiên) và tài khoản nào thu ngân phải tự kiểm tra. Tài khoản đang chọn không tự xác nhận được mà tài khoản khác
// được → gợi ý đổi (thu ngân bấm, không tự đổi). S Payment tắt / lỗi → không hiện gì, quầy như cũ.
// ----------------------------------------------------------------------

export type AccountCapabilities = Record<string, IPosAccountCapability>;

/** @param refreshKey đổi giá trị → hỏi lại (vd sau khi thêm / tắt nguồn trên trang Tài khoản ngân hàng). */
export function useAccountCapabilities(refreshKey?: unknown): AccountCapabilities {
  const [capabilities, setCapabilities] = useState<AccountCapabilities>({});
  useEffect(() => {
    let alive = true;
    getPosAccountCapabilities()
      .then((res) => {
        if (!alive || !res.enabled) return;
        setCapabilities(Object.fromEntries((res.accounts ?? []).map((a) => [a.bankAccountId, a])));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return capabilities;
}

/** Nhãn một nguồn: "payOS 97/100 lượt", "ApiPay hết lượt (0/60)", "Open Banking (MB)". */
export function sourceLabel(s: IPosAccountSource): string {
  const name = paymentProviderLabel(s.provider as PaymentProvider);
  if (s.kind === 'bank_direct') return `Open Banking (${name})`;
  if (!s.quota) return name;
  return s.quota.remaining > 0
    ? `${name} còn ${s.quota.remaining}/${s.quota.limit}`
    : `${name} hết lượt (${s.quota.used}/${s.quota.limit})`;
}

const isAuto = (c?: IPosAccountCapability) => c?.confirmation === 'auto';

/** Nhãn ngắn của nguồn báo tiền về: "Open Banking (ACB)", "ApiPay còn 12/60". */
export function capabilityLabel(c: IPosAccountCapability): string {
  const quota = c.quota ? ` còn ${c.quota.remaining}/${c.quota.limit}` : '';
  if (c.confirmation === 'auto') {
    if (c.kind === 'bank_direct')
      return `Tự xác nhận · Open Banking (${paymentProviderLabel(c.provider as PaymentProvider)})`;
    // Nhiều nguồn còn lượt (payOS ⇄ ApiPay) → luân phiên; nhãn nêu cả vòng.
    const rotating = (c.sources ?? []).filter(
      (s) => s.kind !== 'bank_direct' && (!s.quota || s.quota.remaining > 0)
    );
    if (rotating.length > 1)
      return `Tự xác nhận · ${rotating
        .map((s) => `${paymentProviderLabel(s.provider as PaymentProvider)}${s.quota ? ` ${s.quota.remaining}/${s.quota.limit}` : ''}`)
        .join(' ⇄ ')}`;
    return `Tự xác nhận · ${paymentProviderLabel(c.provider as PaymentProvider)}${quota}`;
  }
  if (c.confirmation === 'auto_paid')
    return `Tự xác nhận · ${paymentProviderLabel(c.provider as PaymentProvider)} vượt hạn mức (tính phí)`;
  if (c.reason === 'apipay_quota_exceeded') return `Tự kiểm tra · ApiPay hết lượt${quota}`;
  if (c.reason === 'quota_exceeded') return `Tự kiểm tra · payOS hết lượt${quota}`;
  return 'Tự kiểm tra tiền về';
}

/** Chấm nhỏ trong danh sách tài khoản — chỉ cho tài khoản tự xác nhận được. */
export function AccountCapabilityTag({ capability }: { capability?: IPosAccountCapability }) {
  if (!isAuto(capability)) return null;
  return (
    <Chip
      size="small"
      color="success"
      variant="soft"
      label="Tự xác nhận"
      sx={{ ml: 'auto', height: 20 }}
    />
  );
}

type Props = {
  accounts: IKiotVietBankAccount[];
  selectedId: string;
  capabilities: AccountCapabilities;
  onSelect: (bankAccountId: string) => void;
  disabled?: boolean;
};

/** Nhãn của tài khoản đang chọn + gợi ý tài khoản tự xác nhận được (nếu tài khoản đang chọn không được). */
export default function AccountCapabilityHint({
  accounts,
  selectedId,
  capabilities,
  onSelect,
  disabled,
}: Props) {
  const current = capabilities[selectedId];
  if (!current) return null;

  const better = isAuto(current)
    ? undefined
    : accounts.find((a) => a.id !== selectedId && isAuto(capabilities[a.id]));
  const color =
    current.confirmation === 'auto'
      ? 'success'
      : current.confirmation === 'auto_paid'
        ? 'warning'
        : 'default';

  return (
    <>
      <Chip
        size="small"
        color={color}
        variant={color === 'default' ? 'outlined' : 'soft'}
        label={capabilityLabel(current)}
        sx={{ alignSelf: 'flex-start' }}
      />
      {better && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              disabled={disabled}
              onClick={() => onSelect(better.id)}
            >
              Dùng {better.shortName || better.bankName} {better.accountNumber}
            </Button>
          }
        >
          {current.reason === 'apipay_quota_exceeded'
            ? 'Tài khoản này đã hết lượt ApiPay tháng này. '
            : current.reason === 'quota_exceeded'
              ? 'Tài khoản này đã hết lượt payOS. '
              : ''}
          Tài khoản {better.shortName || better.bankName} {better.accountNumber} tự xác nhận được
          khi tiền về ({capabilityLabel(capabilities[better.id]).replace('Tự xác nhận · ', '')}).
        </Alert>
      )}
    </>
  );
}
