'use client';

import type { IFnbComboBook, IFnbComboItem } from 'src/types/fnb';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
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
import InputAdornment from '@mui/material/InputAdornment';

import { fCurrency } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { setFnbCombo, getFnbCombos } from 'src/api/fnb';

import {
  emptyGroup,
  choiceLabel,
  comboSaving,
  emptyOption,
  groupDrafts,
  toGroupInputs,
  comboGroupsError,
  MAX_COMBO_GROUPS,
  MAX_COMBO_OPTIONS,
  draftComponentsPrice,
  type ComboGroupDraft,
  type ComboOptionDraft,
} from './lib/combo';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

// ----------------------------------------------------------------------
// Combo: một món không có size (tạo ở trang Hàng hoá, giá bán = giá combo) gồm các nhóm thành phần; mỗi nhóm khách chọn
// đúng một lựa chọn (nhóm một lựa chọn = thành phần cố định), lựa chọn đầu là mặc định, có thể có phụ thu. Bán combo là
// một dòng trên đơn; phiếu bar in từng món thành phần; nguyên liệu trừ theo định lượng của từng món; hoá đơn chia giá
// combo vào từng món theo tỷ lệ giá bán lẻ.
// ----------------------------------------------------------------------

const money = (value: number) => fCurrency(value) || '0 đ';

type Target = { productId: string; name: string; price: number; combo: IFnbComboItem | null };

