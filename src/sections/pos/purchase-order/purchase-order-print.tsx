'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';
import { printHtmlDocument } from 'src/utils/print-html';

import { getPrintTemplates } from 'src/api/print-templates';
import { getPurchaseOrderPrint } from 'src/api/purchase-orders';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { resolveAppliedTemplate } from 'src/sections/print-template/print-template-resolve';
import { compileReceiptBlocks } from 'src/sections/print-template/receipt/blocks/receipt-blocks-compile';
import { purchaseDocument } from 'src/sections/print-template/purchase/purchase-template-fields';
import { renderReceiptTemplate } from 'src/sections/print-template/receipt/receipt-template-render';
import {
  starterBlocks,
  PURCHASE_BLOCK_STARTERS,
} from 'src/sections/print-template/receipt/blocks/receipt-blocks';
import {
  defaultReceiptSettings,
  normalizeReceiptSettings,
} from 'src/sections/print-template/receipt/receipt-template-settings';

import type { IPrintTemplate } from 'src/types/print-template';
import type { IPurchaseOrderPrint } from 'src/types/purchase-print';
import type { RenderedReceiptTemplate } from 'src/sections/print-template/receipt/receipt-template-render';

// ----------------------------------------------------------------------
// In phiếu nhập hàng: tải phiếu (GET /purchase-orders/{id}/print) + mẫu phiếu nhập của cửa hàng, chọn sẵn mẫu đang áp dụng
// (Cài đặt cửa hàng › Mẫu in › Phiếu nhập), chưa có thì mẫu hệ thống A4; xem trước đúng trang sẽ in rồi mở hộp thoại in.
// Mẫu hệ thống = bố cục khởi đầu của trình soạn khối (A4 / giấy cuộn 80 mm). Không đọc được mẫu (thiếu quyền / gói) → chỉ
// còn mẫu hệ thống.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const SYSTEM_PREFIX = 'system:';
const PREVIEW_MAX_PX = 560;

type TemplateOption = { value: string; label: string; template: Pick<IPrintTemplate, 'content' | 'settings'> };

function systemOptions(): TemplateOption[] {
  return PURCHASE_BLOCK_STARTERS.map((starter) => {
    const { paper, items } = starterBlocks(starter.key, 'purchase');
    const settings = defaultReceiptSettings(paper);
    return {
      value: `${SYSTEM_PREFIX}${starter.key}`,
      label: `Mẫu hệ thống — ${starter.label}`,
      template: { content: compileReceiptBlocks(items, settings), settings: JSON.stringify(settings) },
    };
  });
}

type DialogProps = {
  open: boolean;
  orderId: string;
  orderNumber?: string;
  onClose: () => void;
};

export function PurchaseOrderPrintDialog({ open, orderId, orderNumber, onClose }: DialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [print, setPrint] = useState<IPurchaseOrderPrint | null>(null);
  const [templates, setTemplates] = useState<IPrintTemplate[]>([]);
  const [choice, setChoice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedReceiptTemplate | null>(null);
  const [rendering, setRendering] = useState(false);

  const system = useMemo(systemOptions, []);
  const options = useMemo<TemplateOption[]>(
    () => [
      ...templates.map((t) => ({ value: t.id, label: t.name, template: t })),
      ...system,
    ],
    [templates, system]
  );

  // Mở hộp thoại → tải phiếu + mẫu (mẫu lỗi thì bỏ qua, in bằng mẫu hệ thống).
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setPrint(null);
    setRendered(null);
    setError(null);
    Promise.all([
      getPurchaseOrderPrint(orderId),
      getPrintTemplates('purchase').catch(() => null),
    ])
      .then(([value, list]) => {
        if (!active) return;
        const own = (list?.templates ?? []).filter((t) => t.kind === 'purchase');
        const applied = resolveAppliedTemplate(list, 'purchase');
        setTemplates(own);
        setPrint(value);
        setChoice(applied?.id ?? `${SYSTEM_PREFIX}${PURCHASE_BLOCK_STARTERS[0].key}`);
      })
      .catch((loadError) => {
        if (active) setError(apiErrorMessage(loadError, 'Không tải được phiếu nhập để in'));
      });
    return () => {
      active = false;
    };
  }, [open, orderId]);

  const selected = options.find((option) => option.value === choice) ?? null;

  useEffect(() => {
    if (!print || !selected) return undefined;
    let active = true;
    setRendering(true);
    const settings = normalizeReceiptSettings(selected.template.settings);
    renderReceiptTemplate({ content: selected.template.content, settings }, purchaseDocument(print))
      .then((result) => {
        if (active) setRendered(result);
      })
      .catch((renderError) => {
        console.error(renderError);
        if (active) setError('Không dựng được trang in từ mẫu này');
      })
      .finally(() => {
        if (active) setRendering(false);
      });
    return () => {
      active = false;
    };
  }, [print, selected]);

  const handlePrint = () => {
    if (!rendered) return;
    printHtmlDocument(rendered.html).catch((printError) => {
      console.error(printError);
      enqueueSnackbar('Không mở được hộp thoại in của trình duyệt', { variant: 'error' });
    });
  };

  const page = rendered?.page;
  const scale = page ? Math.min(1, PREVIEW_MAX_PX / (page.widthMm * PX_PER_MM)) : 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>In phiếu nhập {orderNumber ?? print?.purchase.code ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            size="small"
            label="Mẫu in"
            value={selected ? choice : ''}
            onChange={(event) => setChoice(event.target.value)}
            disabled={!print}
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Box
            sx={{
              position: 'relative',
              p: 1,
              minHeight: 240,
              maxHeight: '60vh',
              overflow: 'auto',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#dfe3e8',
            }}
          >
            {!print && !error && (
              <Stack alignItems="center" sx={{ py: 8 }}>
                <CircularProgress />
              </Stack>
            )}
            {page && rendered && (
              <Box
                sx={{
                  mx: 'auto',
                  bgcolor: 'common.white',
                  width: page.widthMm * PX_PER_MM * scale,
                  height: page.heightMm * PX_PER_MM * scale,
                  overflow: 'hidden',
                }}
              >
                <iframe
                  title="Xem trước phiếu nhập"
                  sandbox=""
                  srcDoc={rendered.html}
                  style={{
                    display: 'block',
                    border: 0,
                    width: `${page.widthMm}mm`,
                    height: `${page.heightMm}mm`,
                    transform: `scale(${scale})`,
                    transformOrigin: '0 0',
                  }}
                />
              </Box>
            )}
            {rendering && (
              <CircularProgress size={20} sx={{ position: 'absolute', top: 8, right: 8 }} />
            )}
          </Box>
          {page && (
            <Typography variant="caption" color="text.secondary">
              Trang in {page.widthMm} × {page.heightMm} mm. Trong hộp thoại in: Tỉ lệ 100%, bỏ “Đầu trang và chân
              trang”. Đổi mẫu mặc định ở Cài đặt cửa hàng › Mẫu in › Phiếu nhập.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Đóng
        </Button>
        <Button
          variant="contained"
          disabled={!rendered || rendering}
          onClick={handlePrint}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        >
          In
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Nút "In phiếu" + hộp in. */
export function PurchaseOrderPrintButton({
  orderId,
  orderNumber,
  variant = 'outlined',
}: {
  orderId: string;
  orderNumber?: string;
  variant?: 'outlined' | 'contained' | 'text';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        color="inherit"
        startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        onClick={() => setOpen(true)}
      >
        In phiếu
      </Button>
      <PurchaseOrderPrintDialog
        open={open}
        orderId={orderId}
        orderNumber={orderNumber}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
