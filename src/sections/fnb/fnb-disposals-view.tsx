'use client';

import type { FnbDocStatus, IFnbDisposal, FnbDisposalReason, IFnbStockIngredient } from 'src/types/fnb';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogTitle from '@mui/material/DialogTitle';
import Autocomplete from '@mui/material/Autocomplete';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import {
  getFnbStock,
  getFnbDisposal,
  getFnbDisposals,
  createFnbDisposal,
  reviewFnbDisposal,
  uploadFnbDisposalPhotos,
} from 'src/api/fnb';

import { newId } from 'src/sections/fnb-pos/lib/ids';
import { useFnbBranches } from 'src/sections/fnb-pos/use-fnb-branches';

import { fQty } from './lib/stock';
import { DOC_STATUS, factorOf, DISPOSAL_REASONS, DISPOSAL_PHOTO_THRESHOLD } from './lib/documents';

// ----------------------------------------------------------------------
// Phiếu xuất huỷ nguyên liệu: nhân viên lập (chờ duyệt), chủ / quản lý duyệt thì mới trừ kho; quản lý lập thì hoàn tất
// luôn. Phiếu giá trị từ 200.000 đ phải có ảnh. Huỷ phiếu đã hoàn tất = nhập lại kho.
// ----------------------------------------------------------------------

type StatusTab = 'Pending' | 'Completed' | 'Cancelled' | 'All';

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

