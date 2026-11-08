import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// ----------------------------------------------------------------------
// Soạn bài bán hàng (/dashboard/ban-hang-online/new): chọn sẵn kênh đang kết nối, gửi đúng dữ liệu khi Đăng ngay,
// chặn quá 500 ký tự, AI viết bài đổ chữ + ảnh sản phẩm vào bài.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const api = vi.hoisted(() => ({
  createSocialPost: vi.fn(),
  updateSocialPost: vi.fn(),
  uploadSocialImage: vi.fn(),
  writeSocialCaption: vi.fn(),
}));

vi.mock('src/api/social', () => ({
  createSocialPost: (...a: any[]) => api.createSocialPost(...a),
  updateSocialPost: (...a: any[]) => api.updateSocialPost(...a),
  uploadSocialImage: (...a: any[]) => api.uploadSocialImage(...a),
  writeSocialCaption: (...a: any[]) => api.writeSocialCaption(...a),
  useSocialAi: () => ({ enabled: true, reason: null }),
  useSocialChannels: () => ({
    loading: false,
    threadsConfigured: true,
    channels: [
      { id: 'c1', platform: 'threads', username: 'cici21chualang', status: 'connected' },
      { id: 'c2', platform: 'threads', username: 'cu', status: 'expired' },
    ],
  }),
}));

// Ô chọn sản phẩm đọc danh mục bán online qua SWR — trả danh sách cố định.
vi.mock('swr', () => ({
  default: () => ({
    data: { items: [{ id: 'p1', code: 'K25', name: 'Kẹp tóc k25', price: 25000, imageUrl: null, unit: null, categoryName: null, inStock: true }], total: 1 },
  }),
}));

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('src/routes/hooks', () => ({ useRouter: () => router }));
const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));

// Imported after the mocks above.
import { SocialPostForm } from '../social-post-form';

vi.setConfig({ testTimeout: 20_000 });

const renderForm = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SocialPostForm />
      </LocalizationProvider>
    </ThemeProvider>
  );

afterEach(() => vi.clearAllMocks());

describe('SocialPostForm', () => {
  it('Đăng ngay gửi chữ + kênh đang kết nối (không gồm kênh hết hạn)', async () => {
    api.createSocialPost.mockResolvedValue({});
    renderForm();
    await userEvent.type(screen.getByLabelText('Nội dung bài'), 'Kẹp lược pastel 🩷');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => expect(api.createSocialPost).toHaveBeenCalled());
    expect(api.createSocialPost.mock.calls[0][0]).toEqual({
      text: 'Kẹp lược pastel 🩷',
      imageUrls: [],
      channelIds: ['c1'],
      mode: 'now',
      scheduledAt: null,
      productId: null,
    });
    expect(router.push).toHaveBeenCalledWith('/dashboard/ban-hang-online');
  });

  it('quá 500 ký tự thì không cho đăng', async () => {
    renderForm();
    const box = screen.getByLabelText('Nội dung bài');
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(501));
    expect(screen.getByText('501/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng bài' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeDisabled();
  });

  it('AI viết bài từ ý muốn nói: đổ chữ và ảnh sản phẩm vào bài', async () => {
    api.writeSocialCaption.mockResolvedValue({
      text: 'Bài AI viết\nhttps://cici21chualang.vn/product/p1',
      imageUrls: ['https://cdn.test/kep.jpg', 'http://khong-https.test/a.jpg'],
      productUrl: 'https://cici21chualang.vn/product/p1',
    });
    renderForm();
    await userEvent.type(screen.getByLabelText('Ý muốn nói thêm'), 'quà 20/11');
    await userEvent.click(screen.getByRole('button', { name: 'Viết bài' }));
    await waitFor(() => expect(screen.getByLabelText('Nội dung bài')).toHaveValue('Bài AI viết\nhttps://cici21chualang.vn/product/p1'));
    expect(api.writeSocialCaption).toHaveBeenCalledWith({ productId: null, brief: 'quà 20/11' });
    const srcs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://cdn.test/kep.jpg');
    expect(srcs).not.toContain('http://khong-https.test/a.jpg');
  });
});
