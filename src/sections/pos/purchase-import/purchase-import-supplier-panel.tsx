'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import LinearProgress from '@mui/material/LinearProgress';
import Autocomplete from '@mui/material/Autocomplete';

import Iconify from 'src/components/iconify';

import { createSupplier, getAllSuppliers } from 'src/api/suppliers';
import {
  updatePurchaseImport,
  getPurchaseImportSupplierSuggestions,
} from 'src/api/purchase-imports';

import type { ISupplier } from 'src/types/corecms-api';
import type {
  IPurchaseImport,
  IPurchaseImportSupplierSuggestions,
} from 'src/types/purchase-import';

import { importErrorMessage } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Nhà cung cấp của lần nhập (drawer duyệt nhanh): NCC đã nhận ra + nút đổi; chưa nhận ra thì mở sẵn: NCC gần giống tên /
// SĐT in trên hoá đơn (trùng SĐT trước), ô tìm NCC khác, hoặc tạo NCC mới điền sẵn tên / SĐT / địa chỉ in trên hoá
// đơn. Chọn NCC → gợi ý mã các dòng chưa chốt được tính lại theo hàng đã nhập từ NCC đó (máy chủ hỏi lại trợ lý — vài
// chục giây).
// ----------------------------------------------------------------------

type Props = {
  item: IPurchaseImport;
  editable: boolean;
  /** Danh sách gợi ý / menu nổi trên drawer. */
  popperZIndex: number;
  onChanged: (next: IPurchaseImport) => void;
};

