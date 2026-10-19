'use client';

import { memo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
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
import { issueLabel, LINE_STATUS, parseAmount } from './purchase-import-utils';

// ----------------------------------------------------------------------
// Một dòng hoá đơn trong drawer duyệt nhanh, gọn như một hàng trên toa: [tích tạo mã mới] số dòng · chữ gốc · SL × giá =
// tiền · trạng thái; hàng dưới là mã đã chốt, hoặc gợi ý số 1 kèm "Đúng". Bấm ▾ mở thêm: các gợi ý khác (kèm lý do),
// tìm mã, sửa số, bỏ dòng, gắn ảnh sản phẩm. Dòng trợ lý / người duyệt vừa sửa được tô sáng.
// ----------------------------------------------------------------------

/** Drawer ở zIndex 1450 — danh sách gợi ý / menu phải nổi trên nó. */
export const DRAWER_POPPER_Z = 1500;

type Props = {
  line: IPurchaseImportLine;
  /** Tên của dòng có tên phía trên — dòng "như trên". */
  familyName?: string | null;
  /** Ảnh sản phẩm của lần nhập (S1, S2…) để gắn vào dòng. */
  productImages: IPurchaseImportImage[];
  editable: boolean;
  busy: boolean;
  highlighted: boolean;
  onSave: (patch: IUpdatePurchaseImportLineRequest) => void;
  onZoomImage: (url: string) => void;
  /** Ô tích "tạo mã mới" (dòng chưa có mã, người duyệt có quyền tạo sản phẩm). */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  selectable = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [lineTotal, setLineTotal] = useState('');
  const [imageMenu, setImageMenu] = useState<HTMLElement | null>(null);

  const skipped = line.status === 'Skipped';
  const chosen = line.productId
    ? line.candidates.find((c) => c.productId === line.productId)
    : undefined;
  const top = !chosen ? line.candidates[0] : undefined;
  const others = line.candidates
    .filter((c) => c.productId !== line.productId && c.productId !== top?.productId)
    .slice(0, 3);
  const status = LINE_STATUS[line.status];
  const imageIndex = line.imageId ? productImages.findIndex((i) => i.id === line.imageId) : -1;
  const issues = line.issues.filter((i) => i !== 'unit_converted');
  const showName =
    !line.sameAsAbove &&
    !!line.name &&
    !line.rawText.toLowerCase().includes(line.name.toLowerCase());

  // Chọn xong (hoặc dữ liệu tải lại) thì thu gọn.
  useEffect(() => setExpanded(false), [line.productId, line.status]);
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
        px: 1,
        py: 0.75,
        borderRadius: 1.25,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        opacity: skipped ? 0.55 : 1,
        transition: 'background-color 600ms ease',
        bgcolor: (theme) => (highlighted ? alpha(theme.palette.success.main, 0.1) : 'transparent'),
      }}
    >
      {/* Hàng 1: như trên toa */}
      <Stack direction="row" spacing={0.75} alignItems="center">
        {selectable ? (
          <Checkbox
            size="small"
            checked={selected}
            onChange={onToggleSelect}
            inputProps={{ 'aria-label': `Tạo mã mới cho dòng ${line.lineNo}` }}
            title="Tích để tạo mã mới cho dòng này"
            sx={{ p: 0.25 }}
          />
        ) : (
          <Box sx={{ width: 26, flexShrink: 0 }} />
        )}
        <Typography
          variant="caption"
          sx={{ color: 'text.disabled', width: 18, flexShrink: 0, textAlign: 'right' }}
        >
          {line.lineNo}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }} noWrap title={line.rawText}>
            {line.rawText}
          </Typography>
          {showName && (
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', lineHeight: 1.2 }}
            >
              {line.name}
              {line.unitText ? ` · ${line.unitText}` : ''}
            </Typography>
          )}
        </Box>
        <Typography
          variant="body2"
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', textAlign: 'right' }}
        >
          {line.quantity ?? '?'} × {line.unitPrice != null ? fCurrency(line.unitPrice) : '?'} ={' '}
          <strong>{line.lineTotal != null ? fCurrency(line.lineTotal) : '?'}</strong>
        </Typography>
        <Label color={status.color} sx={{ flexShrink: 0 }}>
          {status.label}
        </Label>
        {line.imageUrl && (
          <Box
            component="img"
            src={getStorageUrl(line.imageUrl)}
            alt={`Ảnh sản phẩm dòng ${line.lineNo}`}
            onClick={() => onZoomImage(getStorageUrl(line.imageUrl))}
            sx={{
              width: 30,
              height: 30,
              borderRadius: 0.75,
              objectFit: 'cover',
              cursor: 'zoom-in',
              flexShrink: 0,
            }}
          />
        )}
        {editable && !skipped && (
          <Tooltip title={expanded ? 'Thu gọn' : 'Chọn mã khác, sửa số, bỏ dòng…'}>
            <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ flexShrink: 0 }}>
              <Iconify
                icon="eva:arrow-ios-downward-fill"
                width={16}
                sx={{
                  transition: 'transform 150ms',
                  transform: expanded ? 'rotate(180deg)' : 'none',
                }}
              />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Hàng 2: mã đã chốt / gợi ý số 1 */}
      {!skipped && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ pl: '50px', mt: 0.25, minHeight: 26 }}
        >
          {chosen ? (
            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }} title={chosen.reason}>
              <Iconify
                icon="solar:check-circle-bold"
                width={14}
                sx={{ color: 'success.main', mr: 0.5, verticalAlign: -2 }}
              />
              <strong>{chosen.code}</strong> — {chosen.name}
            </Typography>
          ) : top ? (
            <>
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }} title={top.reason}>
                <Box component="span" sx={{ color: 'warning.main', mr: 0.5 }}>
                  Có thể là
                </Box>
                <strong>{top.code}</strong> — {top.name}
                <Box
                  component="span"
                  sx={{ color: 'text.secondary', ml: 0.75, typography: 'caption' }}
                >
                  {top.reason}
                </Box>
              </Typography>
              {editable && (
                <Button
                  size="small"
                  variant="soft"
                  color="primary"
                  disabled={busy}
                  onClick={() => onSave({ productId: top.productId })}
                  sx={{ flexShrink: 0, minWidth: 0, px: 1 }}
                >
                  Đúng
                </Button>
              )}
            </>
          ) : (
            <Typography variant="caption" color="error.main" sx={{ flex: 1 }}>
              Chưa có mã{line.sameAsAbove && familyName ? ` — như trên (${familyName})` : ''} — chọn
              mã hoặc tích để tạo mã mới
            </Typography>
          )}
        </Stack>
      )}

      {issues.length > 0 && !skipped && (
        <Stack
          direction="row"
          spacing={0.5}
          flexWrap="wrap"
          useFlexGap
          sx={{ pl: '50px', mt: 0.25 }}
        >
          {issues.map((issue) => (
            <Chip
              key={issue}
              size="small"
              color="warning"
              variant="soft"
              label={issueLabel(issue)}
              sx={{ height: 20 }}
            />
          ))}
        </Stack>
      )}

      {/* Mở thêm: gợi ý khác, tìm mã, sửa số, bỏ dòng, gắn ảnh */}
      <Collapse in={expanded && editable} unmountOnExit>
        <Stack spacing={0.75} sx={{ pl: '50px', mt: 0.75 }}>
          {others.map((c) => (
            <Stack key={c.productId} direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
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
                disabled={busy}
                onClick={() => onSave({ productId: c.productId })}
                sx={{ flexShrink: 0 }}
              >
                Chọn
              </Button>
            </Stack>
          ))}
          <PurchaseImportProductPicker
            defaultKeyword={line.name || familyName || undefined}
            disabled={busy}
            popperZIndex={DRAWER_POPPER_Z}
            onPick={(product) => onSave({ productId: product.id })}
          />

          {editingNumbers && (
            <Stack direction="row" spacing={0.75} alignItems="center">
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
          )}

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => setEditingNumbers((v) => !v)}
            >
              {editingNumbers ? 'Thôi sửa số' : 'Sửa số'}
            </Button>
            <Button
              size="small"
              color="inherit"
              disabled={busy}
              onClick={() => onSave({ skip: true })}
            >
              Bỏ dòng
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
        </Stack>
      </Collapse>

      {skipped && editable && (
        <Stack direction="row" sx={{ pl: '50px' }}>
          <Button
            size="small"
            color="inherit"
            disabled={busy}
            onClick={() => onSave({ skip: false })}
          >
            Lấy lại dòng
          </Button>
        </Stack>
      )}

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
