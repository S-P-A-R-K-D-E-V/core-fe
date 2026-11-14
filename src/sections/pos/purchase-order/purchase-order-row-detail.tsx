'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { IShareholder, IPurchaseOrder, IPurchaseOrderCapabilities } from 'src/types/corecms-api';
import { cancelPurchaseOrder, completePurchaseOrder } from 'src/api/purchase-orders';

import { PurchaseOrderPrintButton } from './purchase-order-print';
import { lockedByPaidBy, type PurchaseAccess } from './purchase-access';
import { purchaseStatusMeta, purchaseSubTotal, receivedQuantityOf } from './purchase-status';

// ----------------------------------------------------------------------
// Chi tiết phiếu nhập mở ngay dưới dòng của danh sách (như KiotViet): thông tin, các dòng hàng, tổng, đã trả / còn nợ,
// và thao tác nhanh — Mở phiếu, Sửa, Hoàn thành, Sao chép, Huỷ.
// ----------------------------------------------------------------------

const fmtQty = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 });

type Props = {
  order: IPurchaseOrder;
  access: PurchaseAccess;
  capabilities: IPurchaseOrderCapabilities | null;
  onChanged: () => void;
  /** Chọn "ai chi hộ" ngay tại đây (chỉ khi được ghi chi hộ cho phiếu này). */
  paidBy?: { shareholders: IShareholder[]; saving: boolean; onChange: (shareholderId: string) => void };
};