export default function PurchaseImportSupplierPanel({
  item,
  editable,
  popperZIndex,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(!item.supplierId);
  const [suggestions, setSuggestions] = useState<IPurchaseImportSupplierSuggestions | null>(null);
  const [keyword, setKeyword] = useState('');
  const [options, setOptions] = useState<ISupplier[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item.supplierId) setOpen(true);
  }, [item.supplierId]);

  // Gợi ý theo hoá đơn — tải khi mở phần chọn NCC.
  useEffect(() => {
    if (!open || !editable || suggestions) return undefined;
    let cancelled = false;
    getPurchaseImportSupplierSuggestions(item.id)
      .then((data) => {
        if (cancelled) return;
        setSuggestions(data);
        setForm({
          name: data.invoice?.name ?? item.supplierText ?? '',
          phone: data.invoice?.phones?.[0] ?? item.supplierPhone ?? '',
          address: data.invoice?.address ?? '',
        });
      })
      .catch(() => !cancelled && setSuggestions({ candidates: [], invoice: null }));
    return () => {
      cancelled = true;
    };
  }, [open, editable, suggestions, item.id, item.supplierText, item.supplierPhone]);

  // Tìm NCC khác theo chữ gõ (đợi gõ xong 300ms).
  useEffect(() => {
    const text = keyword.trim();
    if (text.length < 2) {
      setOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      getAllSuppliers({ keyword: text })
        .then((list) => !cancelled && setOptions(list.slice(0, 20)))
        .catch(() => !cancelled && setOptions([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  const choose = async (supplierId: string) => {
    setWorking(true);
    setError(null);
    try {
      onChanged(await updatePurchaseImport(item.id, { supplierId }));
      setOpen(false);
      setCreating(false);
    } catch (err) {
      setError(importErrorMessage(err, 'Không đổi được nhà cung cấp.'));
    } finally {
      setWorking(false);
    }
  };

  const createAndChoose = async () => {
    if (!form.name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const { id } = await createSupplier({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      await choose(id);
    } catch (err) {
      setError(importErrorMessage(err, 'Không tạo được nhà cung cấp (cần quyền thêm NCC).'));
      setWorking(false);
    }
  };

  const name = item.supplierName || null;

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        border: (theme) => `1px solid ${name ? theme.palette.divider : theme.palette.warning.main}`,
        bgcolor: name ? 'transparent' : 'warning.lighter',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Iconify
          icon="solar:shop-2-bold-duotone"
          width={20}
          sx={{ color: name ? 'primary.main' : 'warning.main' }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {name ? `NCC: ${name}` : 'Chưa nhận ra nhà cung cấp'}
          </Typography>
          {!name && item.supplierText && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              Trên hoá đơn: {item.supplierText}
              {item.supplierPhone ? ` · ${item.supplierPhone}` : ''}
            </Typography>
          )}
        </Box>
        {editable && (
          <Button size="small" color="inherit" onClick={() => setOpen((v) => !v)}>
            {open ? 'Đóng' : name ? 'Đổi' : 'Chọn'}
          </Button>
        )}
      </Stack>

      {working && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Đang lưu NCC và gợi ý lại mã theo hàng đã nhập từ NCC này…
          </Typography>
          <LinearProgress sx={{ mt: 0.5 }} />
        </Box>
      )}

      {open && editable && (
        <Stack spacing={1} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {suggestions?.candidates.map((c) => (
            <Stack
              key={c.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                p: 0.75,
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  <strong>{c.name}</strong>
                  {c.code ? ` · ${c.code}` : ''}
                  {!c.isActive ? ' · ngừng giao dịch' : ''}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ display: 'block' }}
                >
                  {[c.phone, c.address].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="soft"
                color={c.score >= 0.9 ? 'success' : 'default'}
                label={c.reason}
              />
              <Button
                size="small"
                variant={c.id === item.supplierId ? 'outlined' : 'contained'}
                disabled={working || c.id === item.supplierId}
                onClick={() => choose(c.id)}
              >
                {c.id === item.supplierId ? 'Đang chọn' : 'Chọn'}
              </Button>
            </Stack>
          ))}
          {suggestions && suggestions.candidates.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Không thấy NCC nào giống tên / SĐT trên hoá đơn — tìm NCC khác hoặc tạo NCC mới.
            </Typography>
          )}

          <Autocomplete
            size="small"
            options={options}
            filterOptions={(list) => list}
            getOptionLabel={(o) =>
              `${o.name}${o.code ? ` · ${o.code}` : ''}${o.phone ? ` · ${o.phone}` : ''}`
            }
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onInputChange={(_, value) => setKeyword(value)}
            onChange={(_, value) => value && choose(value.id)}
            noOptionsText={keyword.trim().length < 2 ? 'Gõ tên, mã hoặc SĐT NCC' : 'Không tìm thấy'}
            slotProps={{ popper: { sx: { zIndex: popperZIndex } } }}
            disabled={working}
            renderInput={(params) => <TextField {...params} placeholder="Tìm NCC khác…" />}
          />

          {creating ? (
            <Stack spacing={1} sx={{ p: 1, borderRadius: 1, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2">NCC mới (điền sẵn theo hoá đơn)</Typography>
              <TextField
                size="small"
                label="Tên NCC"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  label="SĐT"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Địa chỉ"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  sx={{ flex: 2 }}
                />
              </Stack>
              {(suggestions?.invoice?.phones?.length ?? 0) > 1 && (
                <Typography variant="caption" color="text.secondary">
                  SĐT khác trên hoá đơn: {suggestions!.invoice!.phones.slice(1).join(', ')}
                </Typography>
              )}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  color="inherit"
                  disabled={working}
                  onClick={() => setCreating(false)}
                >
                  Thôi
                </Button>
                <LoadingButton
                  size="small"
                  variant="contained"
                  loading={working}
                  disabled={!form.name.trim()}
                  onClick={createAndChoose}
                >
                  Tạo &amp; chọn NCC
                </LoadingButton>
              </Stack>
            </Stack>
          ) : (
            <Button
              size="small"
              color="inherit"
              startIcon={<Iconify icon="mingcute:add-line" width={16} />}
              onClick={() => setCreating(true)}
              sx={{ alignSelf: 'flex-start' }}
            >
              Tạo NCC mới{form.name ? ` «${form.name}»` : ''}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
