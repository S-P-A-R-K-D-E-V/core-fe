import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { SYSTEM_USER_ID } from 'src/utils/messenger-system';

// ----------------------------------------------------------------------
// Hộp thoại "Tạo hội thoại mới": không mở chat riêng / dựng nhóm với người gửi hệ thống (chặn trước khi gọi
// API), và thao tác bị core-be từ chối (400 { error, code }) hiện đúng câu `error`.
// ----------------------------------------------------------------------

const openPrivateConversation = vi.fn();
const createGroupConversation = vi.fn();
vi.mock('src/api/messenger', () => ({
  openPrivateConversation: (...args: any[]) => openPrivateConversation(...args),
  createGroupConversation: (...args: any[]) => createGroupConversation(...args),
}));

// Imported after the mock above so the dialog picks up the mocked module.
import NewConversationDialog from '../new-conversation-dialog';

const NOT_A_CONTACT =
  'Trợ lý hệ thống chỉ gửi cảnh báo tự động — không nhắn riêng hoặc thêm vào hội thoại được.';

function renderDialog() {
  const onCreated = vi.fn();
  render(
    <ThemeProvider theme={createTheme()}>
      <NewConversationDialog open onClose={vi.fn()} onCreated={onCreated} />
    </ThemeProvider>
  );
  return { onCreated };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('NewConversationDialog', () => {
  it('chat 1:1 với người gửi hệ thống → báo lý do, không gọi API', async () => {
    const user = userEvent.setup();
    const { onCreated } = renderDialog();

    await user.type(screen.getByLabelText('UserId đối phương'), SYSTEM_USER_ID.toUpperCase());
    await user.click(screen.getByRole('button', { name: 'Tạo' }));

    expect(await screen.findByText(NOT_A_CONTACT)).toBeInTheDocument();
    expect(openPrivateConversation).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('nhóm có người gửi hệ thống trong danh sách thành viên → báo lý do, không gọi API', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Nhóm' }));
    await user.type(screen.getByLabelText('UserId các thành viên'), `u1, ${SYSTEM_USER_ID}`);
    await user.click(screen.getByRole('button', { name: 'Tạo' }));

    expect(await screen.findByText(NOT_A_CONTACT)).toBeInTheDocument();
    expect(createGroupConversation).not.toHaveBeenCalled();
  });

  it('core-be từ chối (400 { error, code }) → hiện câu error của máy chủ', async () => {
    const user = userEvent.setup();
    // Interceptor của axios reject bằng BODY của response.
    openPrivateConversation.mockRejectedValue({
      error: 'Chỉ nhắn tin được với thành viên của cửa hàng này — có người không thuộc cửa hàng.',
      code: 'not_store_member',
    });
    renderDialog();

    await user.type(screen.getByLabelText('UserId đối phương'), 'u-ngoai-cua-hang');
    await user.click(screen.getByRole('button', { name: 'Tạo' }));

    expect(
      await screen.findByText(
        'Chỉ nhắn tin được với thành viên của cửa hàng này — có người không thuộc cửa hàng.'
      )
    ).toBeInTheDocument();
    expect(openPrivateConversation).toHaveBeenCalledWith('u-ngoai-cua-hang');
  });

  it('người thường vẫn tạo được hội thoại như trước', async () => {
    const user = userEvent.setup();
    openPrivateConversation.mockResolvedValue({ id: 'c1' });
    const { onCreated } = renderDialog();

    await user.type(screen.getByLabelText('UserId đối phương'), 'u1');
    await user.click(screen.getByRole('button', { name: 'Tạo' }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith('c1'));
  });
});
