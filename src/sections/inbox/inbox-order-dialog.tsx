'use client';

import type { IAdminUnit } from 'src/types/online-shop';
import type { ConversationOrder, ConversationOrderInput } from 'src/lib/inbox';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { apiErrorMessage } from 'src/utils/api-error';

import { fVnd } from 'src/lib/inbox';
import { saveConversationOrder } from 'src/api/inbox';
import { getWards, getProvinces } from 'src/api/online-shop';

import Iconify from 'src/components/iconify';

import PurchaseImportProductPicker from 'src/sections/pos/purchase-import/purchase-import-product-picker';

// ----------------------------------------------------------------------
// Lên / sửa đơn nháp trong hội thoại (F4): món + số lượng (giá niêm yết do máy chủ tính — không sửa đơn giá), giao tận nơi
// (tỉnh / phường theo danh mục 2 cấp sau 07/2025) hoặc nhận tại cửa hàng, chuyển khoản QR / trả tại quầy, phí ship theo báo
// giá hoặc nhân viên tự đặt (0 = miễn ship), ghi chú. Lưu = PUT /conversations/{id}/order (thay đơn nháp hiện có).
// ----------------------------------------------------------------------

type Line = { productId: string; code: string | null; name: string; price: number | null; quantity: number };

type Props = {
  open: boolean;
  conversationId: string;
  /** Đơn nháp đang sửa (null = tạo mới). */
  draft: ConversationOrder | null;
  /** Địa chỉ khách đã lưu (gợi ý số nhà / đường khi tạo mới). */
  customerAddress?: string | null;
  onClose: VoidFunction;
  onSaved: (order: ConversationOrder) => void;
};

function byName(units: IAdminUnit[], name: string | null | undefined) {
  if (!name) return null;
  return units.find((u) => u.name === name) ?? null;
}

