'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { fCurrency } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import { getFailedPushes } from 'src/api/kiotviet';
import { retryPushSalesOrder } from 'src/api/sales-orders';

import type { IKiotVietFailedPush } from 'src/types/corecms-api';

export default function KiotVietPendingPushTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [orders, setOrders] = useState<IKiotVietFailedPush[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getFailedPushes();
      setOrders(page.data);
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Không tải được danh sách đơn chờ đẩy', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetry = useCallback(
    async (id: string) => {
      setRetryingId(id);
      try {
        await retryPushSalesOrder(id);
        enqueueSnackbar('Đã gửi yêu cầu đồng bộ lại', { variant: 'success' });
        fetchData();
      } catch (error: any) {
        enqueueSnackbar(error?.message || 'Không thể đồng bộ lại', { variant: 'error' });
      } finally {
        setRetryingId(null);
      }
    },
    [enqueueSnackbar, fetchData]
  );

  return (
    <Card sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Đơn chờ đẩy lên KiotViet</Typography>
          <Typography variant="body2" color="text.secondary">
            Đơn bán tạo trên Cici POS đang đẩy lỗi lên KiotViet (thường do sản phẩm chưa liên kết KiotViet)
          </Typography>
        </Box>
        <Tooltip title="Làm mới">
          <IconButton onClick={fetchData}>
            <Iconify icon="solar:refresh-bold" />
          </IconButton>
        </Tooltip>
      </Stack>

      {!loading && orders.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          Không có đơn nào đang lỗi đồng bộ 🎉
        </Typography>
      )}

      <Stack divider={<Divider flexItem />}>
        {orders.map((order) => (
          <Stack key={order.id} direction="row" alignItems="center" spacing={2} sx={{ py: 1.25 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" fontWeight={600}>
                  {order.code}
                </Typography>
                <Label variant="soft" color="error">
                  Lần {order.kiotVietSyncAttempts}
                </Label>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {order.customerName || 'Khách lẻ'} · {fCurrency(order.total)} · {fDateTime(order.createdDate)}
              </Typography>
              {order.kiotVietSyncError && (
                <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                  {order.kiotVietSyncError}
                </Typography>
              )}
            </Box>
            <Tooltip title="Đẩy lại lên KiotViet">
              <IconButton
                color="primary"
                disabled={retryingId === order.id}
                onClick={() => handleRetry(order.id)}
              >
                <Iconify icon="solar:refresh-bold" />
              </IconButton>
            </Tooltip>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
