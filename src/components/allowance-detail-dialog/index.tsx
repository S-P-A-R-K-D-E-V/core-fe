'use client';

import { useCallback, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import { getPayrollAllowanceDetails } from 'src/api/payroll';
import type { IPayrollAllowanceDetailItem, IPayrollRecord } from 'src/types/corecms-api';

// ──────────────────────────────────────────────────────────────────────────
// Popup "Chi tiết thưởng & phụ cấp" — bấm vào thưởng lễ hoặc phụ cấp trên bảng lương để xem từng khoản: thưởng lễ, bù đủ
// 300% ngày lễ, làm thêm giờ, ca đêm, làm hộ. Cùng pattern PenaltyDetailDialog (tự fetch khi mở).
// ──────────────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

const ITEM_TYPE_ICON: Record<string, string> = {
  HolidayBonus: 'solar:gift-bold-duotone',
  HolidayStatutoryTopUp: 'solar:scale-bold-duotone',
  OvertimePremium: 'solar:clock-circle-bold-duotone',
  NightPremium: 'solar:moon-bold-duotone',
  NightOvertimePremium: 'solar:moon-stars-bold-duotone',
  LateCoverPay: 'solar:users-group-rounded-bold-duotone',
  PoolCoverPay: 'solar:users-group-rounded-bold-duotone',
};

type Props = {
  open: boolean;
  record: IPayrollRecord | null;
  onClose: VoidFunction;
};

export default function AllowanceDetailDialog({ open, record, onClose }: Props) {
  const [items, setItems] = useState<IPayrollAllowanceDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setError(false);
    try {
      setItems(await getPayrollAllowanceDetails(record.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [record]);

  useEffect(() => {
    if (open && record) {
      setItems([]);
      fetchDetails();
    }
  }, [open, record, fetchDetails]);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify icon="solar:wallet-money-bold" width={26} sx={{ color: 'success.main' }} />
          <Box>
            <Typography variant="h6" lineHeight={1.3}>
              Chi tiết thưởng & phụ cấp
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {record?.userName} — kỳ {record?.periodMonth}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={5}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Alert severity="error">Không tải được chi tiết thưởng & phụ cấp.</Alert>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            Kỳ này không có thưởng hay phụ cấp nào.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Stack spacing={1.5}>
              {items.map((item) => (
                <Stack key={item.id} direction="row" spacing={1.5} alignItems="flex-start">
                  <Iconify
                    icon={ITEM_TYPE_ICON[item.itemType] || 'solar:wallet-money-bold-duotone'}
                    width={20}
                    sx={{ color: 'success.main', mt: 0.25, flexShrink: 0 }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.description}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="success.main" sx={{ whiteSpace: 'nowrap' }}>
                    +{formatCurrency(item.amount)}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Tổng thưởng & phụ cấp</Typography>
              <Typography variant="h6" color="success.main" fontWeight={700}>
                +{formatCurrency(total)}
              </Typography>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
