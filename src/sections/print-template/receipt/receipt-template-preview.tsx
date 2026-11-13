'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';

import { getAllSalesOrders, getSalesOrderReceipt } from 'src/api/sales-orders';

import type { ISalesOrder, ISalesOrderReceipt } from 'src/types/corecms-api';

import { renderReceiptTemplate } from './receipt-template-render';

import type { RenderedReceiptTemplate } from './receipt-template-render';
import type { ReceiptTemplateSettings } from './receipt-template-settings';

// ----------------------------------------------------------------------
// Xem trước mẫu hoá đơn với dữ liệu mẫu, một hoá đơn thật gần đây hoặc hoá đơn tìm theo mã: hiện ĐÚNG tài liệu sẽ gửi máy in
// (iframe sandbox, không chạy script). Dựng lại sau khi người soạn ngừng gõ một chút. Trang thu nhỏ theo bề rộng THẬT của
// khung (đo bằng ResizeObserver) — không tràn ngang, không mất chữ hai mép.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const DEBOUNCE_MS = 300;
const SAMPLE = '__sample__';

type Props = {
  content: string;
  settings: ReceiptTemplateSettings;
  sample: ISalesOrderReceipt;
  /** Bề rộng tối đa của trang xem trước (px); khung hẹp hơn thì thu nhỏ theo khung. */
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
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [searching, setSearching] = useState(false);

  // Đo bề rộng khung xem trước (cột phải co giãn theo màn hình).
  const observerRef = useRef<ResizeObserver | null>(null);
  const frameRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setFrameWidth(width);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  /** Tìm hoá đơn theo mã (khớp đúng mã trước, không thì hoá đơn đầu tiên tìm được). */
  const findByCode = () => {
    const keyword = code.trim();
    if (!keyword || searching) return;
    setSearching(true);
    getAllSalesOrders({ keyword, pageNumber: 1, pageSize: 5 })
      .then((page) => {
        const items = page.items ?? [];
        const found =
          items.find((order) => order.orderNumber?.toLowerCase() === keyword.toLowerCase()) ??
          items[0];
        if (!found) {
          setLoadError(`Không tìm thấy hoá đơn "${keyword}"`);
          return;
        }
        setOrders((current) =>
          current?.some((order) => order.id === found.id) ? current : [found, ...(current ?? [])]
        );
        setSource(found.id);
      })
      .catch((error) => setLoadError(apiErrorMessage(error, 'Không tìm được hoá đơn')))
      .finally(() => setSearching(false));
  };

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
  const FRAME_PADDING_PX = 16;
  const available = Math.min(maxWidthPx, (frameWidth ?? maxWidthPx) - FRAME_PADDING_PX);
  const scale = page ? Math.max(0.1, Math.min(1.25, available / (page.widthMm * PX_PER_MM))) : 1;

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

      <TextField
        size="small"
        label="Tìm hoá đơn theo mã"
        placeholder="VD: HD081216"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            findByCode();
          }
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                aria-label="Tìm hoá đơn"
                onClick={findByCode}
                disabled={!code.trim() || searching}
              >
                {searching ? <CircularProgress size={16} /> : <Iconify icon="eva:search-fill" width={18} />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Box
        ref={frameRef}
        sx={{
          position: 'relative',
          display: 'block',
          p: 1,
          overflowX: 'hidden',
          overflowY: 'auto',
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
              mx: 'auto',
              bgcolor: 'common.white',
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
