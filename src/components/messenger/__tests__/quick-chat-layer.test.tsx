import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { useMessengerStore } from 'src/store/messenger-store';

// ----------------------------------------------------------------------
// Toast "có tin mới" trong app: tin của người gửi hệ thống hiện tên "Trợ lý hệ thống" + avatar bot; tin của
// người thường vẫn là chữ cái đầu của tên.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({
  default: ({ icon }: any) => <span data-icon={icon} />,
}));

vi.mock('src/components/messenger/quick-chat-window', () => ({
  default: () => null,
}));

// Imported after the mocks above so the layer picks up the mocked modules.
import QuickChatLayer from '../quick-chat-layer';

afterEach(() => {
  useMessengerStore.setState({ notifQueue: [], openQuickChats: [] });
});

describe('QuickChatLayer — toast tin mới', () => {
  it('tin của người gửi hệ thống: tên + avatar bot, không phải chữ cái đầu', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <QuickChatLayer currentUserId="me" />
      </ThemeProvider>
    );

    act(() => {
      useMessengerStore.getState().pushNotif({
        convId: 'sys-admin-alerts-store',
        senderName: 'Trợ lý hệ thống',
        preview: 'Chốt quầy lệch tiền',
        system: true,
      });
      useMessengerStore
        .getState()
        .pushNotif({ convId: 'c1', senderName: 'Nguyễn Văn Hùng', preview: 'chào' });
    });

    expect(screen.getByText('Trợ lý hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Chốt quầy lệch tiền')).toBeInTheDocument();
    const bot = screen.getByRole('img', { name: 'Trợ lý hệ thống' });
    expect(bot.querySelector('[data-icon="mdi:robot"]')).not.toBeNull();
    expect(bot).toHaveTextContent('');

    // Người thường: chữ cái đầu như trước, chỉ có đúng một avatar bot
    expect(screen.getByText('Nguyễn Văn Hùng')).toBeInTheDocument();
    expect(screen.getByText('N')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Trợ lý hệ thống' })).toHaveLength(1);
  });
});
