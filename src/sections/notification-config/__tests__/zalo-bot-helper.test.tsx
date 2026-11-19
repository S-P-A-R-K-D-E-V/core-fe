import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
const checkZaloBotToken = vi.fn();
const getZaloBotUpdates = vi.fn();
const testSendZaloBot = vi.fn();
vi.mock('src/api/zalo-bot', () => ({
  checkZaloBotToken: (...a: any[]) => checkZaloBotToken(...a),
  getZaloBotUpdates: (...a: any[]) => getZaloBotUpdates(...a),
  testSendZaloBot: (...a: any[]) => testSendZaloBot(...a),
}));

import ZaloBotHelper from '../zalo-bot-helper';

describe('ZaloBotHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Lấy chat id → liệt kê chat, bấm một chat thì gọi onPickChat', async () => {
    getZaloBotUpdates.mockResolvedValue({
      ok: true,
      chats: [{ chatId: 'c-1', chatType: 'PRIVATE', name: 'Xuân Bình', text: 'chào bot' }],
      message: null,
    });
    const onPickChat = vi.fn();
    render(<ZaloBotHelper token=" 123:abc " chatId="" onPickChat={onPickChat} />);

    fireEvent.click(screen.getByRole('button', { name: /Lấy chat id/ }));
    await screen.findByText('Xuân Bình · Cá nhân');
    expect(getZaloBotUpdates).toHaveBeenCalledWith('123:abc');

    fireEvent.click(screen.getByText('Xuân Bình · Cá nhân'));
    expect(onPickChat).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'c-1' }));
  });

  it('chưa có tin → hiện message của máy chủ + hướng dẫn nhắn bot', async () => {
    getZaloBotUpdates.mockResolvedValue({ ok: true, chats: [], message: 'Bot đang đặt webhook.' });
    render(<ZaloBotHelper token="t" chatId="" onPickChat={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Lấy chat id/ }));
    await screen.findByText(/Bot đang đặt webhook\./);
    expect(screen.getByText(/Nhắn một tin cho bot trong app Zalo/)).toBeTruthy();
  });

  it('Kiểm tra token hiện tên bot', async () => {
    checkZaloBotToken.mockResolvedValue({
      ok: true,
      botName: 'Bot CiCi',
      botId: '1',
      message: null,
    });
    render(<ZaloBotHelper token="t" chatId="" onPickChat={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra token/ }));
    await screen.findByText(/bot "Bot CiCi"/);
  });

  it('Gửi thử: thiếu token / chat id thì nhắc, đủ thì báo message', async () => {
    const { rerender } = render(<ZaloBotHelper token="" chatId="" onPickChat={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gửi thử/ }));
    expect(testSendZaloBot).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenLastCalledWith('Dán Bot Token trước', { variant: 'warning' });

    testSendZaloBot.mockResolvedValue({ ok: true, message: 'Đã gửi tới Xuân Bình' });
    rerender(<ZaloBotHelper token="t" chatId="c-1" onPickChat={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Gửi thử/ }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenLastCalledWith('Đã gửi tới Xuân Bình', {
        variant: 'success',
      })
    );
    expect(testSendZaloBot).toHaveBeenCalledWith('t', 'c-1');
  });
});
