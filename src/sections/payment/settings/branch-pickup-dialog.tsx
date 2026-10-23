'use client';

import type { IAdminUnit, IPickupBranch } from 'src/types/online-shop';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { apiErrorMessage } from 'src/utils/api-error';

import { getWards, getProvinces, updateBranchPickupAddress } from 'src/api/online-shop';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Địa chỉ gửi hàng của chi nhánh: hãng vận chuyển đến lấy hàng (và hoàn hàng) ở đây — gửi kèm mỗi báo giá / vận đơn, không
// phải sửa địa chỉ trên trang hãng. Tỉnh / phường theo danh mục 2 cấp (như trang đặt hàng); chi nhánh đồng bộ KiotViet vẫn
// nhập được (KiotViet không ghi đè).
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  branch: IPickupBranch | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function BranchPickupDialog({ open, branch, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [provinces, setProvinces] = useState<IAdminUnit[]>([]);
  const [wards, setWards] = useState<IAdminUnit[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [phone, setPhone] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [street, setStreet] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !branch) return;
    setSenderName(branch.pickup?.senderName ?? branch.name);
    setPhone(branch.pickup?.phone ?? branch.contactNumber ?? '');
    setProvinceCode(branch.pickup?.provinceCode ?? '');
    setWardCode(branch.pickup?.wardCode ?? '');
    setStreet(branch.pickup?.street ?? '');
    setError(null);
    getProvinces()
      .then(setProvinces)
      .catch(() => setProvinces([]));
  }, [open, branch]);

  useEffect(() => {
    if (!open || !provinceCode) {
      setWards([]);
      return;
    }
    setWardsLoading(true);
    getWards(provinceCode)
      .then(setWards)
      .catch(() => setWards([]))
      .finally(() => setWardsLoading(false));
  }, [open, provinceCode]);

  const province = provinces.find((p) => p.code === provinceCode) ?? null;
  const ward = wards.find((w) => w.code === wardCode) ?? null;
  const complete = !!provinceCode && !!wardCode && street.trim().length >= 3;

  const submit = async (clear: boolean) => {
    if (!branch) return;
    setSaving(true);
    setError(null);
    try {
      await updateBranchPickupAddress(
        branch.id,
        clear
          ? { senderName: null, phone: null, provinceCode: null, wardCode: null, street: null }
          : {
              senderName: senderName.trim() || null,
              phone: phone.trim() || null,
              provinceCode,
              wardCode,
              street: street.trim(),
            }
      );
      enqueueSnackbar(clear ? 'Đã xoá địa chỉ gửi hàng' : 'Đã lưu địa chỉ gửi hàng');
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu địa chỉ gửi hàng thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Địa chỉ gửi hàng — {branch?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Hãng vận chuyển đến lấy hàng và hoàn hàng về địa chỉ này. Gửi kèm mỗi báo giá / vận đơn — không cần sửa địa chỉ trên
            trang của hãng.
          </Typography>
          {branch?.address && (
            <Typography variant="caption" color="text.secondary">
              Địa chỉ chi nhánh đang lưu: {branch.address}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
            <TextField label="Tên người gửi" value={senderName} onChange={(e) => setSenderName(e.target.value)} inputProps={{ maxLength: 200 }} />
            <TextField
              label="SĐT người gửi"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputProps={{ inputMode: 'tel', maxLength: 20 }}
              helperText="Shipper gọi khi tới lấy hàng"
            />
            <Autocomplete
              options={provinces}
              value={province}
              onChange={(_, p) => {
                setProvinceCode(p?.code ?? '');
                setWardCode('');
              }}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              renderInput={(params) => <TextField {...params} label="Tỉnh / thành phố *" />}
              noOptionsText="Không tìm thấy"
            />
            <Autocomplete
              options={wards}
              value={ward}
              loading={wardsLoading}
              disabled={!provinceCode}
              onChange={(_, w) => setWardCode(w?.code ?? '')}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              renderInput={(params) => <TextField {...params} label="Phường / xã *" />}
              noOptionsText="Không tìm thấy"
            />
          </Box>
          <TextField
            label="Số nhà, tên đường *"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="Vd: 21 Chùa Láng"
            inputProps={{ maxLength: 250 }}
          />
          {!branch?.hasLocation && (
            <Alert severity="info">
              Chi nhánh chưa có toạ độ — Ahamove tự định vị theo địa chỉ chữ. Toạ độ chi nhánh (dùng cho chấm công) giúp định vị
              chính xác hơn.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {branch?.pickup && (
          <Button color="error" onClick={() => submit(true)} disabled={saving} sx={{ mr: 'auto' }}>
            Xoá địa chỉ
          </Button>
        )}
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!complete} onClick={() => submit(false)}>
          Lưu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
