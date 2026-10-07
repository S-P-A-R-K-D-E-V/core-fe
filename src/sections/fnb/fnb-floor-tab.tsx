'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import type { IDiningArea, IDiningTable } from 'src/types/fnb';

import {
  getFnbAreas,
  createFnbArea,
  deleteFnbArea,
  updateFnbArea,
  createFnbTable,
  deleteFnbTable,
  updateFnbTable,
} from 'src/api/fnb';

// ----------------------------------------------------------------------
// Khu vực và bàn của một chi nhánh F&B. Tên khu vực / bàn không trùng trong chi nhánh; không tắt / xoá được bàn đang có
// đơn mở; khu vực còn bàn thì không xoá được (BE trả lỗi kèm lý do).
// ----------------------------------------------------------------------

type AreaForm = { id?: string; name: string; sortOrder: number; isActive: boolean };
type TableForm = {
  id?: string;
  areaId: string;
  name: string;
  seats: string;
  sortOrder: number;
  isActive: boolean;
};

type Pending = { kind: 'area'; area: IDiningArea } | { kind: 'table'; table: IDiningTable };

export default function FnbFloorTab({ branchId }: { branchId: string }) {
  const { enqueueSnackbar } = useSnackbar();

  const [areas, setAreas] = useState<IDiningArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaForm, setAreaForm] = useState<AreaForm | null>(null);
  const [tableForm, setTableForm] = useState<TableForm | null>(null);
  const [toDelete, setToDelete] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAreas(await getFnbAreas(branchId, true));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được khu vực'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, done: string) => {
    setSaving(true);
    try {
      await action();
      enqueueSnackbar(done);
      await load();
      return true;
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Có lỗi xảy ra'), { variant: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveArea = async () => {
    if (!areaForm) return;
    const name = areaForm.name.trim();
    const ok = areaForm.id
      ? await run(
          () => updateFnbArea(areaForm.id!, { name, sortOrder: areaForm.sortOrder, isActive: areaForm.isActive }),
          'Đã lưu khu vực'
        )
      : await run(() => createFnbArea({ branchId, name, sortOrder: areaForm.sortOrder }), 'Đã thêm khu vực');
    if (ok) setAreaForm(null);
  };

  const saveTable = async () => {
    if (!tableForm) return;
    const name = tableForm.name.trim();
    const seats = tableForm.seats.trim() ? Number(tableForm.seats) : null;
    const ok = tableForm.id
      ? await run(
          () =>
            updateFnbTable(tableForm.id!, {
              areaId: tableForm.areaId,
              name,
              seats,
              sortOrder: tableForm.sortOrder,
              isActive: tableForm.isActive,
            }),
          'Đã lưu bàn'
        )
      : await run(
          () => createFnbTable({ branchId, areaId: tableForm.areaId, name, seats, sortOrder: tableForm.sortOrder }),
          'Đã thêm bàn'
        );
    if (ok) setTableForm(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const ok =
      toDelete.kind === 'area'
        ? await run(() => deleteFnbArea(toDelete.area.id), 'Đã xoá khu vực')
        : await run(() => deleteFnbTable(toDelete.table.id), 'Đã xoá bàn');
    if (ok) setToDelete(null);
  };

  const nextSort = (items: { sortOrder: number }[]) =>
    items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {loading ? 'Đang tải...' : `${areas.length} khu vực · ${areas.reduce((n, a) => n + a.tables.length, 0)} bàn`}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setAreaForm({ name: '', sortOrder: nextSort(areas), isActive: true })}
        >
          Thêm khu vực
        </Button>
      </Stack>

      <Stack spacing={3}>
        {areas.map((area) => (
          <Card key={area.id} sx={{ p: 3, opacity: area.isActive ? 1 : 0.6 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                {area.name}
                {!area.isActive && <Chip size="small" label="Đang tắt" sx={{ ml: 1 }} />}
              </Typography>
              <Button
                size="small"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() =>
                  setTableForm({
                    areaId: area.id,
                    name: '',
                    seats: '',
                    sortOrder: nextSort(area.tables),
                    isActive: true,
                  })
                }
              >
                Thêm bàn
              </Button>
              <IconButton
                onClick={() =>
                  setAreaForm({ id: area.id, name: area.name, sortOrder: area.sortOrder, isActive: area.isActive })
                }
              >
                <Iconify icon="solar:pen-bold" />
              </IconButton>
              <IconButton color="error" onClick={() => setToDelete({ kind: 'area', area })}>
                <Iconify icon="solar:trash-bin-trash-bold" />
              </IconButton>
            </Stack>

            {area.tables.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Chưa có bàn.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {area.tables.map((table) => (
                  <Chip
                    key={table.id}
                    variant={table.isActive ? 'filled' : 'outlined'}
                    label={table.seats ? `${table.name} · ${table.seats} chỗ` : table.name}
                    onClick={() =>
                      setTableForm({
                        id: table.id,
                        areaId: table.areaId,
                        name: table.name,
                        seats: table.seats ? String(table.seats) : '',
                        sortOrder: table.sortOrder,
                        isActive: table.isActive,
                      })
                    }
                    onDelete={() => setToDelete({ kind: 'table', table })}
                  />
                ))}
              </Box>
            )}
          </Card>
        ))}

        {!loading && areas.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>
            Chưa có khu vực nào. Thêm khu vực (vd &quot;Tầng trệt&quot;) rồi thêm bàn vào khu vực.
          </Typography>
        )}
      </Stack>

      <Dialog fullWidth maxWidth="xs" open={!!areaForm} onClose={() => setAreaForm(null)}>
        <DialogTitle>{areaForm?.id ? 'Sửa khu vực' : 'Thêm khu vực'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Tên khu vực"
              value={areaForm?.name ?? ''}
              onChange={(e) => setAreaForm((f) => f && { ...f, name: e.target.value })}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              type="number"
              label="Thứ tự"
              value={areaForm?.sortOrder ?? 0}
              onChange={(e) => setAreaForm((f) => f && { ...f, sortOrder: Number(e.target.value) || 0 })}
            />
            {areaForm?.id && (
              <FormControlLabel
                label="Đang dùng"
                control={
                  <Switch
                    checked={areaForm.isActive}
                    onChange={(e) => setAreaForm((f) => f && { ...f, isActive: e.target.checked })}
                  />
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAreaForm(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={!areaForm?.name.trim()} onClick={saveArea}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="xs" open={!!tableForm} onClose={() => setTableForm(null)}>
        <DialogTitle>{tableForm?.id ? 'Sửa bàn' : 'Thêm bàn'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Tên bàn"
              placeholder="Bàn 1"
              value={tableForm?.name ?? ''}
              onChange={(e) => setTableForm((f) => f && { ...f, name: e.target.value })}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              select
              label="Khu vực"
              value={tableForm?.areaId ?? ''}
              onChange={(e) => setTableForm((f) => f && { ...f, areaId: e.target.value })}
            >
              {areas.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Số chỗ (không bắt buộc)"
              value={tableForm?.seats ?? ''}
              onChange={(e) => setTableForm((f) => f && { ...f, seats: e.target.value })}
              inputProps={{ min: 1, max: 99 }}
            />
            <TextField
              type="number"
              label="Thứ tự"
              value={tableForm?.sortOrder ?? 0}
              onChange={(e) => setTableForm((f) => f && { ...f, sortOrder: Number(e.target.value) || 0 })}
            />
            {tableForm?.id && (
              <FormControlLabel
                label="Đang dùng"
                control={
                  <Switch
                    checked={tableForm.isActive}
                    onChange={(e) => setTableForm((f) => f && { ...f, isActive: e.target.checked })}
                  />
                }
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setTableForm(null)}>
            Huỷ
          </Button>
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!tableForm?.name.trim() || !tableForm?.areaId}
            onClick={saveTable}
          >
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={toDelete?.kind === 'area' ? 'Xoá khu vực?' : 'Xoá bàn?'}
        content={
          toDelete?.kind === 'area'
            ? `Xoá khu vực "${toDelete.area.name}". Khu vực còn bàn thì phải xoá hoặc chuyển bàn trước.`
            : toDelete?.kind === 'table'
              ? `Xoá bàn "${toDelete.table.name}". Hoá đơn cũ vẫn giữ tên bàn.`
              : ''
        }
        action={
          <LoadingButton variant="contained" color="error" loading={saving} onClick={confirmDelete}>
            Xoá
          </LoadingButton>
        }
      />
    </>
  );
}
