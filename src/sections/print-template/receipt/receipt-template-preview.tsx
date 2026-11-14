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

import { renderReceiptTemplate } from './receipt-template-render';

import type { ReceiptTemplateSettings } from './receipt-template-settings';
import type { PrintSource, RenderedReceiptTemplate } from './receipt-template-render';

// ----------------------------------------------------------------------
// Xem trước mẫu hoá đơn với dữ liệu mẫu, một hoá đơn thật gần đây hoặc hoá đơn tìm theo mã: hiện ĐÚNG tài liệu sẽ gửi máy in
// (iframe sandbox, không chạy script). Dựng lại sau khi người soạn ngừng gõ một chút. Trang thu nhỏ theo bề rộng THẬT của
// khung (đo bằng ResizeObserver) — không tràn ngang, không mất chữ hai mép.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const DEBOUNCE_MS = 300;
const SAMPLE = '__sample__';

/** Một chứng từ thật để chọn xem trước. */
export type PreviewOption = { id: string; code: string; label: string };

/** Nguồn dữ liệu xem trước của một loại chứng từ: chữ trên giao diện + cách tải danh sách / tìm / đọc một chứng từ. */
export type PreviewDataSource = {
  sampleLabel: string;
  recentLoadingLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchButtonLabel: string;
  frameTitle: string;
  notFound: (keyword: string) => string;
  loadErrorLabel: string;
  searchErrorLabel: string;
  recent: () => Promise<PreviewOption[]>;
  search: (keyword: string) => Promise<PreviewOption[]>;
  load: (id: string) => Promise<PrintSource>;
};

const receiptOptions = (params: { keyword?: string; pageSize: number }) =>
  getAllSalesOrders({ ...params, pageNumber: 1 }).then((page) =>
    (page.items ?? []).map((order) => ({
      id: order.id,
      code: order.orderNumber ?? '',
      label: `${order.orderNumber}${order.customerName ? ` · ${order.customerName}` : ''}`,
    }))
  );

export const RECEIPT_PREVIEW_SOURCE: PreviewDataSource = {
  sampleLabel: 'Hoá đơn mẫu',
  recentLoadingLabel: 'Đang tải hoá đơn gần đây…',
  searchLabel: 'Tìm hoá đơn theo mã',
  searchPlaceholder: 'VD: HD081216',
  searchButtonLabel: 'Tìm hoá đơn',
  frameTitle: 'Xem trước mẫu hoá đơn',
  notFound: (keyword) => `Không tìm thấy hoá đơn "${keyword}"`,
  loadErrorLabel: 'Không tải được hoá đơn',
  searchErrorLabel: 'Không tìm được hoá đơn',
  recent: () => receiptOptions({ pageSize: 10 }),
  search: (keyword) => receiptOptions({ keyword, pageSize: 5 }),
  load: (id) => getSalesOrderReceipt(id),
};

type Props = {
  content: string;
  settings: ReceiptTemplateSettings;
  sample: PrintSource;
  /** Nguồn hoá đơn / phiếu thật để xem trước (mặc định: hoá đơn). */
  source?: PreviewDataSource;
  /** Bề rộng tối đa của trang xem trước (px); khung hẹp hơn thì thu nhỏ theo khung. */
  maxWidthPx?: number;
  /** Gọi mỗi khi dựng xong — trang chủ dùng để "In thử" đúng bản đang xem. */
  onRendered?: (rendered: RenderedReceiptTemplate | null) => void;
};

export function ReceiptTemplatePreview({
  content,
  settings,
  sample,
  source: data = RECEIPT_PREVIEW_SOURCE,
  maxWidthPx = 420,
  onRendered,
}: Props) {
  const [source, setSource] = useState(SAMPLE);
  const [orders, setOrders] = useState<PreviewOption[] | null>(null);
  const [receipt, setReceipt] = useState<PrintSource>(sample);
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
    data
      .search(keyword)
      .then((items) => {
        const found =
          items.find((order) => order.code.toLowerCase() === keyword.toLowerCase()) ?? items[0];
        if (!found) {
          setLoadError(data.notFound(keyword));
          return;
        }
        setOrders((current) =>
          current?.some((order) => order.id === found.id) ? current : [found, ...(current ?? [])]
        );
        setSource(found.id);
      })
      .catch((error) => setLoadError(apiErrorMessage(error, data.searchErrorLabel)))
      .finally(() => setSearching(false));
  };

  // Danh sách hoá đơn gần đây chỉ tải khi mở ô chọn (nhân viên không có quyền xem hết thì chỉ còn dữ liệu mẫu).
  const loadOrders = () => {
    if (orders) return;
    data
      .recent()
      .then(setOrders)
      .catch(() => setOrders([]));
  };

  useEffect(() => {
    if (source === SAMPLE) {
      setReceipt(sample);
      setLoadError(null);
      return undefined;
    }
    let active = true;
    data
      .load(source)
      .then((value) => {
        if (active) {
          setReceipt(value);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (active) setLoadError(apiErrorMessage(error, data.loadErrorLabel));
      });
    return () => {
      active = false;
    };
  }, [source, sample, data]);

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
        <MenuItem value={SAMPLE}>{data.sampleLabel}</MenuItem>
        {orders === null && source === SAMPLE && (
          <MenuItem disabled value="__loading__">
            {data.recentLoadingLabel}
          </MenuItem>
        )}
        {(orders ?? []).map((order) => (
          <MenuItem key={order.id} value={order.id}>
            {order.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        size="small"
        label={data.searchLabel}
        placeholder={data.searchPlaceholder}
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
                aria-label={data.searchButtonLabel}
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
              title={data.frameTitle}
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
