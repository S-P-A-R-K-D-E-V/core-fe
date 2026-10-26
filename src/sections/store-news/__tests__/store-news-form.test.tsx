import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { StorePostDetail } from 'src/lib/store-posts';

// ----------------------------------------------------------------------
// Soạn bài tin tức (/dashboard/tin-tuc): gửi đúng nội dung lên POST/PUT /store-posts, chặn thiếu tiêu đề, trợ lý AI
// gợi ý SEO đổ vào các ô (slug chỉ khi còn trống).
// ----------------------------------------------------------------------

// hook-form / Label kéo theo theme (next/font) — jsdom không có loader font của Next.
vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const api = {
  createStorePost: vi.fn(),
  updateStorePost: vi.fn(),
  aiSeo: vi.fn(),
  aiRewrite: vi.fn(),
  aiDraft: vi.fn(),
  aiIdeas: vi.fn(),
  uploadStorePostImage: vi.fn(),
};
vi.mock('src/api/store-posts', () => ({
  createStorePost: (...a: any[]) => api.createStorePost(...a),
  updateStorePost: (...a: any[]) => api.updateStorePost(...a),
  aiSeo: (...a: any[]) => api.aiSeo(...a),
  aiRewrite: (...a: any[]) => api.aiRewrite(...a),
  aiDraft: (...a: any[]) => api.aiDraft(...a),
  aiIdeas: (...a: any[]) => api.aiIdeas(...a),
  uploadStorePostImage: (...a: any[]) => api.uploadStorePostImage(...a),
  useStorePostAi: () => ({ enabled: true, reason: null, actions: [] }),
}));

vi.mock('src/api/product', () => ({
  useSearchStorefrontProducts: () => ({ searchResults: [], searchLoading: false }),
}));

// Editor tiptap thay bằng ô chữ thường (jsdom không dựng được ProseMirror đầy đủ).
vi.mock('src/components/news-editor', () => ({
  NewsEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Nội dung bài" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('src/routes/hooks', () => ({ useRouter: () => router }));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));

// Imported after the mocks above so the form picks up the mocked modules.
import { StoreNewsForm } from '../store-news-form';

vi.setConfig({ testTimeout: 20_000 });

const renderForm = (post?: StorePostDetail) =>
  render(
    <ThemeProvider theme={createTheme()}>
      <StoreNewsForm post={post} />
    </ThemeProvider>
  );

const POST: StorePostDetail = {
  id: 'p1',
  title: 'Bờm đính đá',
  slug: 'bom-dinh-da',
  summary: 'Mẹo chọn bờm',
  contentHtml: '<p>Nội dung</p>',
  coverUrl: null,
  tags: ['Mẹo hay'],
  status: 'published',
  publishedAt: '2026-10-26T03:00:00Z',
  updatedAt: '2026-10-26T03:00:00Z',
  createdAt: '2026-10-26T03:00:00Z',
  authorName: 'Chủ shop',
  viewCount: 3,
  readingMinutes: 1,
  metaTitle: null,
  metaDescription: null,
  metaKeywords: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('StoreNewsForm', () => {
  it('tạo bài mới: gửi nội dung đã cắt khoảng trắng, ô trống thành null, rồi mở trang sửa', async () => {
    const user = userEvent.setup({ delay: null });
    api.createStorePost.mockResolvedValue({ ...POST, id: 'new-id' });
    renderForm();

    await user.type(screen.getByRole('textbox', { name: 'Tiêu đề bài' }), '  Quà Giáng Sinh  ');
    await user.type(screen.getByRole('textbox', { name: 'Nội dung bài' }), '<p>Gợi ý quà</p>');
    await user.click(screen.getByRole('checkbox', { name: /Lưu nháp/ }));
    await user.click(screen.getByRole('button', { name: 'Tạo bài' }));

    await waitFor(() => expect(api.createStorePost).toHaveBeenCalledTimes(1));
    expect(api.createStorePost).toHaveBeenCalledWith({
      title: 'Quà Giáng Sinh',
      slug: null,
      summary: null,
      contentHtml: '<p>Gợi ý quà</p>',
      coverUrl: null,
      tags: [],
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      publish: true,
    });
    expect(router.replace).toHaveBeenCalledWith('/dashboard/tin-tuc/new-id/edit');
  });

  it('thiếu tiêu đề thì báo lỗi, không gửi', async () => {
    const user = userEvent.setup({ delay: null });
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Tạo bài' }));

    expect(await screen.findByText('Nhập tiêu đề bài')).toBeInTheDocument();
    expect(api.createStorePost).not.toHaveBeenCalled();
  });

  it('sửa bài: điền sẵn dữ liệu, lưu qua PUT', async () => {
    const user = userEvent.setup({ delay: null });
    api.updateStorePost.mockResolvedValue(POST);
    renderForm(POST);

    expect(screen.getByRole('textbox', { name: 'Tiêu đề bài' })).toHaveValue('Bờm đính đá');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(api.updateStorePost).toHaveBeenCalledTimes(1));
    expect(api.updateStorePost.mock.calls[0][0]).toBe('p1');
    expect(api.updateStorePost.mock.calls[0][1]).toMatchObject({
      slug: 'bom-dinh-da',
      tags: ['Mẹo hay'],
      publish: true,
    });
  });

  it('AI gợi ý SEO: điền tiêu đề / mô tả / từ khoá; không đè đường dẫn đã có', async () => {
    const user = userEvent.setup({ delay: null });
    api.aiSeo.mockResolvedValue({
      metaTitle: 'Bờm đính đá đẹp',
      metaDescription: 'Mô tả cho Google',
      metaKeywords: 'bờm, phụ kiện',
      slug: 'slug-khac',
      summary: 'Không dùng vì đã có mô tả ngắn',
    });
    renderForm(POST);

    await user.click(screen.getByRole('button', { name: /AI gợi ý SEO/ }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Tiêu đề SEO' })).toHaveValue('Bờm đính đá đẹp')
    );
    expect(screen.getByRole('textbox', { name: 'Mô tả SEO' })).toHaveValue('Mô tả cho Google');
    expect(screen.getByRole('textbox', { name: 'Từ khoá' })).toHaveValue('bờm, phụ kiện');
    expect(screen.getByRole('textbox', { name: 'Đường dẫn' })).toHaveValue('bom-dinh-da');
    expect(screen.getByRole('textbox', { name: 'Mô tả ngắn' })).toHaveValue('Mẹo chọn bờm');
    expect(api.aiSeo).toHaveBeenCalledWith('Bờm đính đá', '<p>Nội dung</p>');
  });
});
