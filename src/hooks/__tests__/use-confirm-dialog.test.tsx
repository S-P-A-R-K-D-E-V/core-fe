import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { useConfirmDialog } from '../use-confirm-dialog';

// Thay cho window.confirm (trình duyệt nhúng chặn hộp thoại hệ thống → "huỷ" ngay): Promise trả true khi bấm nút xác
// nhận, false khi huỷ / đóng.

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const [confirm, confirmDialog] = useConfirmDialog();
  return (
    <>
      {confirmDialog}
      <button type="button" onClick={async () => onResult(await confirm({ title: 'Xoá?', content: 'Dòng 1\nDòng 2', confirmText: 'Xoá' }))}>
        open
      </button>
    </>
  );
}

function renderHarness(onResult: (ok: boolean) => void) {
  render(
    <ThemeProvider theme={createTheme()}>
      <Harness onResult={onResult} />
    </ThemeProvider>
  );
}

describe('useConfirmDialog', () => {
  it('resolves true on confirm and never touches window.confirm', async () => {
    const native = vi.spyOn(window, 'confirm');
    const onResult = vi.fn();
    renderHarness(onResult);

    fireEvent.click(screen.getByText('open'));
    expect(screen.getByText('Xoá?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
    expect(native).not.toHaveBeenCalled();
  });

  it('resolves false on cancel', async () => {
    const onResult = vi.fn();
    renderHarness(onResult);

    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
