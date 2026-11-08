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
  frameSocialImage: vi.fn(),
  generateSocialImage: vi.fn(),
}));

vi.mock('src/api/social', () => ({
  createSocialPost: (...a: any[]) => api.createSocialPost(...a),
  updateSocialPost: (...a: any[]) => api.updateSocialPost(...a),
  uploadSocialImage: (...a: any[]) => api.uploadSocialImage(...a),
  writeSocialCaption: (...a: any[]) => api.writeSocialCaption(...a),
  frameSocialImage: (...a: any[]) => api.frameSocialImage(...a),
  generateSocialImage: (...a: any[]) => api.generateSocialImage(...a),
  useSocialImageCatalog: () => ({
    items: [
      { id: 'studio', label: 'Nền studio pastel', group: 'product', hint: '' },
      { id: 'hair-bun', label: 'Búi thấp', group: 'hair', hint: '' },
    ],
    backgrounds: [
      { id: 'pink', label: 'Hồng pastel', color: '#FBE4EA' },
      { id: 'mint', label: 'Xanh bạc hà', color: '#E2F3EC' },
    ],
    maxNoteLength: 200,
  }),
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

  const withImage = async () => {
    api.writeSocialCaption.mockResolvedValue({ text: 'Bài', imageUrls: ['https://cdn.test/kep.jpg'], productUrl: null });
    renderForm();
    await userEvent.type(screen.getByLabelText('Ý muốn nói thêm'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Viết bài' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Studio ảnh: tạo ảnh mới từ ảnh này' }));
  };

  it('Studio ảnh mặc định giữ nguyên sản phẩm: ghép nền rồi thêm ảnh mới vào bài', async () => {
    api.frameSocialImage.mockResolvedValue({
      url: 'https://cdn.test/frame-1.jpg',
      sourceUrl: 'https://cdn.test/kep.jpg',
      style: 'frame',
      label: 'Giữ nguyên ảnh — nền xanh bạc hà',
    });
    await withImage();
    await userEvent.click(screen.getByRole('button', { name: 'Nền Xanh bạc hà' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dọc 4:5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tạo ảnh' }));
    await waitFor(() =>
      expect(api.frameSocialImage).toHaveBeenCalledWith({
        sourceUrl: 'https://cdn.test/kep.jpg',
        productId: null,
        background: 'mint',
        aspect: 'portrait',
      })
    );
    expect(api.generateSocialImage).not.toHaveBeenCalled();
    // Ảnh gốc và ảnh mới cạnh nhau; ghép nền không qua AI nên không có cảnh báo lệch chi tiết.
    expect(screen.getByAltText('Ảnh gốc')).toHaveAttribute('src', 'https://cdn.test/kep.jpg');
    expect(await screen.findByAltText('Ảnh mới — Giữ nguyên ảnh — nền xanh bạc hà')).toBeInTheDocument();
    expect(screen.queryByText(/có thể lệch chi tiết/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào bài' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    const srcs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(expect.arrayContaining(['https://cdn.test/kep.jpg', 'https://cdn.test/frame-1.jpg']));
  });

  it('Studio ảnh — AI vẽ lại: gửi kiểu + ghi chú, cảnh báo so sánh, thay ảnh gốc', async () => {
    api.generateSocialImage.mockResolvedValue({
      url: 'https://cdn.test/ai-1.jpg',
      sourceUrl: 'https://cdn.test/kep.jpg',
      style: 'hair-bun',
      label: 'Búi thấp',
    });
    await withImage();
    await userEvent.click(screen.getByRole('button', { name: 'AI vẽ lại' }));
    await userEvent.click(screen.getByRole('button', { name: 'Búi thấp' }));
    await userEvent.type(screen.getByLabelText('Ghi chú cho AI (không bắt buộc)'), 'kẹp hồng');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo ảnh' }));
    await waitFor(() =>
      expect(api.generateSocialImage).toHaveBeenCalledWith({
        sourceUrl: 'https://cdn.test/kep.jpg',
        productId: null,
        style: 'hair-bun',
        note: 'kẹp hồng',
      })
    );
    expect(await screen.findByText(/có thể lệch chi tiết/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Thay ảnh gốc' }));
    await waitFor(() => expect(screen.queryByText('Studio ảnh')).not.toBeInTheDocument());
    const srcs = Array.from(document.querySelectorAll('img')).map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://cdn.test/ai-1.jpg');
    expect(srcs).not.toContain('https://cdn.test/kep.jpg');
  });
});
