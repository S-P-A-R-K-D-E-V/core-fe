'use client';

import type { IFnbMenu, IFnbMenuDish } from 'src/types/fnb';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import { quickNotesFor, sortedVariants, variantSoldOut, defaultVariant, allowedToppings } from './lib/menu';
import { itemDraft, MAX_QTY, MAX_NOTE_LEN, openItemDraft, MAX_QUICK_NOTES, MAX_TOPPING_QTY } from './lib/draft';

import type { DraftLine } from './lib/draft';

// ----------------------------------------------------------------------

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <IconButton size="small" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Iconify icon="eva:minus-fill" />
      </IconButton>
      <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{value}</Typography>
      <IconButton size="small" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Iconify icon="eva:plus-fill" />
      </IconButton>
    </Stack>
  );
}

type DishProps = {
  open: boolean;
  menu: IFnbMenu | null;
  dish: IFnbMenuDish | null;
  onClose: VoidFunction;
  onAdd: (line: DraftLine) => void;
};

/** Chọn size, món thêm, ghi chú cho một món rồi thêm vào lượt đang chọn. */
export function FnbDishDialog({ open, menu, dish, onClose, onAdd }: DishProps) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [toppingQty, setToppingQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open || !dish) return;
    setVariantId(defaultVariant(dish)?.productId ?? null);
    setToppingQty({});
    setNotes([]);
    setNote('');
    setQuantity(1);
  }, [open, dish]);

  if (!dish) return null;

  const variants = sortedVariants(dish);
  const variant = variants.find((v) => v.productId === variantId) ?? null;
  const toppings = allowedToppings(menu, dish);
  const quickNotes = quickNotesFor(menu, dish);
  const toppingSum = toppings.reduce((s, t) => s + (toppingQty[t.productId] ?? 0) * t.price, 0);
  const preview = variant ? quantity * (variant.price + toppingSum) : 0;

  const add = () => {
    if (!variant) return;
    onAdd(
      itemDraft(dish, variant, {
        quantity,
        toppings: toppings
          .filter((t) => (toppingQty[t.productId] ?? 0) > 0)
          .map((t) => ({ productId: t.productId, name: t.name, quantity: toppingQty[t.productId], unitPrice: t.price })),
        quickNotes: notes,
        note,
      })
    );
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose}>
      <DialogTitle>{dish.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {variants.length > 1 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Size</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {variants.map((v) => {
                  const out = variantSoldOut(dish, v);
                  return (
                    <Chip
                      key={v.productId}
                      label={`${v.name ?? ''} · ${fCurrency(v.price)}${out ? ' · hết' : ''}`}
                      color={v.productId === variantId ? 'primary' : 'default'}
                      variant={v.productId === variantId ? 'filled' : 'outlined'}
                      disabled={out}
                      onClick={() => setVariantId(v.productId)}
                    />
                  );
                })}
              </Stack>
            </Stack>
          )}

          {toppings.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Món thêm (mỗi ly)</Typography>
              {toppings.map((t) => (
                <Stack key={t.productId} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" sx={{ opacity: t.isSoldOut ? 0.4 : 1 }}>
                    {t.name} · +{fCurrency(t.price)}
                    {t.isSoldOut ? ' · hết' : ''}
                  </Typography>
                  {!t.isSoldOut && (
                    <Stepper
                      value={toppingQty[t.productId] ?? 0}
                      min={0}
                      max={MAX_TOPPING_QTY}
                      onChange={(v) => setToppingQty((prev) => ({ ...prev, [t.productId]: v }))}
                    />
                  )}
                </Stack>
              ))}
            </Stack>
          )}

          {quickNotes.length > 0 && (
            <Stack spacing={1}>
              <Typography variant="subtitle2">Ghi chú nhanh</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {quickNotes.map((n) => {
                  const on = notes.includes(n.text);
                  return (
                    <Chip
                      key={n.id}
                      label={n.text}
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      onClick={() =>
                        setNotes((prev) =>
                          on ? prev.filter((x) => x !== n.text) : prev.length < MAX_QUICK_NOTES ? [...prev, n.text] : prev
                        )
                      }
                    />
                  );
                })}
              </Stack>
            </Stack>
          )}

          <TextField
            label="Ghi chú"
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            inputProps={{ maxLength: MAX_NOTE_LEN }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">Số lượng</Typography>
            <Stepper value={quantity} min={1} max={MAX_QTY} onChange={setQuantity} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Huỷ
        </Button>
        <Button variant="contained" disabled={!variant} onClick={add}>
          Thêm · {fCurrency(preview)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ----------------------------------------------------------------------

type OpenItemProps = { open: boolean; onClose: VoidFunction; onAdd: (line: DraftLine) => void };

/** Món ngoài thực đơn: tên + giá tự nhập (lưu vào mặt hàng giữ chỗ "Món khác" của máy chủ). */
export function FnbOpenItemDialog({ open, onClose, onAdd }: OpenItemProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrice('');
    setQuantity(1);
    setNote('');
  }, [open]);

  const valid = name.trim().length > 0 && Number(price) >= 0 && price !== '';

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Món khác</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField autoFocus label="Tên món" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            type="number"
            label="Giá"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputProps={{ min: 0, step: 1000 }}
          />
          <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2">Số lượng</Typography>
            <Stepper value={quantity} min={1} max={MAX_QTY} onChange={setQuantity} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Huỷ
        </Button>
        <Button
          variant="contained"
          disabled={!valid}
          onClick={() => {
            onAdd(openItemDraft({ name, unitPrice: Number(price), quantity, note }));
            onClose();
          }}
        >
          Thêm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
