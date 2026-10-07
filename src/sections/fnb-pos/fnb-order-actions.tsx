'use client';

import type { IFnbFloor, IOpenOrder } from 'src/types/fnb';

import { useState, useEffect } from 'react';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import ToggleButton from '@mui/material/ToggleButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fCurrency } from 'src/utils/format-number';

import { moveOptions } from './lib/floor';
import { lineTitle, movableLines, voidableLines, allLinesSelection } from './lib/order-view';

import type { MoveOption } from './lib/floor';
import type { QtySelection } from './lib/order-view';

// ----------------------------------------------------------------------
// Hộp thoại thao tác trên đơn (hợp đồng 5.8, 5.9, 5.11, 5.14). Máy chủ kiểm quyền: huỷ món sau khi đã in tạm tính,
// giảm giá cần quản lý — lỗi trả về được hiện nguyên câu của máy chủ.
// ----------------------------------------------------------------------

function QtyPicker({ max, value, onChange }: { max: number; value: number; onChange: (v: number) => void }) {
  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      sx={{ width: 80 }}
    >
      {Array.from({ length: max + 1 }, (_, i) => (
        <MenuItem key={i} value={i}>
          {i}
        </MenuItem>
      ))}
    </TextField>
  );
}

type Common = { open: boolean; order: IOpenOrder | null; busy: boolean; onClose: VoidFunction };

// ── Huỷ món đã gửi ─────────────────────────────────────────────────────

export function FnbVoidDialog({
  open,
  order,
  busy,
  onClose,
  onConfirm,
}: Common & { onConfirm: (sel: QtySelection, reason: string, alreadyMade: boolean) => void }) {
  const [sel, setSel] = useState<QtySelection>({});
  const [reason, setReason] = useState('');
  const [alreadyMade, setAlreadyMade] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSel({});
    setReason('');
    setAlreadyMade(false);
  }, [open]);

  const lines = voidableLines(order);
  const any = Object.values(sel).some((q) => q > 0);

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Huỷ món đã gửi bar</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {order?.voidRequiresManager && (
            <Alert severity="warning">Đơn đã in tạm tính — huỷ món cần quyền quản lý.</Alert>
          )}
          {lines.map((l) => (
            <Stack key={l.id} direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">
                {lineTitle(l)} · đã gọi {l.quantity}
              </Typography>
              <QtyPicker max={l.quantity} value={sel[l.id] ?? 0} onChange={(v) => setSel((p) => ({ ...p, [l.id]: v }))} />
            </Stack>
          ))}
          <TextField label="Lý do (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <FormControlLabel
            control={<Switch checked={alreadyMade} onChange={(e) => setAlreadyMade(e.target.checked)} />}
            label="Món đã pha chế (vẫn trừ nguyên liệu)"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          color="error"
          loading={busy}
          disabled={!any || !reason.trim()}
          onClick={() => onConfirm(sel, reason, alreadyMade)}
        >
          Huỷ món + in phiếu HỦY
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Chuyển món / chuyển bàn ─────────────────────────────────────────────

export function FnbMoveDialog({
  open,
  order,
  floor,
  busy,
  onClose,
  onConfirm,
}: Common & { floor: IFnbFloor | null; onConfirm: (sel: QtySelection, target: MoveOption) => void }) {
  const [sel, setSel] = useState<QtySelection>({});
  const [targetKey, setTargetKey] = useState('');

  useEffect(() => {
    if (!open || !order) return;
    setSel(allLinesSelection(order));
    setTargetKey('');
  }, [open, order]);

  const lines = movableLines(order);
  const options = order ? moveOptions(floor, order.id) : [];
  const target = options.find((o) => o.key === targetKey) ?? null;
  const any = Object.values(sel).some((q) => q > 0);
  const label = (o: MoveOption) =>
    o.kind === 'existing'
      ? `${o.tableName ?? 'Mang về'} · gộp vào đơn ${o.displayNo}`
      : `${o.tableName ?? 'Mang về'} · đơn mới`;

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Chuyển món</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Chuyển hết món = đổi bàn / gộp bàn; chuyển một phần = tách đơn. Không in lại phiếu bar.
          </Typography>
          {lines.map((l) => (
            <Stack key={l.id} direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">
                {lineTitle(l)} · {l.quantity}
              </Typography>
              <QtyPicker max={l.quantity} value={sel[l.id] ?? 0} onChange={(v) => setSel((p) => ({ ...p, [l.id]: v }))} />
            </Stack>
          ))}
          <TextField select label="Chuyển tới" value={targetKey} onChange={(e) => setTargetKey(e.target.value)}>
            {options.map((o) => (
              <MenuItem key={o.key} value={o.key}>
                {label(o)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={busy}
          disabled={!any || !target}
          onClick={() => target && onConfirm(sel, target)}
        >
          Chuyển
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Giảm giá cả đơn ─────────────────────────────────────────────────────

export function FnbDiscountDialog({
  open,
  order,
  busy,
  onClose,
  onConfirm,
}: Common & { onConfirm: (type: 'Percent' | 'Amount' | null, value: number, reason: string) => void }) {
  const [type, setType] = useState<'Percent' | 'Amount'>('Percent');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    const d = order?.discount;
    setType(d?.type === 'Amount' ? 'Amount' : 'Percent');
    setValue(d ? String(d.value) : '');
    setReason(d?.reason ?? '');
  }, [open, order]);

  const n = Number(value);
  const valid = value !== '' && n > 0 && (type === 'Percent' ? n <= 100 : n <= (order?.totals.subtotal ?? 0)) && !!reason.trim();

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Giảm giá đơn</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Tạm tính {fCurrency(order?.totals.subtotal ?? 0)} — cần quyền quản lý.
          </Typography>
          <ToggleButtonGroup exclusive fullWidth value={type} onChange={(_, v) => v && setType(v)}>
            <ToggleButton value="Percent">%</ToggleButton>
            <ToggleButton value="Amount">Số tiền</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            type="number"
            label={type === 'Percent' ? 'Phần trăm (1–100)' : 'Số tiền giảm'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <TextField label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        {order?.discount && (
          <Button color="error" disabled={busy} onClick={() => onConfirm(null, 0, '')}>
            Bỏ giảm giá
          </Button>
        )}
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={busy} disabled={!valid} onClick={() => onConfirm(type, n, reason)}>
          Áp dụng
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Huỷ cả đơn ──────────────────────────────────────────────────────────

export function FnbCancelDialog({
  open,
  order,
  busy,
  onClose,
  onConfirm,
}: Common & { onConfirm: (reason: string, alreadyMade: boolean) => void }) {
  const [reason, setReason] = useState('');
  const [alreadyMade, setAlreadyMade] = useState(false);
  const hasSent = voidableLines(order).length > 0;

  useEffect(() => {
    if (!open) return;
    setReason('');
    setAlreadyMade(false);
  }, [open]);

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={busy ? undefined : onClose}>
      <DialogTitle>Huỷ đơn {order?.displayNo}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {hasSent ? 'Đơn có món đã gửi bar — cần lý do, in phiếu HỦY.' : 'Đơn chưa gửi bar món nào.'}
          </Typography>
          {hasSent && (
            <>
              <TextField label="Lý do (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <FormControlLabel
                control={<Switch checked={alreadyMade} onChange={(e) => setAlreadyMade(e.target.checked)} />}
                label="Món đã pha chế"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          color="error"
          loading={busy}
          disabled={hasSent && !reason.trim()}
          onClick={() => onConfirm(reason, alreadyMade)}
        >
          Huỷ đơn
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
