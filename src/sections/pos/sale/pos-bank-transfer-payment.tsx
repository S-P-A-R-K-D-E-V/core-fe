'use client';

import { useState, useEffect, useMemo } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';
import { getBankAccounts } from 'src/api/bank-accounts';
import { IKiotVietBankAccount, IQrPaymentStatusResponse } from 'src/types/corecms-api';

import PosAcbQrPayment from './pos-acb-qr-payment';

// ----------------------------------------------------------------------

const ACB_BIN = '970416';

// Tài khoản ACB mặc định (cấu hình OpenBanking phía backend) — luôn có mặt
// kể cả khi danh sách tài khoản KiotViet chưa có tài khoản ACB
const ACB_DEFAULT_OPTION_ID = 'acb-openbanking-default';

type BankOption = {
  id: string;
  label: string;
  accountNumber?: string;
  bankName?: string;
  supportsDynamicQr: boolean;
};

type Props = {
  amount: number;
  salesOrderId?: string;
  orderCode?: string;
  onPaymentCompleted?: (qrOrder: IQrPaymentStatusResponse) => void;
};

function isAcbAccount(acc: IKiotVietBankAccount): boolean {
  if (acc.bin === ACB_BIN) return true;
  const text = `${acc.code || ''} ${acc.shortName || ''} ${acc.bankName || ''}`.toUpperCase();
  return text.includes('ACB');
}

export default function PosBankTransferPayment({
  amount,
  salesOrderId,
  orderCode,
  onPaymentCompleted,
}: Props) {
  const [accounts, setAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    let active = true;
    getBankAccounts()
      .then((list) => {
        if (active) setAccounts(list);
      })
      .catch(() => {
        // Không tải được danh sách — vẫn dùng được tài khoản ACB mặc định
      });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo<BankOption[]>(() => {
    const mapped: BankOption[] = accounts.map((acc) => ({
      id: acc.id,
      label: `${acc.shortName || acc.bankName || acc.code || 'Ngân hàng'}${
        acc.accountNumber ? ` — ${acc.accountNumber}` : ''
      }`,
      accountNumber: acc.accountNumber,
      bankName: acc.bankName || acc.shortName,
      supportsDynamicQr: isAcbAccount(acc),
    }));

    // Đảm bảo luôn có lựa chọn ACB QR động
    if (!mapped.some((o) => o.supportsDynamicQr)) {
      mapped.unshift({
        id: ACB_DEFAULT_OPTION_ID,
        label: 'ACB — Tài khoản QR động',
        supportsDynamicQr: true,
      });
    }
    return mapped;
  }, [accounts]);

  // Mặc định chọn tài khoản ACB (QR động) đầu tiên
  useEffect(() => {
    if (!selectedId && options.length > 0) {
      const acb = options.find((o) => o.supportsDynamicQr) || options[0];
      setSelectedId(acb.id);
    }
  }, [options, selectedId]);

  const selected = options.find((o) => o.id === selectedId);

  return (
    <Stack spacing={1}>
      <TextField
        select
        fullWidth
        size="small"
        label="Tài khoản ngân hàng"
        value={options.some((o) => o.id === selectedId) ? selectedId : ''}
        onChange={(e) => setSelectedId(e.target.value)}
      >
        {options.map((o) => (
          <MenuItem key={o.id} value={o.id}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
              <Iconify icon="solar:card-bold" width={16} />
              <span style={{ flexGrow: 1 }}>{o.label}</span>
              {o.supportsDynamicQr && (
                <Chip label="QR động" color="primary" size="small" sx={{ height: 20 }} />
              )}
            </Stack>
          </MenuItem>
        ))}
      </TextField>

      {selected?.supportsDynamicQr && (
        <PosAcbQrPayment
          amount={amount}
          salesOrderId={salesOrderId}
          orderCode={orderCode}
          onPaymentCompleted={onPaymentCompleted}
        />
      )}

      {selected && !selected.supportsDynamicQr && (
        <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'background.neutral' }}>
          <Typography variant="body2" fontWeight={600}>
            {selected.bankName}
          </Typography>
          {selected.accountNumber && (
            <Typography variant="body2">STK: {selected.accountNumber}</Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            Tài khoản chưa kết nối OpenBanking — khách chuyển khoản thủ công, nhập mã giao dịch để
            đối chiếu.
          </Typography>
        </Box>
      )}
    </Stack>
  );
}