export default function FnbDisposalsView() {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const { enqueueSnackbar } = useSnackbar();
  const manager = ['Admin', 'Manager'].some((r) => user?.role === r || (user?.roles ?? []).includes(r));
  const { branches, branchId, setBranchId } = useFnbBranches();

  const [tab, setTab] = useState<StatusTab>('Pending');
  const [notes, setNotes] = useState<IFnbDisposal[] | null>(null);
  const [ingredients, setIngredients] = useState<IFnbStockIngredient[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    try {
      setNotes(await getFnbDisposals(branchId, tab === 'All' ? undefined : (tab as FnbDocStatus)));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được phiếu xuất huỷ'), { variant: 'error' });
      setNotes([]);
    }
  }, [branchId, tab, enqueueSnackbar]);

  useEffect(() => {
    setNotes(null);
    load();
  }, [load]);

  useEffect(() => {
    if (!branchId) return;
    getFnbStock(branchId)
      .then((r) => setIngredients(r.ingredients))
      .catch(() => setIngredients([]));
  }, [branchId]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Xuất huỷ nguyên liệu"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Kho nguyên liệu', href: paths.dashboard.fnb.stock },
          { name: 'Xuất huỷ' },
        ]}
        action={
          <Stack direction="row" spacing={1}>
            {branches && branches.length > 1 && (
              <TextField select size="small" label="Chi nhánh" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              disabled={!branchId}
              onClick={() => setCreateOpen(true)}
            >
              Lập phiếu
            </Button>
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      {branches?.length === 0 && <Alert severity="info">Chưa có chi nhánh F&amp;B nào bạn được làm.</Alert>}

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab value="Pending" label="Chờ duyệt" />
          <Tab value="Completed" label="Hoàn tất" />
          <Tab value="Cancelled" label="Đã huỷ" />
          <Tab value="All" label="Tất cả" />
        </Tabs>
        {notes === null ? (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Phiếu</TableCell>
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell>Người lập</TableCell>
                  {manager && <TableCell align="right">Giá trị</TableCell>}
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notes.map((n) => (
                  <TableRow key={n.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetailId(n.id)}>
                    <TableCell>
                      <Typography variant="subtitle2">{n.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {time(n.createdAt)}
                        {n.photos.length > 0 ? ` · ${n.photos.length} ảnh` : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {n.lines.map((l) => `${l.productName} ${fQty(l.quantity)} ${l.unit ?? ''}`.trim()).join(', ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[...new Set(n.lines.map((l) => l.reasonLabel))].join(', ')}
                      </Typography>
                    </TableCell>
                    <TableCell>{n.createdByName}</TableCell>
                    {manager && <TableCell align="right">{n.totalValue == null ? '—' : fCurrency(n.totalValue)}</TableCell>}
                    <TableCell>
                      <Chip size="small" variant="soft" color={DOC_STATUS[n.status].color} label={DOC_STATUS[n.status].label} />
                    </TableCell>
                  </TableRow>
                ))}
                {notes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        Không có phiếu.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <FnbDisposalCreateDialog
        open={createOpen}
        branchId={branchId}
        manager={manager}
        ingredients={ingredients}
        onClose={() => setCreateOpen(false)}
        onCreated={(note) => {
          setCreateOpen(false);
          enqueueSnackbar(note.status === 'Completed' ? `Đã xuất huỷ — ${note.code}` : `Đã lập ${note.code}, chờ duyệt`);
          setTab(note.status === 'Completed' ? 'Completed' : 'Pending');
          load();
        }}
      />
      <FnbDisposalDetailDialog
        id={detailId}
        manager={manager}
        userId={user?.id ?? ''}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type DraftLine = { ingredient: IFnbStockIngredient | null; quantity: string; unitId: string | null; reason: FnbDisposalReason };

const emptyLine = (): DraftLine => ({ ingredient: null, quantity: '', unitId: null, reason: 'Expired' });

type CreateProps = {
  open: boolean;
  branchId: string;
  manager: boolean;
  ingredients: IFnbStockIngredient[];
  onClose: VoidFunction;
  onCreated: (note: IFnbDisposal) => void;
};

function FnbDisposalCreateDialog({ open, branchId, manager, ingredients, onClose, onCreated }: CreateProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLines([emptyLine()]);
    setNote('');
    setFiles([]);
    setRequestId(newId());
  }, [open]);

  const update = (index: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const valid =
    lines.length > 0 &&
    lines.every((l) => l.ingredient && Number(l.quantity) > 0) &&
    new Set(lines.map((l) => `${l.ingredient?.id}|${l.reason}`)).size === lines.length;

  // Giá trị xem trước — chỉ chủ / quản lý có giá vốn.
  const value = manager
    ? lines.reduce(
        (sum, l) =>
          sum +
          (l.ingredient ? Number(l.quantity || 0) * (factorOf(l.ingredient.units, l.unitId) ?? 0) * (l.ingredient.unitCost ?? 0) : 0),
        0
      )
    : null;
  const photoMissing = value != null && value >= DISPOSAL_PHOTO_THRESHOLD && files.length === 0;

  const save = async () => {
    setSaving(true);
    try {
      const photoKeys = await uploadFnbDisposalPhotos(files);
      const created = await createFnbDisposal({
        branchId,
        clientRequestId: requestId,
        note: note.trim() || null,
        photoKeys,
        lines: lines.map((l) => ({
          productId: l.ingredient!.id,
          quantity: Number(l.quantity),
          unitId: l.unitId,
          reason: l.reason,
        })),
      });
      onCreated(created);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không lập được phiếu'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={open} onClose={saving ? undefined : onClose}>
      <DialogTitle>Lập phiếu xuất huỷ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {!manager && <Alert severity="info">Phiếu của nhân viên cần chủ / quản lý duyệt mới trừ kho.</Alert>}
          {lines.map((line, index) => {
            const units = line.ingredient?.units ?? [];
            return (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 2, minWidth: 200 }}
                  options={ingredients}
                  value={line.ingredient}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  onChange={(_, v) => update(index, { ingredient: v, unitId: null })}
                  renderInput={(params) => <TextField {...params} label="Nguyên liệu" />}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Lượng"
                  value={line.quantity}
                  onChange={(e) => update(index, { quantity: e.target.value })}
                  inputProps={{ min: 0, step: 'any' }}
                  sx={{ width: 110 }}
                />
                <TextField
                  select
                  size="small"
                  label="Đơn vị"
                  value={line.unitId ?? ''}
                  onChange={(e) => update(index, { unitId: e.target.value || null })}
                  SelectProps={{ displayEmpty: true }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ width: 140 }}
                >
                  <MenuItem value="">{line.ingredient?.unit || 'Đơn vị gốc'}</MenuItem>
                  {units.map((u) => (
                    <MenuItem key={u.unitId} value={u.unitId}>
                      {u.name} ({fQty(u.factor)} {line.ingredient?.unit ?? ''})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Lý do"
                  value={line.reason}
                  onChange={(e) => update(index, { reason: e.target.value as FnbDisposalReason })}
                  sx={{ width: 130 }}
                >
                  {DISPOSAL_REASONS.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>
                <IconButton color="error" disabled={lines.length === 1} onClick={() => setLines((p) => p.filter((_, i) => i !== index))}>
                  <Iconify icon="solar:trash-bin-trash-bold" />
                </IconButton>
              </Stack>
            );
          })}
          <Button sx={{ alignSelf: 'flex-start' }} startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setLines((p) => [...p, emptyLine()])}>
            Thêm dòng
          </Button>

          <TextField label="Ghi chú (lô, nguyên nhân…)" value={note} onChange={(e) => setNote(e.target.value)} />

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" startIcon={<Iconify icon="solar:camera-bold" />} onClick={() => fileInput.current?.click()}>
                Chụp / chọn ảnh
              </Button>
              <Typography variant="caption" color="text.secondary">
                Tối đa 6 ảnh. Phiếu từ {fCurrency(DISPOSAL_PHOTO_THRESHOLD)} bắt buộc có ảnh.
              </Typography>
            </Stack>
            <input
              ref={fileInput}
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => [...prev, ...picked].slice(0, 6));
                e.target.value = '';
              }}
            />
            {files.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {files.map((file, i) => (
                  <Chip key={`${file.name}-${i}`} label={file.name} onDelete={() => setFiles((p) => p.filter((_, j) => j !== i))} />
                ))}
              </Stack>
            )}
          </Stack>

          {value != null && (
            <Typography variant="subtitle2">Giá trị huỷ (giá vốn): {fCurrency(Math.round(value))}</Typography>
          )}
          {photoMissing && <Alert severity="warning">Phiếu từ {fCurrency(DISPOSAL_PHOTO_THRESHOLD)} cần ảnh hàng huỷ.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" color="error" loading={saving} disabled={!valid || photoMissing} onClick={save}>
          {manager ? 'Xuất huỷ' : 'Gửi duyệt'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type DetailProps = { id: string | null; manager: boolean; userId: string; onClose: VoidFunction; onChanged: VoidFunction };

function FnbDisposalDetailDialog({ id, manager, userId, onClose, onChanged }: DetailProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [note, setNote] = useState<IFnbDisposal | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNote(null);
    setReviewNote('');
    if (id) getFnbDisposal(id).then(setNote).catch(() => enqueueSnackbar('Không tải được phiếu', { variant: 'error' }));
  }, [id, enqueueSnackbar]);

  const act = async (action: 'approve' | 'reject' | 'cancel') => {
    if (!note) return;
    setBusy(true);
    try {
      setNote(await reviewFnbDisposal(note.id, action, reviewNote.trim() || null));
      enqueueSnackbar(action === 'approve' ? 'Đã duyệt — đã trừ kho' : action === 'reject' ? 'Đã từ chối' : 'Đã huỷ phiếu');
      onChanged();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không thực hiện được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const pending = note?.status === 'Pending';
  const ownPending = pending && note?.createdById === userId;
  const canCancelCompleted = manager && note?.status === 'Completed';

  return (
    <Dialog fullWidth maxWidth="md" open={!!id} onClose={busy ? undefined : onClose}>
      <DialogTitle>
        {note?.code ?? 'Phiếu xuất huỷ'}{' '}
        {note && <Chip size="small" variant="soft" color={DOC_STATUS[note.status].color} label={DOC_STATUS[note.status].label} />}
      </DialogTitle>
      <DialogContent dividers>
        {!note ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Lập {time(note.createdAt)} bởi {note.createdByName}
              {note.reviewedByName ? ` · ${note.status === 'Cancelled' ? 'Huỷ / từ chối' : 'Duyệt'} bởi ${note.reviewedByName} ${time(note.reviewedAt)}` : ''}
            </Typography>
            {note.note && <Typography variant="body2">Ghi chú: {note.note}</Typography>}
            {note.reviewNote && <Alert severity="info">Ghi chú duyệt: {note.reviewNote}</Alert>}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nguyên liệu</TableCell>
                  <TableCell align="right">Lượng</TableCell>
                  <TableCell>Lý do</TableCell>
                  {manager && <TableCell align="right">Giá trị</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {note.lines.map((l) => (
                  <TableRow key={l.productId + l.reason}>
                    <TableCell>{l.productName}</TableCell>
                    <TableCell align="right">
                      {fQty(l.quantity)} {l.unit ?? ''}
                      {l.enteredUnitName ? ` (${fQty(l.enteredQuantity ?? 0)} ${l.enteredUnitName})` : ''}
                    </TableCell>
                    <TableCell>{l.reasonLabel}</TableCell>
                    {manager && <TableCell align="right">{l.value == null ? '—' : fCurrency(l.value)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {manager && note.totalValue != null && (
              <Typography variant="subtitle2" textAlign="right">
                Tổng giá trị huỷ: {fCurrency(note.totalValue)}
              </Typography>
            )}
            {note.photos.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {note.photos.map((p) => (
                  <Box
                    key={p.key}
                    component="a"
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ width: 120, height: 120, borderRadius: 1, overflow: 'hidden', bgcolor: 'background.neutral' }}
                  >
                    <Box component="img" src={p.url} alt="Ảnh hàng huỷ" sx={{ width: 1, height: 1, objectFit: 'cover' }} />
                  </Box>
                ))}
              </Stack>
            )}
            {((manager && (pending || canCancelCompleted)) || ownPending) && (
              <TextField
                size="small"
                label={pending && manager ? 'Ghi chú (bắt buộc khi từ chối)' : 'Lý do huỷ phiếu'}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={busy}>
          Đóng
        </Button>
        {ownPending && !manager && (
          <LoadingButton loading={busy} onClick={() => act('cancel')}>
            Rút lại phiếu
          </LoadingButton>
        )}
        {manager && pending && (
          <>
            <LoadingButton color="error" loading={busy} disabled={!reviewNote.trim()} onClick={() => act('reject')}>
              Từ chối
            </LoadingButton>
            <LoadingButton variant="contained" loading={busy} onClick={() => act('approve')}>
              Duyệt &amp; trừ kho
            </LoadingButton>
          </>
        )}
        {canCancelCompleted && (
          <LoadingButton color="error" loading={busy} disabled={!reviewNote.trim()} onClick={() => act('cancel')}>
            Huỷ phiếu (nhập lại kho)
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}
