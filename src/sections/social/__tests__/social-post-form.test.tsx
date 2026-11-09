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
  analyzeSocialImage: vi.fn(),
}));

vi.mock('src/api/social', () => ({
  createSocialPost: (...a: any[]) => api.createSocialPost(...a),
  updateSocialPost: (...a: any[]) => api.updateSocialPost(...a),
  uploadSocialImage: (...a: any[]) => api.uploadSocialImage(...a),
  writeSocialCaption: (...a: any[]) => api.writeSocialCaption(...a),
  frameSocialImage: (...a: any[]) => api.frameSocialImage(...a),
  generateSocialImage: (...a: any[]) => api.generateSocialImage(...a),
  analyzeSocialImage: (...a: any[]) => api.analyzeSocialImage(...a),
  useSocialImageCatalog: () => ({
    items: [
      { id: 'studio', label: 'Nền studio pastel', group: 'studio', hint: '' },
      { id: 'hair-bun', label: 'Búi thấp', group: 'lifestyle', hint: '' },
    ],
    tags: [],
    backgrounds: [
      { id: 'pink', label: 'Hồng pastel', color: '#FBE4EA' },
      { id: 'mint', label: 'Xanh bạc hà', color: '#E2F3EC' },
    ],
    maxNoteLength: 200,
  }),
  useSocialAi: () => ({ enabled: true, reason: null }),
  useSocialQueue: () => ({
    queue: { slots: ['09:00', '20:00'], days: [0, 1, 2, 3, 4, 5, 6], isDefault: true, nextSlots: ['2030-01-02T13:00:00Z'] },
  }),
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
    data: {
      items: [
        { id: 'p1', code: 'K25', name: 'Kẹp tóc k25', price: 25000, imageUrl: null, unit: null, categoryName: null, inStock: true },
        { id: 'p2', code: 'SC18', name: 'Scrunchies SC18', price: 18000, imageUrl: 'https://cdn.test/sc18.jpg', unit: null, categoryName: null, inStock: true },
        { id: 'p3', code: 'K28', name: 'Kẹp hoa K28', price: 28000, imageUrl: 'https://cdn.test/k28.jpg', unit: null, categoryName: null, inStock: true },
      ],
      total: 3,
    },
  }),
}));

const router = { replace: vi.fn(), push: vi.fn() };
let searchParams = new URLSearchParams();
vi.mock('src/routes/hooks', () => ({ useRouter: () => router, useSearchParams: () => searchParams }));
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

afterEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

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
      productIds: [],
    });
    expect(router.push).toHaveBeenCalledWith('/dashboard/ban-hang-online');
  });

  it('Hàng đợi: hiện khung giờ trống kế tiếp và gửi mode queue (máy chủ chọn giờ)', async () => {
    api.createSocialPost.mockResolvedValue({ scheduledAt: '2030-01-02T13:00:00Z' });
    renderForm();
    await userEvent.type(screen.getByLabelText('Nội dung bài'), 'Kẹp mới về');
    await userEvent.click(screen.getByRole('button', { name: 'Hàng đợi' }));
    expect(screen.getByText(/khung giờ trống kế tiếp/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào hàng đợi' }));
    await waitFor(() => expect(api.createSocialPost).toHaveBeenCalled());
    expect(api.createSocialPost.mock.calls[0][0]).toMatchObject({ mode: 'queue', scheduledAt: null, channelIds: ['c1'] });
    expect(snackbar.enqueueSnackbar.mock.calls[0][0]).toMatch(/^Đã thêm vào hàng đợi — đăng lúc/);
  });

  it('mở từ ô trống trên lịch (?at=) thì hẹn đúng giờ đó', async () => {
    searchParams = new URLSearchParams({ at: '2030-01-03T02:00:00.000Z' });
    api.createSocialPost.mockResolvedValue({});
    renderForm();
    await userEvent.type(screen.getByLabelText('Nội dung bài'), 'Kẹp mới về');
    await userEvent.click(screen.getByRole('button', { name: 'Hẹn giờ đăng' }));
    await waitFor(() => expect(api.createSocialPost).toHaveBeenCalled());
    expect(api.createSocialPost.mock.calls[0][0]).toMatchObject({ mode: 'schedule', scheduledAt: '2030-01-03T02:00:00.000Z' });
  });

  it('chọn nhiều sản phẩm: AI viết theo cả nhóm, thêm ảnh từng sản phẩm, bài gửi đủ productIds', async () => {
    api.writeSocialCaption.mockResolvedValue({ text: 'Combo kẹp + scrunchies', imageUrls: [], productUrl: null, productUrls: [] });
    api.createSocialPost.mockResolvedValue({});
    renderForm();
    const picker = screen.getByLabelText('Sản phẩm (đang bán online)');
    await userEvent.click(picker);
    await userEvent.click(await screen.findByText('Scrunchies SC18'));
    await userEvent.click(picker);
    await userEvent.click(await screen.findByText('Kẹp hoa K28'));
    expect(screen.getByText(/AI viết một bài cho 2 sản phẩm/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dùng 2 ảnh sản phẩm' }));
    await userEvent.click(screen.getByRole('button', { name: 'Viết bài' }));
    await waitFor(() => expect(api.writeSocialCaption).toHaveBeenCalledWith({ productIds: ['p2', 'p3'], brief: '' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Đăng bài' }));
    await waitFor(() => expect(api.createSocialPost).toHaveBeenCalled());
    expect(api.createSocialPost.mock.calls[0][0]).toMatchObject({
      productId: 'p2',
      productIds: ['p2', 'p3'],
      imageUrls: ['https://cdn.test/sc18.jpg', 'https://cdn.test/k28.jpg'],
    });
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
    expect(api.writeSocialCaption).toHaveBeenCalledWith({ productIds: [], brief: 'quà 20/11' });
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

  it('Studio ảnh — AI vẽ lại: phân tích ảnh, gửi gợi ý + tag + ghi chú, cảnh báo so sánh, thay ảnh gốc', async () => {
    api.analyzeSocialImage.mockResolvedValue({
      category: 'Kẹp tóc',
      kind: 'hair_accessory',
      sensitive: false,
      summary: null,
      fallback: false,
      presets: [
        { id: 'white', label: 'Nền trắng', group: 'studio', hint: '' },
        { id: 'hair-side', label: 'Cài bên tai', group: 'lifestyle', hint: '' },
        { id: 'hair-bun', label: 'Búi thấp', group: 'lifestyle', hint: '' },
      ],
      tags: [{ id: 'soft-light', label: 'Ánh sáng mềm' }],
    });
    api.generateSocialImage.mockResolvedValue({
      url: 'https://cdn.test/ai-1.jpg',
      sourceUrl: 'https://cdn.test/kep.jpg',
      style: 'hair-bun',
      label: 'Búi thấp',
    });
    await withImage();
    await userEvent.click(screen.getByRole('button', { name: 'AI vẽ lại' }));
    expect(await screen.findByText('Kẹp tóc')).toBeInTheDocument();
    expect(api.analyzeSocialImage).toHaveBeenCalledWith({ sourceUrl: 'https://cdn.test/kep.jpg', productId: null });
    await userEvent.click(screen.getByRole('button', { name: 'Búi thấp' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ánh sáng mềm' }));
    await userEvent.type(screen.getByLabelText('Prompt thêm cho AI (không bắt buộc)'), 'kẹp hồng');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo ảnh' }));
    await waitFor(() =>
      expect(api.generateSocialImage).toHaveBeenCalledWith({
        sourceUrl: 'https://cdn.test/kep.jpg',
        productId: null,
        preset: 'hair-bun',
        tags: ['soft-light'],
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
