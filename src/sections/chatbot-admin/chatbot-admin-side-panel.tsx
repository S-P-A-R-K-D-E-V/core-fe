'use client';

import { useId, useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { getStorageUrl } from 'src/utils/storage';
import { fDateTime } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Lightbox from 'src/components/lightbox';

import { getPurchaseImport } from 'src/api/purchase-imports';
import { IMPORT_STATUS, lineCounts } from 'src/sections/pos/purchase-import/purchase-import-utils';
import {
  openPurchaseImportDrawer,
  PURCHASE_IMPORT_CHANGED_EVENT,
  type PurchaseImportChangedDetail,
} from 'src/sections/pos/purchase-import/purchase-import-events';

import type { ChatbotMessage } from 'src/api/chatbot';
import type { IPurchaseImport } from 'src/types/purchase-import';

// ----------------------------------------------------------------------
// Cột phải của Chatbot nội bộ (kiểu thẻ bên phải của Claude): "Tệp đã tải lên" — ảnh người dùng đã gửi trong cuộc trò
// chuyện (ảnh thuộc một lần nhập thì bấm mở drawer của lần nhập đó), và "Phiên nhập hàng" — các lần nhập từ ảnh trong
// cuộc trò chuyện, trạng thái sống, bấm mở drawer duyệt nhanh. Dựng từ danh sách tin của khung chat.
// ----------------------------------------------------------------------

const POLL_MS = 4000;

type Upload = { key: string; src: string; at: string; importId: string | null };

/** Ảnh trong tin người dùng + lần nhập mà câu trả lời ngay sau đó tạo (thẻ hoá đơn). */
export function collectUploads(messages: ChatbotMessage[]): Upload[] {
  const uploads: Upload[] = [];
  messages.forEach((message, index) => {
    if (message.role !== 'user') return;
    const images = (message.attachments ?? []).filter(
      (a) => a.url && (a.kind === 'image' || a.contentType?.startsWith('image/'))
    );
    if (images.length === 0) return;
    const reply = messages.slice(index + 1).find((m) => m.role !== 'user');
    const card = reply?.blocks?.find((b) => b.type === 'purchase-import') as
      | { importId?: string }
      | undefined;
    images.forEach((a, i) =>
      uploads.push({
        key: `${message.id}-${i}`,
        src: a.url!.startsWith('blob:') ? a.url! : getStorageUrl(a.url),
        at: message.createdAt,
        importId: card?.importId ?? null,
      })
    );
  });
  return uploads.reverse();
}

/** Các lần nhập có thẻ trong cuộc trò chuyện, mới nhất trước. */
export function collectImportIds(messages: ChatbotMessage[]): string[] {
  const ids: string[] = [];
  messages.forEach((message) =>
    (message.blocks ?? []).forEach((block) => {
      const id =
        block.type === 'purchase-import' ? (block as { importId?: string }).importId : undefined;
      if (id && !ids.includes(id)) ids.push(id);
    })
  );
  return ids.reverse();
}

type Props = {
  messages: ChatbotMessage[];
};

export default function ChatbotAdminSidePanel({ messages }: Props) {
  const uploads = useMemo(() => collectUploads(messages), [messages]);
  const importIds = useMemo(() => collectImportIds(messages), [messages]);
  const [zoom, setZoom] = useState<number | null>(null);
  const loose = useMemo(() => uploads.filter((u) => !u.importId), [uploads]);

  return (
    <Stack spacing={1.5}>
      <SideCard
        title="Tệp đã tải lên"
        icon="solar:gallery-wide-linear"
        meta={uploads.length ? `${uploads.length} ảnh` : undefined}
      >
        {uploads.length === 0 ? (
          <Empty text="Ảnh hoá đơn, ảnh sản phẩm bạn gửi trong cuộc trò chuyện sẽ hiện ở đây." />
        ) : (
          <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {uploads.map((upload) => (
              <ButtonBase
                key={upload.key}
                title={`${fDateTime(upload.at, 'HH:mm dd/MM')}${upload.importId ? ' · mở lần nhập' : ''}`}
                onClick={() =>
                  upload.importId
                    ? openPurchaseImportDrawer(upload.importId)
                    : setZoom(loose.indexOf(upload))
                }
                sx={{
                  position: 'relative',
                  borderRadius: 1.25,
                  overflow: 'hidden',
                  aspectRatio: '1 / 1',
                }}
              >
                <Box
                  component="img"
                  src={upload.src}
                  alt=""
                  sx={{ width: 1, height: 1, objectFit: 'cover' }}
                />
                {upload.importId && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      px: 0.5,
                      borderRadius: 0.75,
                      typography: 'caption',
                      fontWeight: 600,
                      color: 'common.white',
                      bgcolor: 'rgba(0,0,0,0.55)',
                    }}
                  >
                    Nhập hàng
                  </Box>
                )}
              </ButtonBase>
            ))}
          </Box>
        )}
      </SideCard>

      <SideCard
        title="Phiên nhập hàng"
        icon="solar:bill-list-linear"
        meta={importIds.length ? `${importIds.length} phiên` : undefined}
      >
        {importIds.length === 0 ? (
          <Empty text="Gửi ảnh hoá đơn nhà cung cấp (kèm ảnh sản phẩm nếu có) để tạo phiên nhập." />
        ) : (
          <Stack spacing={0.5}>
            {importIds.map((id) => (
              <ImportRow key={id} importId={id} />
            ))}
          </Stack>
        )}
      </SideCard>

      <Lightbox
        open={zoom != null && zoom >= 0}
        index={zoom ?? 0}
        slides={loose.map((u) => ({ src: u.src }))}
        close={() => setZoom(null)}
        disabledSlideshow
      />
    </Stack>
  );
}

