import { it, vi, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import ChatbotMessageBlocks from 'src/components/chatbot/chatbot-message-blocks';

import type { ChatbotUiBlock } from 'src/components/chatbot/chatbot-blocks';

// ----------------------------------------------------------------------
// Ảnh trong câu trả lời của trợ lý: mỗi ảnh có chú thích nhìn thấy được (lấy từ alt) — nhiều ảnh
// sản phẩm / nhân viên / việc vệ sinh mà không có chữ thì không biết ảnh nào là gì.
// ----------------------------------------------------------------------

function renderBlocks(blocks: ChatbotUiBlock[]) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ChatbotMessageBlocks blocks={blocks} busy={false} onNavigate={vi.fn()} onRequestTool={vi.fn()} />
    </ThemeProvider>
  );
}

describe('ChatbotMessageBlocks — ảnh', () => {
  it('hiện chú thích dưới ảnh có alt, ảnh không có alt thì không có chú thích', () => {
    const { container } = renderBlocks([
      { type: 'image', src: 'https://cdn.kiotviet.vn/a.jpg', alt: 'Kẹp tóc - k25' },
      { type: 'image', src: '/media/cleaning/t1/1.jpg' },
    ]);

    expect(container.querySelectorAll('img')).toHaveLength(2);
    const captions = container.querySelectorAll('figcaption');
    expect(captions).toHaveLength(1);
    expect(captions[0].textContent).toBe('Kẹp tóc - k25');
    // Chú thích nằm cùng figure với ảnh của nó.
    expect(captions[0].closest('figure')?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.kiotviet.vn/a.jpg'
    );
  });

  it('ảnh vẫn mở tab mới, nhãn trợ năng có tên ảnh', () => {
    renderBlocks([{ type: 'image', src: '/media/avatars/u1/1.jpg', alt: 'Nguyễn Văn A' }]);

    const link = screen.getByRole('link', { name: 'Mở ảnh: Nguyễn Văn A' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
