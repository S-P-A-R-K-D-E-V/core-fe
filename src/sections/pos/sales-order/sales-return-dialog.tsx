'use client';

import { useMemo, useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

import { getAllWarehouses } from 'src/api/warehouses';
import { createSalesReturn, completeSalesReturn } from 'src/api/sales-returns';

import { useSnackbar } from 'src/components/snackbar';

import type { ISalesOrder, IWarehouse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Trả hàng từ hoá đơn (máy quầy + chủ / quản lý): số lượng trả từng dòng, kho nhận lại hàng → tạo phiếu trả rồi hoàn
// tất luôn. Ở máy quầy server tự đặt giá theo hoá đơn và chặn trả quá phần đã bán.
// ----------------------------------------------------------------------

type Props = { order: ISalesOrder; open: boolean; onClose: () => void; onDone: () => void };

function unitNet(item: ISalesOrder['items'][number]): number {
  return item.quantity > 0 ? Math.floor(item.totalPrice / item.quantity) : 0;
}

export default function SalesReturnDialog({ order, open, onClose, onDone }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty({});
    setNote('');
    getAllWarehouses()
      .then((list) => {
        const active = list.filter((w: any) => w.isActive !== false);
        setWarehouses(active);
        setWarehouseId((current) => current || ((active.find((w: any) => w.isDefault) ?? active[0])?.id ?? ''));
      })
      .catch(() => setWarehouses([]));
  }, [open]);

  const lines = useMemo(() => order.items.filter((i) => (qty[i.id] ?? 0) > 0), [order.items, qty]);
  const estimate = lines.reduce((sum, i) => sum + unitNet(i) * (qty[i.id] ?? 0), 0);

  async function submit() {
    if (!warehouseId || lines.length === 0) return;
    setSaving(true);
    try {
      const created = await createSalesReturn({
        returnType: 1,
        salesOrderId: order.id,
        customerId: order.customerId ?? null,
        warehouseId,
        note: note.trim() || null,
        lines: lines.map((i) => ({ productId: i.productId, quantity: qty[i.id] ?? 0, price: unitNet(i) })),
      });
      const refund = created.returnTotal ?? estimate;
      await completeSalesReturn(created.id, refund);
      enqueueSnackbar(`Đã trả hàng · hoàn ${fCurrency(refund)}`, { variant: 'success' });
      onDone();
      onClose();
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Không trả hàng được', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Trả hàng · #{order.orderNumber}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nhập số lượng khách trả lại. Tiền hoàn theo giá thực thu trên hoá đơn.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sản phẩm</TableCell>
              <TableCell align="center">Đã bán</TableCell>
              <TableCell align="right">Giá thực thu</TableCell>
              <TableCell align="center" width={140}>
                Trả lại
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.productName}</TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">{fCurrency(unitNet(item))}</TableCell>
                <TableCell align="center">
                  <TextField
                    size="small"
                    type="number"
                    value={qty[item.id] ?? 0}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(item.quantity, Math.floor(Number(e.target.value) || 0)));
                      setQty((q) => ({ ...q, [item.id]: n }));
                    }}
                    inputProps={{ min: 0, max: item.quantity, style: { textAlign: 'center' } }}
                    sx={{ width: 96 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
          {warehouses.length > 1 && (
            <TextField select size="small" label="Nhập lại vào kho" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} sx={{ minWidth: 220 }}>
              {warehouses.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField size="small" fullWidth label="Ghi chú (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 200 }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2.5 }}>
        <Typography variant="subtitle1">Hoàn cho khách: {fCurrency(estimate)}</Typography>
        <Stack direction="row" spacing={1}>
          <Button color="inherit" onClick={onClose}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={lines.length === 0 || !warehouseId} onClick={submit}>
            Trả hàng
          </LoadingButton>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
