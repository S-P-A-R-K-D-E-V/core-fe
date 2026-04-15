'use client';

import { useState, useEffect, useMemo } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';

import { useTheme } from '@mui/material/styles';

import { fCurrency } from 'src/utils/format-number';
import { getBankAccounts, getVietQRBanks } from 'src/api/bank-accounts';
import { IKiotVietBankAccount, IVietQRBank } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  amount: number;
  orderCode?: string;
};

export default function PosQrPayment({ amount, orderCode }: Props) {
  const theme = useTheme();
  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);
  const [vietQRBanks, setVietQRBanks] = useState<IVietQRBank[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getBankAccounts(), getVietQRBanks()])
      .then(([accounts, banks]) => {
        setBankAccounts(accounts);
        setVietQRBanks(banks);
        if (accounts.length > 0) {
          setSelectedAccountId(accounts[0].id); // Guid string, dùng để chọn TK hiển thị QR
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedAccount = useMemo(
    () => bankAccounts.find((a) => a.id === selectedAccountId),
    [bankAccounts, selectedAccountId]
  );

  // Find logo from VietQR banks using bin/code/shortName
  const matchedLogo = useMemo(() => {
    if (!selectedAccount) return '';
    const match = vietQRBanks.find(
      (b) =>
        (selectedAccount.bin && b.bin === selectedAccount.bin) ||
        (selectedAccount.code && b.code.toLowerCase() === selectedAccount.code.toLowerCase()) ||
        (selectedAccount.shortName && b.shortName.toLowerCase() === selectedAccount.shortName.toLowerCase())
    );
    return match?.logo || '';
  }, [selectedAccount, vietQRBanks]);

  // Build QR URL using bin from the bank account entity directly
  const qrUrl = useMemo(() => {
    if (!selectedAccount?.accountNumber || !selectedAccount?.bin) return '';
    const description = encodeURIComponent(
      `Thanh toan ${orderCode || 'don hang'}`
    );
    return `https://img.vietqr.io/image/${selectedAccount.bin}-${selectedAccount.accountNumber}-compact2.png?amount=${amount}&addInfo=${description}&accountName=${encodeURIComponent(selectedAccount.description || '')}`;
  }, [selectedAccount, amount, orderCode]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size={24} />
      </Stack>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        Chưa có tài khoản ngân hàng. Vui lòng cấu hình trong KiotViet.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Bank account selector */}
      <TextField
        select
        fullWidth
        size="small"
        label="Tài khoản ngân hàng"
        value={selectedAccountId}
        onChange={(e) => {
          setSelectedAccountId(e.target.value);
        }}
        sx={{ mb: 1.5 }}
      >
        {bankAccounts.map((acc) => {
          const logo = vietQRBanks.find(
            (b) =>
              (acc.bin && b.bin === acc.bin) ||
              (acc.code && b.code.toLowerCase() === acc.code.toLowerCase())
          )?.logo;
          return (
            <MenuItem key={acc.id} value={acc.id}>
              <Stack direction="row" alignItems="center" spacing={1}>
                {logo && (
                  <Box
                    component="img"
                    src={logo}
                    alt={acc.shortName || acc.bankName}
                    sx={{ width: 24, height: 24, borderRadius: 0.5 }}
                  />
                )}
                <span>
                  {acc.shortName || acc.bankName} - {acc.accountNumber}
                  {acc.description ? ` - ${acc.description}` : ''}
                </span>
              </Stack>
            </MenuItem>
          );
        })}
      </TextField>

      {/* QR Code */}
      {qrUrl && amount > 0 && (
        <Stack alignItems="center" spacing={1}>
          <Box
            component="img"
            src={qrUrl}
            alt="QR Code thanh toán"
            sx={{
              width: 220,
              height: 220,
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {selectedAccount?.shortName || selectedAccount?.bankName} - {selectedAccount?.accountNumber}
          </Typography>
          <Typography variant="subtitle2" color="primary.main">
            {fCurrency(amount)}
          </Typography>
        </Stack>
      )}
      {!qrUrl && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', py: 1 }}>
          Không thể tạo mã QR cho tài khoản này
        </Typography>
      )}
    </Box>
  );
}