export default function FnbComboTab({ branchId }: { branchId: string }) {
  const [confirm, confirmDialog] = useConfirmDialog();
  const { enqueueSnackbar } = useSnackbar();
  const [book, setBook] = useState<IFnbComboBook | null>(null);
  const [editing, setEditing] = useState<Target | null>(null);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      setBook(await getFnbCombos(branchId));
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được danh sách combo'), { variant: 'error' });
      setBook({ combos: [], candidates: [], choices: [] });
    }
  }, [branchId, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  if (!book) return null;

  const remove = async (combo: IFnbComboItem) => {
    const ok = await confirm({
      title: 'Bỏ combo?',
      content: `Bỏ combo "${combo.name}"? Món vẫn còn trên thực đơn như một món thường.`,
      confirmText: 'Bỏ combo',
      destructive: true,
    });
    if (!ok) return;
    try {
      await setFnbCombo(combo.productId, []);
      enqueueSnackbar('Đã bỏ combo');
      await load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không bỏ được combo'), { variant: 'error' });
    }
  };

  return (
    <Stack spacing={2}>
      {confirmDialog}
      <Alert severity="info">
        Combo là một món không có size, giá bán của món là giá combo. Mỗi nhóm khách chọn đúng một lựa chọn — nhóm chỉ có
        một lựa chọn là thành phần cố định, lựa chọn đứng đầu là mặc định, lựa chọn đắt hơn có thể đặt phụ thu. Nguyên
        liệu trừ theo định lượng của từng món thành phần; doanh thu chia vào từng món theo tỷ lệ giá bán lẻ.
      </Alert>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setPicking(true)}
        >
          Thêm combo
        </Button>
      </Stack>

      {book.combos.length === 0 ? (
        <Alert severity="warning">
          Chưa có combo. Tạo một món ở trang Hàng hoá (Loại mặt hàng = Món, không có size, giá bán = giá combo) rồi bấm
          &quot;Thêm combo&quot; để khai các món thành phần.
        </Alert>
      ) : (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Combo</TableCell>
                  <TableCell>Thành phần</TableCell>
                  <TableCell align="right">Giá combo</TableCell>
                  <TableCell align="right">Mua lẻ</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {book.combos.map((combo) => (
                  <ComboRow
                    key={combo.productId}
                    combo={combo}
                    onEdit={() =>
                      setEditing({ productId: combo.productId, name: combo.name, price: combo.price, combo })
                    }
                    onRemove={() => remove(combo)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      <PickDishDialog
        open={picking}
        candidates={book.candidates}
        onClose={() => setPicking(false)}
        onPick={(c) => {
          setPicking(false);
          setEditing({ productId: c.productId, name: c.name, price: c.price, combo: null });
        }}
      />

      <ComboDialog
        target={editing}
        choices={book.choices}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

function ComboRow({ combo, onEdit, onRemove }: { combo: IFnbComboItem; onEdit: VoidFunction; onRemove: VoidFunction }) {
  const saving = comboSaving(combo);
  return (
    <TableRow hover>
      <TableCell sx={{ verticalAlign: 'top' }}>
        <Typography variant="subtitle2">{combo.name}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {combo.code}
        </Typography>
        {!combo.isOnMenu && (
          <Chip size="small" color="warning" variant="soft" label="Chưa lên thực đơn" sx={{ mt: 0.5 }} />
        )}
      </TableCell>
      <TableCell sx={{ verticalAlign: 'top' }}>
        {combo.groups.map((group) => (
          <Typography key={group.id} variant="body2" sx={{ mb: 0.25 }}>
            <b>{group.name}:</b>{' '}
            {group.options
              .map(
                (o) =>
                  `${choiceLabel(o)}${o.quantity > 1 ? ` x${o.quantity}` : ''}${
                    o.surcharge > 0 ? ` (+${money(o.surcharge)})` : ''
                  }${o.isAvailable ? '' : ' — không còn bán'}`
              )
              .join(' / ')}
          </Typography>
        ))}
      </TableCell>
      <TableCell align="right" sx={{ verticalAlign: 'top' }}>
        {money(combo.price)}
      </TableCell>
      <TableCell align="right" sx={{ verticalAlign: 'top' }}>
        {money(combo.componentsPrice)}
        {saving !== 0 && (
          <Typography variant="caption" color={saving > 0 ? 'success.main' : 'error.main'} display="block">
            {saving > 0 ? `rẻ hơn ${money(saving)}` : `đắt hơn ${money(-saving)}`}
          </Typography>
        )}
      </TableCell>
      <TableCell align="right" sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
        <Button size="small" onClick={onEdit}>
          Sửa
        </Button>
        <Button size="small" color="error" onClick={onRemove}>
          Bỏ combo
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ----------------------------------------------------------------------

function PickDishDialog({
  open,
  candidates,
  onClose,
  onPick,
}: {
  open: boolean;
  candidates: IFnbComboBook['candidates'];
  onClose: VoidFunction;
  onPick: (candidate: IFnbComboBook['candidates'][number]) => void;
}) {
  const [picked, setPicked] = useState<IFnbComboBook['candidates'][number] | null>(null);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Chọn món làm combo</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Chọn một món không có size, chưa có định lượng riêng. Chưa có món? Tạo ở trang Hàng hoá với Loại mặt hàng =
            Món và giá bán = giá combo.
          </Typography>
          <Autocomplete
            options={candidates}
            value={picked}
            onChange={(_, value) => setPicked(value)}
            getOptionLabel={(c) => `${c.name} · ${money(c.price)}`}
            isOptionEqualToValue={(a, b) => a.productId === b.productId}
            noOptionsText="Không có món nào phù hợp"
            renderInput={(params) => <TextField {...params} autoFocus label="Món" />}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Huỷ
        </Button>
        <Button variant="contained" disabled={!picked} onClick={() => picked && onPick(picked)}>
          Khai thành phần
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function ComboDialog({
  target,
  choices,
  onClose,
  onSaved,
}: {
  target: Target | null;
  choices: IFnbComboBook['choices'];
  onClose: VoidFunction;
  onSaved: () => Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [groups, setGroups] = useState<ComboGroupDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) setGroups(groupDrafts(target.combo));
  }, [target]);

  const choiceById = useMemo(() => new Map(choices.map((c) => [c.productId, c])), [choices]);
  const error = comboGroupsError(groups);
  const retail = draftComponentsPrice(groups, choices);

  const setGroup = (index: number, patch: Partial<ComboGroupDraft>) =>
    setGroups((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));

  const setOption = (groupIndex: number, optionIndex: number, patch: Partial<ComboOptionDraft>) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIndex
          ? { ...g, options: g.options.map((o, j) => (j === optionIndex ? { ...o, ...patch } : o)) }
          : g
      )
    );

  const save = async () => {
    if (!target || error) return;
    setSaving(true);
    try {
      await setFnbCombo(target.productId, toGroupInputs(groups));
      enqueueSnackbar('Đã lưu combo');
      await onSaved();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, 'Không lưu được combo'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="md" open={!!target} onClose={onClose}>
      <DialogTitle>
        {target?.name} · {money(target?.price ?? 0)}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          {groups.map((group, groupIndex) => (
            // eslint-disable-next-line react/no-array-index-key
            <Stack key={groupIndex} spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label={`Tên nhóm ${groupIndex + 1}`}
                  placeholder="vd Đồ uống, Bánh"
                  value={group.name}
                  onChange={(e) => setGroup(groupIndex, { name: e.target.value })}
                  sx={{ flexGrow: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {group.options.length > 1 ? 'Khách chọn 1' : 'Cố định'}
                </Typography>
                <IconButton
                  color="error"
                  disabled={groups.length <= 1}
                  onClick={() => setGroups((prev) => prev.filter((_, i) => i !== groupIndex))}
                >
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Stack>

              {group.options.map((option, optionIndex) => (
                // eslint-disable-next-line react/no-array-index-key
                <Stack key={optionIndex} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Autocomplete
                    size="small"
                    options={choices}
                    value={choiceById.get(option.productId) ?? null}
                    onChange={(_, value) => setOption(groupIndex, optionIndex, { productId: value?.productId ?? '' })}
                    getOptionLabel={(c) => `${choiceLabel(c)} · ${money(c.price)}`}
                    isOptionEqualToValue={(a, b) => a.productId === b.productId}
                    noOptionsText="Không có món nào"
                    sx={{ flexGrow: 1 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={optionIndex === 0 ? 'Món (mặc định)' : 'Món'}
                        error={!!option.productId && !choiceById.has(option.productId)}
                        helperText={
                          option.productId && !choiceById.has(option.productId) ? 'Món không còn bán — chọn món khác' : undefined
                        }
                      />
                    )}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Số lượng"
                    value={option.quantity}
                    onChange={(e) => setOption(groupIndex, optionIndex, { quantity: e.target.value })}
                    inputProps={{ min: 1, max: 20, step: 1 }}
                    sx={{ width: { sm: 110 } }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Phụ thu"
                    value={option.surcharge}
                    onChange={(e) => setOption(groupIndex, optionIndex, { surcharge: e.target.value })}
                    inputProps={{ min: 0, step: 1000 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                    sx={{ width: { sm: 150 } }}
                  />
                  <IconButton
                    disabled={group.options.length <= 1}
                    onClick={() =>
                      setGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })
                    }
                  >
                    <Iconify icon="mingcute:close-line" width={18} />
                  </IconButton>
                </Stack>
              ))}

              <Stack direction="row">
                <Button
                  size="small"
                  startIcon={<Iconify icon="mingcute:add-line" />}
                  disabled={group.options.length >= MAX_COMBO_OPTIONS}
                  onClick={() => setGroup(groupIndex, { options: [...group.options, emptyOption()] })}
                >
                  Thêm lựa chọn
                </Button>
              </Stack>
            </Stack>
          ))}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Button
              variant="outlined"
              size="small"
              startIcon={<Iconify icon="mingcute:add-line" />}
              disabled={groups.length >= MAX_COMBO_GROUPS}
              onClick={() => setGroups((prev) => [...prev, emptyGroup()])}
            >
              Thêm nhóm
            </Button>
            {target && retail > 0 && (
              <Typography variant="body2" color="text.secondary">
                Mua lẻ lựa chọn mặc định: {money(retail)} ·{' '}
                {retail >= target.price
                  ? `combo rẻ hơn ${money(retail - target.price)}`
                  : `combo đắt hơn ${money(target.price - retail)}`}
              </Typography>
            )}
          </Stack>

          {error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!!error} onClick={save}>
          Lưu combo
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
