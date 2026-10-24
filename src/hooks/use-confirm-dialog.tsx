'use client';

import { useRef, useState, useCallback } from 'react';

import Button from '@mui/material/Button';

import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------
// Xác nhận bằng hộp thoại của giao diện, dạng Promise để thay thẳng cho window.confirm:
//
//   const [confirm, confirmDialog] = useConfirmDialog();
//   if (!(await confirm('Xoá mục này?'))) return;
//   ...
//   return <>{confirmDialog}...</>;
//
// KHÔNG dùng window.confirm: trình duyệt nhúng (app desktop, webview) chặn hộp thoại hệ thống và trả "huỷ" ngay — nút
// bấm như không phản hồi (lỗi gặp thật 2026-10-16).
// ----------------------------------------------------------------------

export type ConfirmOptions = {
  title?: string;
  /** Nội dung — "\n" được giữ xuống dòng. */
  content?: string;
  confirmText?: string;
  /** Chữ nút đóng (mặc định của ConfirmDialog) — trang cho khách nên đặt tiếng Việt. */
  cancelText?: string;
  /** Nút xác nhận màu đỏ (xoá, thu hồi...). */
  destructive?: boolean;
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((input: ConfirmOptions | string) => {
    // Hộp thoại trước chưa trả lời → coi như huỷ.
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(typeof input === 'string' ? { content: input } : input);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={!!options}
      onClose={() => close(false)}
      title={options?.title ?? 'Xác nhận'}
      cancelText={options?.cancelText}
      content={options?.content ? <span style={{ whiteSpace: 'pre-line' }}>{options.content}</span> : undefined}
      action={
        <Button variant="contained" color={options?.destructive ? 'error' : 'primary'} onClick={() => close(true)}>
          {options?.confirmText ?? 'Đồng ý'}
        </Button>
      }
    />
  );

  return [confirm, dialog] as const;
}