export default function InboxOrderDialog({ open, conversationId, draft, customerAddress, onClose, onSaved }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [delivery, setDelivery] = useState<'ship' | 'pickup'>('pickup');
  const [payment, setPayment] = useState<'transfer' | 'pay_at_store'>('transfer');
  const [provinces, setProvinces] = useState<IAdminUnit[]>([]);
  const [wards, setWards] = useState<IAdminUnit[]>([]);
  const [province, setProvince] = useState<IAdminUnit | null>(null);
  const [ward, setWard] = useState<IAdminUnit | null>(null);
  const [street, setStreet] = useState('');
  const [note, setNote] = useState('');
  const [feeMode, setFeeMode] = useState<'quote' | 'manual'>('quote');
  const [fee, setFee] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mở hộp → nạp đơn nháp (hoặc trống) + danh mục tỉnh.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLines(
      (draft?.lines ?? []).map((l) => ({ productId: l.productId, code: l.code, name: l.name, price: l.price, quantity: l.quantity }))
    );
    setDelivery(draft?.delivery ?? 'pickup');
    setPayment(draft?.payment ?? 'transfer');
    setStreet(draft?.street ?? (draft ? '' : (customerAddress ?? '')));
    setNote(draft?.note ?? '');
    setFeeMode(draft?.shippingFeeOverridden ? 'manual' : 'quote');
    setFee(String(draft?.shippingFeeOverridden ? draft.shippingFee : 0));
    setProvince(null);
    setWard(null);
    getProvinces()
      .then((list) => {
        setProvinces(list);
        setProvince(byName(list, draft?.provinceName));
      })
      .catch(() => setProvinces([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!province) {
      setWards([]);
      return;
    }
    getWards(province.code)
      .then((list) => {
        setWards(list);
        setWard((current) => current ?? byName(list, draft?.provinceName === province.name ? draft?.wardName : null));
      })
      .catch(() => setWards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province?.code]);

  const subtotal = lines.reduce((sum, l) => sum + (l.price ?? 0) * l.quantity, 0);

  const addLine = (p: { id: string; code: string; name: string; price?: number }) =>
    setLines((prev) =>
      prev.some((l) => l.productId === p.id)
        ? prev.map((l) => (l.productId === p.id ? { ...l, quantity: Math.min(999, l.quantity + 1) } : l))
        : [...prev, { productId: p.id, code: p.code, name: p.name, price: p.price ?? null, quantity: 1 }]
    );

  const setQty = (productId: string, value: number) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.min(999, value || 1)) } : l)));

  const handleSave = async () => {
    setError(null);
    if (lines.length === 0) {
      setError('Thêm ít nhất một món.');
      return;
    }
    if (delivery === 'ship' && (!province || !ward || street.trim().length < 3)) {
      setError('Giao tận nơi cần tỉnh / thành, phường / xã và số nhà + tên đường.');
      return;
    }
    const input: ConversationOrderInput = {
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
      delivery,
      payment: delivery === 'ship' ? 'transfer' : payment,
      address: delivery === 'ship' ? { province: province?.code, ward: ward?.code, street: street.trim() } : null,
      note: note.trim() || null,
      shippingFee: delivery === 'ship' && feeMode === 'manual' ? Math.max(0, Number(fee) || 0) : null,
    };
    setSaving(true);
    try {
      onSaved(await saveConversationOrder(conversationId, input));
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được đơn nháp.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{draft ? `Sửa đơn nháp ${draft.code}` : 'Lên đơn cho khách'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <PurchaseImportProductPicker placeholder="Tìm món theo tên / mã…" onPick={addLine} />

          {lines.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              Chưa có món nào.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {lines.map((l) => (
                <Stack key={l.productId} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {l.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {l.code ? `${l.code} · ` : ''}
                      {l.price != null ? fVnd(l.price) : 'giá niêm yết'}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    type="number"
                    value={l.quantity}
                    onChange={(e) => setQty(l.productId, Number(e.target.value))}
                    inputProps={{ min: 1, max: 999, 'aria-label': `Số lượng ${l.name}` }}
                    sx={{ width: 80 }}
                  />
                  <IconButton
                    size="small"
                    aria-label={`Bỏ ${l.name}`}
                    onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                  </IconButton>
                </Stack>
              ))}
              <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'right' }}>
                Tạm tính {fVnd(subtotal)} — giá, tồn, phí ship máy chủ tính lại khi lưu
              </Typography>
            </Stack>
          )}

          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={delivery}
            onChange={(_, v) => v && setDelivery(v)}
          >
            <ToggleButton value="pickup">Nhận tại cửa hàng</ToggleButton>
            <ToggleButton value="ship">Giao tận nơi</ToggleButton>
          </ToggleButtonGroup>

          {delivery === 'pickup' ? (
            <TextField
              select
              size="small"
              label="Cách trả tiền"
              value={payment}
              onChange={(e) => setPayment(e.target.value as 'transfer' | 'pay_at_store')}
            >
              <MenuItem value="transfer">Chuyển khoản trước (gửi mã QR)</MenuItem>
              <MenuItem value="pay_at_store">Trả tại quầy khi nhận</MenuItem>
            </TextField>
          ) : (
            <>
              <Autocomplete
                size="small"
                options={provinces}
                value={province}
                onChange={(_, v) => {
                  setProvince(v);
                  setWard(null);
                }}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                renderInput={(params) => <TextField {...params} label="Tỉnh / thành" />}
              />
              <Autocomplete
                size="small"
                options={wards}
                value={ward}
                disabled={!province}
                onChange={(_, v) => setWard(v)}
                getOptionLabel={(o) => o.name}
                isOptionEqualToValue={(a, b) => a.code === b.code}
                renderInput={(params) => <TextField {...params} label="Phường / xã" />}
              />
              <TextField size="small" label="Số nhà, tên đường" value={street} onChange={(e) => setStreet(e.target.value)} />
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  select
                  size="small"
                  label="Phí ship"
                  value={feeMode}
                  onChange={(e) => setFeeMode(e.target.value as 'quote' | 'manual')}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="quote">Theo báo giá hãng</MenuItem>
                  <MenuItem value="manual">Tự đặt (0 = miễn ship)</MenuItem>
                </TextField>
                {feeMode === 'manual' && (
                  <TextField
                    size="small"
                    type="number"
                    label="Khách trả"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    inputProps={{ min: 0, step: 1000 }}
                    sx={{ width: 140 }}
                  />
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Giao tận nơi: khách chuyển khoản trước (chưa hỗ trợ thu hộ COD).
              </Typography>
            </>
          )}

          <TextField size="small" label="Ghi chú cho shop" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          Lưu đơn nháp
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
