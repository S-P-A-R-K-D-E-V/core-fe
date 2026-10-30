'use client';

import type { PaymentProvider } from 'src/types/payment-service';
import type { IPosAccountCapability, IKiotVietBankAccount } from 'src/types/corecms-api';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { paymentProviderLabel } from 'src/utils/payment-status';

import { getPosAccountCapabilities } from 'src/api/payment-qr';

// ----------------------------------------------------------------------
// Quầy chọn tài khoản nhận: S Payment cho biết tài khoản nào tiền về được tự xác nhận (Open Banking ưu tiên, rồi ApiPay
// còn hạn mức) và tài khoản nào thu ngân phải tự kiểm tra. Tài khoản đang chọn không tự xác nhận được mà tài khoản khác
// được → gợi ý đổi (thu ngân bấm, không tự đổi). S Payment tắt / lỗi → không hiện gì, quầy như cũ.
// ----------------------------------------------------------------------

export type AccountCapabilities = Record<string, IPosAccountCapability>;

export function useAccountCapabilities(): AccountCapabilities {
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
  }, []);
  return capabilities;
}

const isAuto = (c?: IPosAccountCapability) => c?.confirmation === 'auto';

/** Nhãn ngắn của nguồn báo tiền về: "Open Banking (ACB)", "ApiPay còn 12/60". */
export function capabilityLabel(c: IPosAccountCapability): string {
  const quota = c.quota ? ` còn ${c.quota.remaining}/${c.quota.limit}` : '';
  if (c.confirmation === 'auto') {
    return c.kind === 'bank_direct'
      ? `Tự xác nhận · Open Banking (${paymentProviderLabel(c.provider as PaymentProvider)})`
      : `Tự xác nhận · ${paymentProviderLabel(c.provider as PaymentProvider)}${quota}`;
  }
  if (c.confirmation === 'auto_paid')
    return `Tự xác nhận · ${paymentProviderLabel(c.provider as PaymentProvider)} vượt hạn mức (tính phí)`;
  return c.reason === 'apipay_quota_exceeded'
    ? `Tự kiểm tra · ApiPay hết lượt${quota}`
    : 'Tự kiểm tra tiền về';
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
            : ''}
          Tài khoản {better.shortName || better.bankName} {better.accountNumber} tự xác nhận được
          khi tiền về ({capabilityLabel(capabilities[better.id]).replace('Tự xác nhận · ', '')}).
        </Alert>
      )}
    </>
  );
}
