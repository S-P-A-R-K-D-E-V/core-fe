'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';

import type { IFnbQuickNote } from 'src/types/fnb';

import { getFnbQuickNotes, createFnbQuickNote, deleteFnbQuickNote, updateFnbQuickNote } from 'src/api/fnb';

// ----------------------------------------------------------------------
// Ghi chú nhanh khi gọi món ("Ít đá", "Không đường"…) — dùng chung cả cửa hàng. Dòng món lưu chữ của ghi chú, nên sửa /
// xoá ở đây không đổi đơn cũ. Giới hạn theo nhóm món (categoryIds) chưa sửa ở web: giữ nguyên giá trị đang có.
// ----------------------------------------------------------------------

type NoteForm = { id?: string; text: string; sortOrder: number; categoryIds: string[] };

export default function FnbQuickNotesTab() {
  const { enqueueSnackbar } = useSnackbar();

  const [notes, setNotes] = useState<IFnbQuickNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NoteForm | null>(null);
  const [toDelete, setToDelete] = useState<IFnbQuickNote | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await getFnbQuickNotes());
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được ghi chú nhanh'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const text = form.text.trim();
      if (form.id) {
        await updateFnbQuickNote(form.id, { text, sortOrder: form.sortOrder, categoryIds: form.categoryIds });
      } else {
        await createFnbQuickNote({ text, sortOrder: form.sortOrder });
      }
      enqueueSnackbar('Đã lưu ghi chú nhanh');
      setForm(null);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lưu được ghi chú'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await deleteFnbQuickNote(toDelete.id);
      enqueueSnackbar('Đã xoá ghi chú nhanh');
      setToDelete(null);
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không xoá được ghi chú'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const nextSort = notes.reduce((max, n) => Math.max(max, n.sortOrder), 0) + 1;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Dùng chung cho mọi chi nhánh. Nhân viên bấm chọn khi gọi món.
        </Typography>
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setForm({ text: '', sortOrder: nextSort, categoryIds: [] })}
        >
          Thêm ghi chú
        </Button>
      </Stack>

      <Card>
        {notes.map((note) => (
          <Stack
            key={note.id}
            direction="row"
            alignItems="center"
            sx={{ px: 3, py: 1.5, borderBottom: (theme) => `dashed 1px ${theme.palette.divider}` }}
          >
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              {note.text}
            </Typography>
            <IconButton
              onClick={() =>
                setForm({ id: note.id, text: note.text, sortOrder: note.sortOrder, categoryIds: note.categoryIds })
              }
            >
              <Iconify icon="solar:pen-bold" />
            </IconButton>
            <IconButton color="error" onClick={() => setToDelete(note)}>
              <Iconify icon="solar:trash-bin-trash-bold" />
            </IconButton>
          </Stack>
        ))}
        {!loading && notes.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 5 }}>
            Chưa có ghi chú nhanh nào (vd &quot;Ít đá&quot;, &quot;Không đường&quot;).
          </Typography>
        )}
      </Card>

      <Dialog fullWidth maxWidth="xs" open={!!form} onClose={() => setForm(null)}>
        <DialogTitle>{form?.id ? 'Sửa ghi chú nhanh' : 'Thêm ghi chú nhanh'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              autoFocus
              label="Nội dung"
              placeholder="Ít đá"
              value={form?.text ?? ''}
              onChange={(e) => setForm((f) => f && { ...f, text: e.target.value })}
              inputProps={{ maxLength: 50 }}
            />
            <TextField
              type="number"
              label="Thứ tự"
              value={form?.sortOrder ?? 0}
              onChange={(e) => setForm((f) => f && { ...f, sortOrder: Number(e.target.value) || 0 })}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setForm(null)}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={!form?.text.trim()} onClick={save}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Xoá ghi chú nhanh?"
        content={`Xoá "${toDelete?.text ?? ''}". Đơn cũ vẫn giữ nguyên ghi chú.`}
        action={
          <LoadingButton variant="contained" color="error" loading={saving} onClick={remove}>
            Xoá
          </LoadingButton>
        }
      />
    </>
  );
}