// ----------------------------------------------------------------------

function SideCard({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{ width: 1, px: 1.75, py: 1.25, justifyContent: 'flex-start', gap: 1 }}
      >
        <Iconify icon={icon} width={18} sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2">{title}</Typography>
        <Iconify
          icon="eva:arrow-ios-downward-fill"
          width={14}
          sx={{
            color: 'text.disabled',
            transition: 'transform 150ms',
            transform: open ? 'none' : 'rotate(-90deg)',
          }}
        />
        <Box sx={{ flex: 1 }} />
        {meta && (
          <Typography variant="caption" color="text.secondary">
            {meta}
          </Typography>
        )}
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ px: 1.75, pb: 1.5 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {text}
    </Typography>
  );
}

function ImportRow({ importId }: { importId: string }) {
  const instanceId = useId();
  const [item, setItem] = useState<IPurchaseImport | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const data = await getPurchaseImport(importId);
        if (cancelled) return;
        setItem(data);
        setFailed(false);
        if (data.status === 'Extracting') timer = setTimeout(tick, POLL_MS);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [importId, reloadKey]);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const { detail } = event as CustomEvent<PurchaseImportChangedDetail>;
      if (detail?.importId === importId && detail.source !== instanceId) setReloadKey((k) => k + 1);
    };
    window.addEventListener(PURCHASE_IMPORT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PURCHASE_IMPORT_CHANGED_EVENT, onChanged);
  }, [importId, instanceId]);

  if (failed && !item) return null;
  const status = item ? IMPORT_STATUS[item.status] : null;
  const counts = item ? lineCounts(item) : null;
  const thumb = item?.images[0] ? getStorageUrl(item.images[0]) : null;

  return (
    <ButtonBase
      onClick={() => openPurchaseImportDrawer(importId)}
      sx={{
        width: 1,
        p: 0.75,
        gap: 1,
        borderRadius: 1.25,
        justifyContent: 'flex-start',
        textAlign: 'left',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {thumb ? (
        <Box
          component="img"
          src={thumb}
          alt=""
          sx={{ width: 40, height: 40, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1,
            bgcolor: 'background.neutral',
            flexShrink: 0,
          }}
        />
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {item ? item.supplierName || item.supplierText || 'Chưa rõ nhà cung cấp' : 'Đang tải…'}
        </Typography>
        {item && counts && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {item.lines.length} dòng · {counts.matched} có mã · {fCurrency(item.linesTotal)}
            {item.productImages?.length ? ` · ${item.productImages.length} ảnh SP` : ''}
          </Typography>
        )}
      </Box>
      {status && (
        <Label color={status.color} sx={{ flexShrink: 0 }}>
          {status.label}
        </Label>
      )}
    </ButtonBase>
  );
}
