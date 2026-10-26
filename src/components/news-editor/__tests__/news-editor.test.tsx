import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Editor tin tức (tiptap): dựng được, có thanh công cụ, nạp lại khi nội dung đổi từ ngoài (tải bài / AI viết nháp).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

// Imported after the mock above.
import { NewsEditor } from '../news-editor';

const theme = createTheme();

describe('NewsEditor', () => {
  it('hiện nội dung, thanh công cụ và nạp lại nội dung mới từ ngoài', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <NewsEditor
          value="<h2>Mở bài</h2><p>Xin chào</p>"
          onChange={onChange}
          onUploadImage={vi.fn()}
        />
      </ThemeProvider>
    );

    expect(await screen.findByText('Xin chào')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Mở bài' })).toBeInTheDocument();
    for (const name of [
      'Đậm',
      'Nghiêng',
      'Danh sách chấm',
      'Chèn link',
      'Chèn ảnh',
      'Hoàn tác',
      'Toàn màn hình',
    ])
      expect(screen.getByRole('button', { name })).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <NewsEditor value="<p>Bản nháp của AI</p>" onChange={onChange} onUploadImage={vi.fn()} />
      </ThemeProvider>
    );
    await waitFor(() => expect(screen.getByText('Bản nháp của AI')).toBeInTheDocument());
    expect(screen.queryByText('Xin chào')).not.toBeInTheDocument();
  });
});
