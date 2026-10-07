'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { IProductUnits, IUnitOfMeasure } from 'src/types/corecms-api';

import { getProductUnits, setProductUnits } from 'src/api/products';
import { createUnitOfMeasure, getAllUnitOfMeasures } from 'src/api/unit-of-measures';

// ----------------------------------------------------------------------
// Đơn vị tính của hàng (M7 bước 1): đơn vị gốc — đơn vị nhỏ nhất dùng cho tồn, giá vốn, định lượng — và quy đổi các đơn
// vị mua / dùng về đơn vị gốc: 1 thùng = 20.000 ml, 1 gói = 500 g, kể cả quy đổi chéo loại (1 ml đường = 1,3 g). Đơn vị
// cùng loại khối lượng / thể tích với đơn vị gốc (kg, l) tự quy đổi, không cần khai. Phiếu nhập chốt hệ số lúc lập nên
// sửa ở đây không làm sai phiếu cũ.
// ----------------------------------------------------------------------

type Row = { key: number; unitId: string; factor: string; isDefaultPurchase: boolean };

type Props = {
  productId: string;
};

export default function ProductUnitsCard({ productId }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [data, setData] = useState<IProductUnits | null>(null);
  const [allUnits, setAllUnits] = useState<IUnitOfMeasure[]>([]);
  const [baseUnitId, setBaseUnitId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const load = useCallback(async () => {
    try {
      const [units, list] = await Promise.all([getProductUnits(productId), getAllUnitOfMeasures()]);
      setData(units);
      setAllUnits(list.filter((u) => u.isActive));
      setBaseUnitId(units.baseUnitId ?? '');
      setRows(
        units.units
          .filter((u) => u.source === 'conversion' && u.unitId)
          .map((u, i) => ({ key: i, unitId: u.unitId!, factor: String(u.factor), isDefaultPurchase: u.isDefaultPurchase }))
      );
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được đơn vị tính'), { variant: 'error' });
    }
  }, [productId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const baseName = allUnits.find((u) => u.id === baseUnitId)?.name ?? data?.baseUnitName ?? '';
  const nameOf = (id: string) => allUnits.find((u) => u.id === id)?.name ?? '';

  const addRow = () =>
    setRows((prev) => [...prev, { key: Date.now(), unitId: '', factor: '', isDefaultPurchase: prev.length === 0 }]);

  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const setDefault = (key: number) =>
    setRows((prev) => prev.map((r) => ({ ...r, isDefaultPurchase: r.key === key ? !r.isDefaultPurchase : false })));

  const createUnit = async () => {
    const name = newUnitName.trim();
    if (!name) return;
    try {
      await createUnitOfMeasure({ name, abbreviation: name, dimension: 'Count' });
      setNewUnitName('');
      setAllUnits((await getAllUnitOfMeasures()).filter((u) => u.isActive));
      enqueueSnackbar(`Đã thêm đơn vị "${name}"`);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không thêm được đơn vị'), { variant: 'error' });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await setProductUnits(productId, {
        baseUnitId,
        conversions: rows
          .filter((r) => r.unitId)
          .map((r) => ({ unitId: r.unitId, factor: Number(r.factor), isDefaultPurchase: r.isDefaultPurchase })),
      });
      enqueueSnackbar('Đã lưu đơn vị tính');
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được đơn vị tính'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!data) return null;

  if (data.managedByKiotViet) {
    return (
      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Đơn vị tính
        </Typography>
        <Alert severity="info">Hàng do KiotViet quản lý — đơn vị tính sửa trên KiotViet.</Alert>
      </Card>
    );
  }

  const standardUnits = data.units.filter((u) => u.source === 'standard');
  const invalid = !baseUnitId || rows.some((r) => r.unitId && !(Number(r.factor) > 0));

  return (
    <Card sx={{ p: 3 }}>
      <Typography variant="subtitle1" fontWeight={700}>
        Đơn vị tính
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Đơn vị gốc là đơn vị nhỏ nhất (g, ml, cái) — tồn kho, giá vốn và định lượng tính theo đơn vị này. Khai quy đổi cho
        đơn vị mua (thùng, gói) hoặc đơn vị dùng khác loại (ml ↔ g).
      </Typography>

      <Stack spacing={2}>
        <TextField
          select
          label="Đơn vị gốc"
          value={baseUnitId}
          onChange={(e) => setBaseUnitId(e.target.value)}
          sx={{ maxWidth: 280 }}
          helperText="Hàng đang có tồn thì không đổi được đơn vị gốc."
        >
          {allUnits.map((u) => (
            <MenuItem key={u.id} value={u.id}>
              {u.name}
            </MenuItem>
          ))}
        </TextField>

        {rows.map((row) => (
          <Stack key={row.key} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2">1</Typography>
            <TextField
              select
              size="small"
              label="Đơn vị"
              value={row.unitId}
              onChange={(e) => updateRow(row.key, { unitId: e.target.value })}
              sx={{ minWidth: 140 }}
            >
              {allUnits
                .filter((u) => u.id !== baseUnitId)
                .map((u) => (
                  <MenuItem key={u.id} value={u.id} disabled={rows.some((r) => r.key !== row.key && r.unitId === u.id)}>
                    {u.name}
                  </MenuItem>
                ))}
            </TextField>
            <Typography variant="body2">=</Typography>
            <TextField
              size="small"
              type="number"
              label={baseName || 'đơn vị gốc'}
              value={row.factor}
              onChange={(e) => updateRow(row.key, { factor: e.target.value })}
              inputProps={{ min: 0, step: 'any' }}
              sx={{ width: 140 }}
            />
            <Stack direction="row" alignItems="center">
              <Radio size="small" checked={row.isDefaultPurchase} onClick={() => setDefault(row.key)} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Mặc định khi nhập
              </Typography>
            </Stack>
            <IconButton color="error" onClick={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
            {row.unitId && Number(row.factor) > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', width: '100%' }}>
                1 {nameOf(row.unitId)} = {Number(row.factor).toLocaleString('vi-VN')} {baseName}
              </Typography>
            )}
          </Stack>
        ))}

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />} onClick={addRow} disabled={!baseUnitId}>
            Thêm quy đổi
          </Button>
          <TextField
            size="small"
            placeholder="Đơn vị mới (thùng, gói…)"
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            sx={{ width: 200 }}
          />
          <Button size="small" variant="outlined" onClick={createUnit} disabled={!newUnitName.trim()}>
            Tạo đơn vị
          </Button>
        </Stack>

        {standardUnits.length > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Tự quy đổi:
            </Typography>
            {standardUnits.map((u) => (
              <Chip
                key={u.unitId ?? u.name}
                size="small"
                variant="outlined"
                label={`1 ${u.name} = ${u.factor.toLocaleString('vi-VN')} ${data.baseUnitName}`}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" justifyContent="flex-end">
          <LoadingButton variant="contained" loading={saving} disabled={invalid} onClick={save}>
            Lưu đơn vị tính
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );
}
