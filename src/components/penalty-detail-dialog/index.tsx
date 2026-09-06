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

import { getPayrollPenaltyDetails } from 'src/api/payroll';
import type { IPayrollPenaltyDetailItem, IPayrollRecord } from 'src/types/corecms-api';

// ──────────────────────────────────────────────────────────────────────────
// Popup "Chi tiết khoản phạt" — bấm vào số tiền phạt trên bảng lương để xem
// từng khoản đã cộng dồn thành PenaltyAmount (đi muộn/về sớm/vắng/quên
// checkin-checkout, phạt vệ sinh, phạt thủ công). Tự fetch dữ liệu khi mở,
// theo đúng pattern PaymentQRDialog (component tự gọi API, không cần store).
// ──────────────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

const ITEM_TYPE_ICON: Record<string, string> = {
  Penalty: 'solar:clock-circle-bold-duotone',
  ManualPenalty: 'solar:pen-bold',
  CleaningPenalty: 'solar:checklist-minimalistic-bold',
};

type Props = {
  open: boolean;
  record: IPayrollRecord | null;
  onClose: VoidFunction;
};

export default function PenaltyDetailDialog({ open, record, onClose }: Props) {
  const [items, setItems] = useState<IPayrollPenaltyDetailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!record) return;
    setLoading(true);
    setError(false);
    try {
      const data = await getPayrollPenaltyDetails(record.id);
      setItems(data);
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify icon="solar:danger-triangle-bold" width={26} sx={{ color: 'error.main' }} />
          <Box>
            <Typography variant="h6" lineHeight={1.3}>
              Chi tiết khoản phạt
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
          <Alert severity="error">Không tải được chi tiết khoản phạt.</Alert>
        ) : items.length === 0 ? (
          <Stack alignItems="center" spacing={1} py={4}>
            <Iconify icon="solar:check-circle-bold" width={40} sx={{ color: 'success.main' }} />
            <Typography variant="body2" color="text.secondary">
              Kỳ này không có khoản phạt nào.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack spacing={1.5}>
              {items.map((item) => (
                <Stack key={item.id} direction="row" spacing={1.5} alignItems="flex-start">
                  <Iconify
                    icon={ITEM_TYPE_ICON[item.itemType] || 'solar:danger-bold-duotone'}
                    width={20}
                    sx={{ color: 'error.main', mt: 0.25, flexShrink: 0 }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {item.description}
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="error.main" sx={{ whiteSpace: 'nowrap' }}>
                    -{formatCurrency(Math.abs(item.amount))}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Tổng tiền phạt</Typography>
              <Typography variant="h6" color="error.main" fontWeight={700}>
                -{formatCurrency(Math.abs(total))}
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