export default function PurchaseOrderRowDetail({ order, access, capabilities, onChanged, paidBy }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [lineFilter, setLineFilter] = useState('');
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);

  const status = purchaseStatusMeta(order.status);
  const subTotal = purchaseSubTotal(order);
  const isOpen = ['Draft', 'Confirmed', 'PartiallyReceived'].includes(order.status);
  const paidByLocked = lockedByPaidBy(access, order);
  const canEdit = order.status === 'Draft' && access.canUpdate && !paidByLocked;
  const canCancel = order.status === 'Draft' && access.canCancel && !paidByLocked;
  const canComplete = isOpen && !!capabilities?.canComplete;
  const totalQuantity = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);

  const lines = useMemo(() => {
    const q = lineFilter.trim().toLowerCase();
    if (!q) return order.items || [];
    return (order.items || []).filter(
      (i) => i.productCode?.toLowerCase().includes(q) || i.productName?.toLowerCase().includes(q)
    );
  }, [order.items, lineFilter]);

  const run = async (kind: 'complete' | 'cancel') => {
    setBusy(true);
    try {
      if (kind === 'cancel') {
        await cancelPurchaseOrder(order.id);
        enqueueSnackbar(`Đã huỷ ${order.orderNumber}`);
      } else {
        const result = await completePurchaseOrder({ existingOrderId: order.id });
        if (result.completed) {
          enqueueSnackbar(
            result.kiotVietCode
              ? `Đã nhập hàng ${result.orderNumber} — KiotViet ${result.kiotVietCode}`
              : `Đã nhập hàng ${result.orderNumber}`
          );
        } else {
          enqueueSnackbar(`Chưa hoàn thành ${result.orderNumber}: ${result.kiotVietError}`, {
            variant: 'warning',
            autoHideDuration: 10000,
          });
        }
      }
      setConfirm(null);
      onChanged();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, kind === 'cancel' ? 'Không huỷ được phiếu' : 'Không hoàn thành được phiếu'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const meta = (label: string, value: React.ReactNode) => (
    <Stack direction="row" spacing={1} sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, minWidth: 96 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
        {value || '—'}
      </Typography>
    </Stack>
  );

  const total = (label: string, value: string, strong?: boolean) => (
    <Stack direction="row" justifyContent="space-between" spacing={3}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: strong ? 600 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500 }}>
        {value}
      </Typography>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: 'background.paper', borderLeft: (t) => `3px solid ${t.palette.primary.main}` }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h6">{order.orderNumber}</Typography>
        <Label variant="soft" color={status.color}>
          {status.label}
        </Label>
        <Box sx={{ flex: 1 }} />
        {(order.branchName || order.warehouseName) && (
          <Typography variant="body2" color="text.secondary">
            {order.branchName || order.warehouseName}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          mb: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' },
        }}
      >
        {meta('Nhà cung cấp', order.supplierName)}
        {meta('Ngày tạo', fDateTime(order.createdAt))}
        {meta('Người tạo', order.createdByName)}
        {order.expectedDate && meta('Ngày nhập', fDateTime(order.expectedDate))}
        {order.approvedByName && meta('Người duyệt', order.approvedByName)}
        {!paidBy && order.paidByShareholderName && meta('Ai chi hộ', order.paidByShareholderName)}
        {paidBy && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 96 }}>
              Ai chi hộ
            </Typography>
            <TextField
              select
              size="small"
              value={order.paidByShareholderId || ''}
              onChange={(e) => paidBy.onChange(e.target.value)}
              disabled={paidBy.saving}
              sx={{ minWidth: 180 }}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">— Cửa hàng tự trả —</MenuItem>
              {paidBy.shareholders.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        )}
      </Box>

      {(order.items?.length ?? 0) > 8 && (
        <TextField
          size="small"
          placeholder="Tìm mã / tên hàng trong phiếu"
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          sx={{ mb: 1, width: { xs: 1, sm: 320 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      )}

      <Box sx={{ overflowX: 'auto', maxHeight: 420, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 1 }}>
        <Table size="small" stickyHeader sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 120 }}>Mã hàng</TableCell>
              <TableCell>Tên hàng</TableCell>
              <TableCell align="right" sx={{ width: 90 }}>
                SL
              </TableCell>
              <TableCell align="right" sx={{ width: 120 }}>
                Đơn giá
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Giảm giá
              </TableCell>
              <TableCell align="right" sx={{ width: 130 }}>
                Thành tiền
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((item) => {
              const received = receivedQuantityOf(order.status, item);
              const partial = !['Completed', 'Returned', 'Draft', 'Cancelled'].includes(order.status) && received < item.quantity;
              return (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 500 }}>{item.productCode}</TableCell>
                  <TableCell>
                    {item.productName}
                    {item.variantName && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        ({item.variantName})
                      </Typography>
                    )}
                    {item.note && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontStyle: 'italic' }}>
                        {item.note}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {fmtQty(item.quantity)}
                    {item.unitName ? ` ${item.unitName}` : ''}
                    {partial && (
                      <Typography variant="caption" color="warning.main" display="block">
                        đã nhận {fmtQty(received)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{fCurrency(item.unitPrice)}</TableCell>
                  <TableCell align="right">{item.discountAmount ? fCurrency(item.discountAmount) : '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {fCurrency(item.totalPrice)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 2 }}>
        <Box sx={{ flex: 1 }}>
          {order.note && (
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>
                Ghi chú:{' '}
              </Box>
              {order.note}
            </Typography>
          )}
        </Box>
        <Stack spacing={0.75} sx={{ minWidth: { md: 300 } }}>
          {total(`Tổng tiền hàng (${order.items?.length ?? 0} dòng · SL ${fmtQty(totalQuantity)})`, fCurrency(subTotal))}
          {order.vatAmount > 0 && total('VAT', fCurrency(order.vatAmount))}
          {order.discountAmount > 0 && total('Giảm giá', `-${fCurrency(order.discountAmount)}`)}
          {total('Tổng cộng', fCurrency(order.totalAmount), true)}
          {order.paidAmount !== undefined && total('Đã trả NCC', fCurrency(order.paidAmount))}
          {!!order.remainingAmount && order.status !== 'Cancelled' && total('Còn nợ NCC', fCurrency(order.remainingAmount), true)}
        </Stack>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end" sx={{ mt: 2 }}>
        {canCancel && (
          <Button color="error" startIcon={<Iconify icon="solar:trash-bin-trash-outline" />} onClick={() => setConfirm('cancel')}>
            Huỷ phiếu
          </Button>
        )}
        {access.canCreate && (
          <Button
            color="inherit"
            variant="outlined"
            startIcon={<Iconify icon="solar:copy-outline" />}
            onClick={() => router.push(`${paths.dashboard.pos.purchaseOrder.new}?copy=${order.id}`)}
          >
            Sao chép
          </Button>
        )}
        {canEdit && (
          <Button
            variant="outlined"
            startIcon={<Iconify icon="solar:pen-outline" />}
            onClick={() => router.push(paths.dashboard.pos.purchaseOrder.edit(order.id))}
          >
            Sửa
          </Button>
        )}
        <PurchaseOrderPrintButton orderId={order.id} orderNumber={order.orderNumber} />
        <Button
          variant={canComplete ? 'outlined' : 'contained'}
          startIcon={<Iconify icon="solar:square-top-down-outline" />}
          onClick={() => router.push(paths.dashboard.pos.purchaseOrder.details(order.id))}
        >
          Mở phiếu
        </Button>
        {canComplete && (
          <Button variant="contained" startIcon={<Iconify icon="eva:checkmark-circle-2-fill" />} onClick={() => setConfirm('complete')}>
            Hoàn thành
          </Button>
        )}
      </Stack>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => {
          if (!busy) setConfirm(null);
        }}
        cancelText="Đóng"
        title={confirm === 'cancel' ? `Huỷ phiếu ${order.orderNumber}?` : `Hoàn thành phiếu ${order.orderNumber}?`}
        content={
          confirm === 'cancel'
            ? 'Phiếu tạm sẽ chuyển sang Đã huỷ.'
            : capabilities?.kiotVietConnected
              ? `Nhập ${order.items?.length ?? 0} dòng hàng, ${fCurrency(order.totalAmount)}. Phiếu được tạo bên KiotViet ở trạng thái "Đã nhập hàng" — tồn kho KiotViet cập nhật ngay.`
              : `Nhập ${order.items?.length ?? 0} dòng hàng, ${fCurrency(order.totalAmount)}. Hàng được cộng vào tồn kho ngay, phiếu không sửa được nữa.`
        }
        action={
          <LoadingButton
            variant="contained"
            color={confirm === 'cancel' ? 'error' : 'primary'}
            loading={busy}
            onClick={() => confirm && run(confirm)}
          >
            {confirm === 'cancel' ? 'Huỷ phiếu' : 'Hoàn thành'}
          </LoadingButton>
        }
      />
    </Box>
  );
}
