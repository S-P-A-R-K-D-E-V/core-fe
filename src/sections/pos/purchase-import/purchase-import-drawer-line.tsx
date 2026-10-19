'use client';

import { memo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { getStorageUrl } from 'src/utils/storage';
import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';

import type {
  IPurchaseImportLine,
  IPurchaseImportImage,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import PurchaseImportProductPicker from './purchase-import-product-picker';
import { issueLabel, LINE_STATUS, parseAmount, isLinePending } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Một dòng hoá đơn trong drawer duyệt nhanh (gọn cho cột ~560px): chữ gốc, số, mã đã chọn / gợi ý, sửa số, bỏ dòng,
// gắn ảnh sản phẩm. Dòng trợ lý vừa sửa được tô sáng.
// ----------------------------------------------------------------------

/** Drawer ở zIndex 1450 — danh sách gợi ý / menu phải nổi trên nó. */
export const DRAWER_POPPER_Z = 1500;

type Props = {
  line: IPurchaseImportLine;
  /** Tên của dòng phía trên — dòng ghi "như trên". */
  familyName?: string | null;
  /** Ảnh sản phẩm của lần nhập (S1, S2…) để gắn vào dòng. */
  productImages: IPurchaseImportImage[];
  editable: boolean;
  busy: boolean;
  highlighted: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
  onZoomImage: (url: string) => void;
};

function PurchaseImportDrawerLine({
  line,
  familyName,
  productImages,
  editable,
  busy,
  highlighted,
  onSave,
  onZoomImage,
}: Props) {
  const [changing, setChanging] = useState(false);
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [lineTotal, setLineTotal] = useState('');
  const [imageMenu, setImageMenu] = useState<HTMLElement | null>(null);

  const skipped = line.status === 'Skipped';
  const chosen = line.productId
    ? line.candidates.find((c) => c.productId === line.productId)
    : undefined;
  const pending = isLinePending(line);
  const showChoices = editable && !skipped && (pending || changing);
  const choices = line.candidates.filter((c) => c.productId !== line.productId).slice(0, 2);
  const status = LINE_STATUS[line.status];
  const imageIndex = line.imageId ? productImages.findIndex((i) => i.id === line.imageId) : -1;

  useEffect(() => setChanging(false), [line.productId]);
  useEffect(() => {
    if (!editingNumbers) return;
    setQuantity(line.quantity != null ? String(line.quantity) : '');
    setUnitPrice(line.unitPrice != null ? String(line.unitPrice) : '');
    setLineTotal(line.lineTotal != null ? String(line.lineTotal) : '');
  }, [editingNumbers, line.quantity, line.unitPrice, line.lineTotal]);

  const saveNumbers = () => {
    const patch: IUpdatePurchaseImportLineRequest = {};
    const q = parseAmount(quantity);
    const p = parseAmount(unitPrice);
    const t = parseAmount(lineTotal);
    if (q != null && q !== line.quantity) patch.quantity = q;
    if (p != null && p !== line.unitPrice) patch.unitPrice = p;
    if (t != null && t !== line.lineTotal) patch.lineTotal = t;
    setEditingNumbers(false);
    if (Object.keys(patch).length > 0) onSave(patch);
  };

  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        opacity: skipped ? 0.55 : 1,
        transition: 'background-color 600ms ease',
        bgcolor: (theme) => (highlighted ? alpha(theme.palette.success.main, 0.1) : 'transparent'),
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 18, pt: 0.25 }}>
          {line.lineNo}
        </Typography>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', flex: 1, minWidth: 0 }}
              noWrap
              title={line.rawText}
            >
              {line.rawText}
            </Typography>
            <Label color={status.color} sx={{ flexShrink: 0 }}>
              {status.label}
            </Label>
          </Stack>

          {(line.name || line.sameAsAbove) && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
              {line.sameAsAbove ? `Như trên${familyName ? ` (${familyName})` : ''}` : line.name}
              {line.unitText ? ` · ${line.unitText}` : ''}
            </Typography>
          )}

          {editingNumbers ? (
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }} alignItems="center">
              <TextField
                size="small"
                label="SL"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                sx={{ width: 72 }}
              />
              <TextField
                size="small"
                label="Đơn giá"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                label="Thành tiền"
                value={lineTotal}
                onChange={(e) => setLineTotal(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button size="small" variant="contained" disabled={busy} onClick={saveNumbers}>
                Lưu
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ mt: 0.25 }}>
              {line.quantity ?? '?'} × {line.unitPrice != null ? fCurrency(line.unitPrice) : '?'} ={' '}
              <strong>{line.lineTotal != null ? fCurrency(line.lineTotal) : '?'}</strong>
            </Typography>
          )}

          {line.issues.filter((i) => i !== 'unit_converted').length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {line.issues
                .filter((i) => i !== 'unit_converted')
                .map((issue) => (
                  <Chip
                    key={issue}
                    size="small"
                    color="warning"
                    variant="soft"
                    label={issueLabel(issue)}
                  />
                ))}
            </Stack>
          )}

          {chosen && !changing && (
            <Typography variant="body2" sx={{ mt: 0.5 }} noWrap>
              <Iconify
                icon="solar:box-bold-duotone"
                width={14}
                sx={{ color: 'success.main', mr: 0.5, verticalAlign: -2 }}
              />
              <strong>{chosen.code}</strong> — {chosen.name}
            </Typography>
          )}

          {showChoices && (
            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
              {choices.map((c, index) => (
                <Stack key={c.productId} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {index === 0 && c.productId === line.suggestedProductId && (
                        <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
                          Có thể là
                        </Box>
                      )}
                      <strong>{c.code}</strong> — {c.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      sx={{ display: 'block' }}
                    >
                      {c.reason}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="soft"
                    color="primary"
                    disabled={busy}
                    onClick={() => onSave({ productId: c.productId })}
                    sx={{ flexShrink: 0 }}
                  >
                    Đúng
                  </Button>
                </Stack>
              ))}
              <PurchaseImportProductPicker
                defaultKeyword={line.name || familyName || undefined}
                disabled={busy}
                popperZIndex={DRAWER_POPPER_Z}
                onPick={(product) => onSave({ productId: product.id })}
              />
            </Stack>
          )}

          {editable && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
              {chosen && !skipped && (
                <Button
                  size="small"
                  color="inherit"
                  disabled={busy}
                  onClick={() => setChanging((v) => !v)}
                >
                  {changing ? 'Giữ mã này' : 'Đổi mã'}
                </Button>
              )}
              {!skipped && (
                <Button
                  size="small"
                  color="inherit"
                  disabled={busy}
                  onClick={() => setEditingNumbers((v) => !v)}
                >
                  {editingNumbers ? 'Thôi sửa số' : 'Sửa số'}
                </Button>
              )}
              <Button
                size="small"
                color="inherit"
                disabled={busy}
                onClick={() => onSave({ skip: !skipped })}
              >
                {skipped ? 'Lấy lại dòng' : 'Bỏ dòng'}
              </Button>
              {productImages.length > 0 && (
                <Button
                  size="small"
                  color="inherit"
                  disabled={busy}
                  startIcon={<Iconify icon="solar:gallery-add-linear" width={16} />}
                  onClick={(event) => setImageMenu(event.currentTarget)}
                >
                  {imageIndex >= 0 ? `Ảnh S${imageIndex + 1}` : 'Gắn ảnh'}
                </Button>
              )}
            </Stack>
          )}
        </Box>

        {line.imageUrl && (
          <Box
            component="img"
            src={getStorageUrl(line.imageUrl)}
            alt={`Ảnh sản phẩm dòng ${line.lineNo}`}
            onClick={() => onZoomImage(getStorageUrl(line.imageUrl))}
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              objectFit: 'cover',
              cursor: 'zoom-in',
              flexShrink: 0,
            }}
          />
        )}
      </Stack>

      <Menu
        anchorEl={imageMenu}
        open={!!imageMenu}
        onClose={() => setImageMenu(null)}
        sx={{ zIndex: DRAWER_POPPER_Z }}
      >
        {productImages.map((image, index) => (
          <MenuItem
            key={image.id}
            selected={image.id === line.imageId}
            onClick={() => {
              setImageMenu(null);
              if (image.id !== line.imageId) onSave({ imageId: image.id });
            }}
          >
            <Box
              component="img"
              src={getStorageUrl(image.url)}
              alt={`S${index + 1}`}
              sx={{ width: 36, height: 36, borderRadius: 0.75, objectFit: 'cover', mr: 1 }}
            />
            Ảnh S{index + 1}
          </MenuItem>
        ))}
        {line.imageId && (
          <MenuItem
            onClick={() => {
              setImageMenu(null);
              onSave({ imageId: '' });
            }}
            sx={{ color: 'error.main' }}
          >
            Gỡ ảnh khỏi dòng
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

export default memo(PurchaseImportDrawerLine);
