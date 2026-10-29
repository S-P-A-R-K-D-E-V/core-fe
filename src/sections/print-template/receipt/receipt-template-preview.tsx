'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import { getAllSalesOrders, getSalesOrderReceipt } from 'src/api/sales-orders';

import type { ISalesOrder, ISalesOrderReceipt } from 'src/types/corecms-api';

import { renderReceiptTemplate } from './receipt-template-render';

import type { RenderedReceiptTemplate } from './receipt-template-render';
import type { ReceiptTemplateSettings } from './receipt-template-settings';

// ----------------------------------------------------------------------
// Xem trước mẫu hoá đơn với dữ liệu mẫu hoặc một hoá đơn thật gần đây: hiện ĐÚNG tài liệu sẽ gửi máy in (iframe sandbox,
// không chạy script). Dựng lại sau khi người soạn ngừng gõ một chút.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const DEBOUNCE_MS = 300;
const SAMPLE = '__sample__';

type Props = {
  content: string;
  settings: ReceiptTemplateSettings;
  sample: ISalesOrderReceipt;
  /** Bề rộng tối đa của khung xem trước (px) — trang rộng hơn thì thu nhỏ. */
  maxWidthPx?: number;
  /** Gọi mỗi khi dựng xong — trang chủ dùng để "In thử" đúng bản đang xem. */
  onRendered?: (rendered: RenderedReceiptTemplate | null) => void;
};

export function ReceiptTemplatePreview({
  content,
  settings,
  sample,
  maxWidthPx = 420,
  onRendered,
}: Props) {
  const [source, setSource] = useState(SAMPLE);
  const [orders, setOrders] = useState<ISalesOrder[] | null>(null);
  const [receipt, setReceipt] = useState<ISalesOrderReceipt>(sample);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendered, setRendered] = useState<RenderedReceiptTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  // Danh sách hoá đơn gần đây chỉ tải khi mở ô chọn (nhân viên không có quyền xem hết thì chỉ còn dữ liệu mẫu).
  const loadOrders = () => {
    if (orders) return;
    getAllSalesOrders({ pageNumber: 1, pageSize: 10 })
      .then((page) => setOrders(page.items ?? []))
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    if (source === SAMPLE) {
      setReceipt(sample);
      setLoadError(null);
      return undefined;
    }
    let active = true;
    getSalesOrderReceipt(source)
      .then((value) => {
        if (active) {
          setReceipt(value);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (active) setLoadError(apiErrorMessage(error, 'Không tải được hoá đơn'));
      });
    return () => {
      active = false;
    };
  }, [source, sample]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    const timer = window.setTimeout(() => {
      renderReceiptTemplate({ content, settings }, receipt)
        .then((result) => {
          if (!active) return;
          setRendered(result);
          onRendered?.(result);
        })
        .catch((error) => {
          console.error(error);
          if (active) onRendered?.(null);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [content, settings, receipt, onRendered]);

  const page = rendered?.page;
  const scale = page ? Math.min(1.25, maxWidthPx / (page.widthMm * PX_PER_MM)) : 1;

  return (
    <Stack spacing={1.5}>
      <TextField
        select
        size="small"
        label="Dữ liệu xem trước"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        SelectProps={{ onOpen: loadOrders }}
        helperText={loadError ?? undefined}
        error={!!loadError}
      >
        <MenuItem value={SAMPLE}>Hoá đơn mẫu</MenuItem>
        {orders === null && source === SAMPLE && (
          <MenuItem disabled value="__loading__">
            Đang tải hoá đơn gần đây…
          </MenuItem>
        )}
        {(orders ?? []).map((order) => (
          <MenuItem key={order.id} value={order.id}>
            {order.orderNumber}
            {order.customerName ? ` · ${order.customerName}` : ''}
          </MenuItem>
        ))}
      </TextField>

      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          overflow: 'auto',
          maxHeight: 'calc(100vh - 320px)',
          minHeight: 240,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: '#dfe3e8',
        }}
      >
        {page && rendered && (
          <Box
            sx={{
              flexShrink: 0,
              width: page.widthMm * PX_PER_MM * scale,
              height: page.heightMm * PX_PER_MM * scale,
              overflow: 'hidden',
            }}
          >
            <iframe
              title="Xem trước mẫu hoá đơn"
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
        {busy && (
          <CircularProgress
            size={20}
            sx={{ position: 'absolute', top: 8, right: 8 }}
            aria-label="Đang dựng xem trước"
          />
        )}
      </Box>
      {page && (
        <Typography variant="caption" color="text.secondary">
          Trang in {page.widthMm} × {page.heightMm} mm. Trong hộp thoại in: Lề: Không có (giấy cuộn)
          / Mặc định (A4, A5), Tỉ lệ 100%, bỏ “Đầu trang và chân trang”.
        </Typography>
      )}
    </Stack>
  );
}
