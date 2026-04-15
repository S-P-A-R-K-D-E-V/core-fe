'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';

import Iconify from 'src/components/iconify';
import { IKiotVietBankAccount, PaymentMethod, TaxReportQuery } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const PAYMENT_METHODS: { label: string; value: PaymentMethod | '' }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'Tiền mặt', value: 'Cash' },
  { label: 'Thẻ', value: 'Card' },
  { label: 'Chuyển khoản', value: 'Transfer' },
  { label: 'Voucher KiotViet', value: 'KiotVietVoucher' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2020 + 2 }, (_, i) => 2020 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

// ----------------------------------------------------------------------

interface Props {
  query: TaxReportQuery;
  onChange: (q: TaxReportQuery) => void;
  onView: () => void;
  onExport: () => void;
  bankAccounts: IKiotVietBankAccount[];
  loadingView: boolean;
  loadingExport: boolean;
}

export default function TaxReportFilter({
  query,
  onChange,
  onView,
  onExport,
  bankAccounts,
  loadingView,
  loadingExport,
}: Props) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          flexWrap="wrap"
          useFlexGap
        >
          {/* Tháng */}
          <TextField
            select
            label="Tháng"
            value={query.month}
            onChange={(e) => onChange({ ...query, month: Number(e.target.value) })}
            size="small"
            sx={{ minWidth: 100 }}
          >
            {MONTHS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>

          {/* Năm */}
          <TextField
            select
            label="Năm"
            value={query.year}
            onChange={(e) => onChange({ ...query, year: Number(e.target.value) })}
            size="small"
            sx={{ minWidth: 110 }}
          >
            {YEARS.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
          </TextField>

          {/* Phương thức thanh toán */}
          <TextField
            select
            label="Phương thức thanh toán"
            value={query.paymentMethod ?? ''}
            onChange={(e) =>
              onChange({
                ...query,
                paymentMethod: (e.target.value as PaymentMethod) || undefined,
              })
            }
            size="small"
            sx={{ minWidth: 200 }}
          >
            {PAYMENT_METHODS.map((pm) => (
              <MenuItem key={pm.value} value={pm.value}>
                {pm.label}
              </MenuItem>
            ))}
          </TextField>

          {/* Tài khoản nhận tiền — value là kiotVietId (int) để khớp với BE filter */}
          <TextField
            select
            label="Tài khoản nhận tiền"
            value={query.bankAccountId ?? ''}
            onChange={(e) =>
              onChange({
                ...query,
                bankAccountId: e.target.value !== '' ? Number(e.target.value) : undefined,
              })
            }
            size="small"
            sx={{ minWidth: 240 }}
          >
            <MenuItem value="">Tất cả tài khoản</MenuItem>
            {bankAccounts
              .filter((ba) => ba.kiotVietId != null)
              .map((ba) => (
                <MenuItem key={ba.kiotVietId} value={ba.kiotVietId!}>
                  {ba.bankName ?? ba.shortName ?? `TK #${ba.kiotVietId}`}
                  {ba.accountNumber ? ` — ${ba.accountNumber}` : ''}
                </MenuItem>
              ))}
          </TextField>

          {/* Buttons */}
          <Stack direction="row" spacing={1} sx={{ ml: { sm: 'auto' } }}>
            <Button
              variant="contained"
              onClick={onView}
              disabled={loadingView}
              startIcon={<Iconify icon="solar:eye-bold" />}
            >
              Xem báo cáo
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={onExport}
              disabled={loadingExport}
              startIcon={<Iconify icon="vscode-icons:file-type-excel" />}
            >
              Xuất Excel
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
