import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Ảnh sản phẩm: bộ ảnh (ảnh chính, thứ tự, xoá, tải lên), AI phân tích + tạo 1–3 ảnh từ ảnh KiotViet, tích ảnh rồi thêm
// vào bộ, Lưu gửi đúng thứ tự + mô tả bán online.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock('src/hooks/use-responsive', () => ({ useResponsive: () => true }));

const KV = 'https://cdn2-retail-images.kiotviet.vn/cici68/kep.jpeg';
const SECOND = 'https://cdn.test/products/t/202611/src-2.jpg';

const api = vi.hoisted(() => ({
  saveProductImages: vi.fn(),
  uploadProductImage: vi.fn(),
  analyzeProductImage: vi.fn(),
  generateProductImage: vi.fn(),
  frameProductImage: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('src/api/product-images', () => ({
  useProductImages: () => ({
    data: {
      productId: 'p1',
      code: 'K25',
      name: 'Kẹp tóc - k25',
      kiotVietLinked: true,
      imagesCustomized: false,
      images: [KV, SECOND],
      description: null,
      onlineDescription: null,
    },
    error: undefined,
    mutate: api.mutate,
  }),
  useProductImageCatalog: () => ({
    items: [],
    tags: [],
    backgrounds: [{ id: 'white', label: 'Trắng', color: '#FFFFFF' }],
    maxNoteLength: 200,
  }),
  saveProductImages: (...a: any[]) => api.saveProductImages(...a),
  uploadProductImage: (...a: any[]) => api.uploadProductImage(...a),
  analyzeProductImage: (...a: any[]) => api.analyzeProductImage(...a),
  generateProductImage: (...a: any[]) => api.generateProductImage(...a),
  frameProductImage: (...a: any[]) => api.frameProductImage(...a),
}));

// eslint-disable-next-line import/first
import { ProductImagesDialog } from '../product-images-dialog';

const renderDialog = (onSaved = vi.fn(), onClose = vi.fn()) => {
  render(
    <ThemeProvider theme={createTheme()}>
      <ProductImagesDialog productId="p1" onClose={onClose} onSaved={onSaved} />
    </ThemeProvider>
  );
  return { onSaved, onClose };
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProductImagesDialog', () => {
  it('đổi ảnh chính, tải ảnh lên, lưu đúng thứ tự + mô tả', async () => {
    api.uploadProductImage.mockResolvedValue('https://cdn.test/products/t/202611/src-new.jpg');
    api.saveProductImages.mockResolvedValue({
      images: [SECOND, KV, 'https://cdn.test/products/t/202611/src-new.jpg'],
    });
    const { onSaved } = renderDialog();

    expect(screen.getByText(/Ảnh đang lấy từ KiotViet/)).toBeInTheDocument();
    const save = screen.getByRole('button', { name: 'Lưu' });
    expect(save).toBeDisabled();

    await userEvent.click(screen.getAllByRole('button', { name: 'Đặt làm ảnh chính' })[1]);
    const file = new File(['x'], 'cam.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByTestId('product-image-camera'), { target: { files: [file] } });
    await waitFor(() => expect(api.uploadProductImage).toHaveBeenCalledWith('p1', file));
    await userEvent.type(screen.getByLabelText('Mô tả bán online'), 'Kẹp càng cua');

    await userEvent.click(save);
    await waitFor(() =>
      expect(api.saveProductImages).toHaveBeenCalledWith('p1', {
        urls: [SECOND, KV, 'https://cdn.test/products/t/202611/src-new.jpg'],
        onlineDescription: 'Kẹp càng cua',
      })
    );
    expect(onSaved).toHaveBeenCalledWith([
      SECOND,
      KV,
      'https://cdn.test/products/t/202611/src-new.jpg',
    ]);
  });

  it('AI: phân tích ảnh KiotViet, tạo 2 ảnh theo gợi ý + tag, thêm ảnh đã chọn vào bộ', async () => {
    api.analyzeProductImage.mockResolvedValue({
      category: 'Kẹp tóc',
      kind: 'hair_accessory',
      sensitive: false,
      summary: null,
      fallback: false,
      presets: [
        { id: 'white', label: 'Nền trắng', group: 'studio', hint: '' },
        { id: 'hair-side', label: 'Cài bên tai', group: 'lifestyle', hint: '' },
      ],
      tags: [{ id: 'macro', label: 'Cận cảnh chất liệu' }],
    });
    let n = 0;
    api.generateProductImage.mockImplementation(async () => {
      n += 1;
      return {
        url: `https://cdn.test/products/t/202611/ai-${n}.jpg`,
        sourceUrl: KV,
        style: 'hair-side',
        label: 'Cài bên tai',
      };
    });
    api.saveProductImages.mockResolvedValue({ images: [] });
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'AI tạo ảnh' }));
    expect(await screen.findByText('Kẹp tóc')).toBeInTheDocument();
    expect(api.analyzeProductImage).toHaveBeenCalledWith('p1', KV);
    // Gợi ý mặc định = cách dùng đầu tiên.
    expect(screen.getByRole('button', { name: 'Cài bên tai' })).toHaveClass('MuiChip-filled');
    await userEvent.click(screen.getByRole('button', { name: 'Cận cảnh chất liệu' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tạo 2 ảnh' }));

    await waitFor(() => expect(api.generateProductImage).toHaveBeenCalledTimes(2));
    expect(api.generateProductImage).toHaveBeenCalledWith('p1', {
      sourceUrl: KV,
      preset: 'hair-side',
      tags: ['macro'],
      note: undefined,
    });
    expect(await screen.findByText(/có thể lệch chi tiết/)).toBeInTheDocument();
    expect(screen.getByAltText('Ảnh gốc')).toHaveAttribute('src', KV);

    // Bỏ tích ảnh 1, thêm ảnh 2 vào bộ rồi lưu.
    await waitFor(() =>
      expect(screen.getAllByRole('checkbox', { name: 'Chọn Cài bên tai' })).toHaveLength(2)
    );
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Chọn Cài bên tai' })[0]);
    await userEvent.click(screen.getByRole('button', { name: /Thêm 1 ảnh đã chọn vào bộ ảnh/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.saveProductImages).toHaveBeenCalled());
    const [, body] = api.saveProductImages.mock.calls[0];
    expect(body.urls).toHaveLength(3);
    expect(body.urls.slice(0, 2)).toEqual([KV, SECOND]);
    expect(within(document.body).queryByText('Chưa có')).not.toBeInTheDocument();
  });
});
