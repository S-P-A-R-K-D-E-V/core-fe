import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { ICategory } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// PUT /categories/{id} ở BE bắt buộc isActive (bool): thiếu trường là danh mục bị tắt sau mỗi lần lưu form sửa.
// ----------------------------------------------------------------------

// hook-form kéo theo theme (next/font) — jsdom không có loader font của Next.
vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const push = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));

const updateCategory = vi.fn(async () => undefined);
const setCategoryFloor = vi.fn(async () => undefined);
vi.mock('src/api/categories', () => ({
  getAllCategories: vi.fn(async () => []),
  createCategory: vi.fn(),
  updateCategory: (...args: any[]) => updateCategory(...(args as [])),
  setCategoryFloor: (...args: any[]) => setCategoryFloor(...(args as [])),
}));

// Imported after the mocks above.
import CategoryNewEditForm from 'src/sections/pos/category/category-new-edit-form';

const category = (over: Partial<ICategory>): ICategory =>
  ({
    id: 'cat-1',
    name: 'Kẹp tóc',
    parentCategoryId: 'root',
    isActive: true,
    floor: null,
    ...over,
  }) as unknown as ICategory;

function renderForm(current: ICategory) {
  render(
    <ThemeProvider theme={createTheme()}>
      <CategoryNewEditForm currentCategory={current} />
    </ThemeProvider>
  );
}

describe('CategoryNewEditForm update', () => {
  it.each([true, false])('sends back the current isActive (%s) when saving', async (isActive) => {
    updateCategory.mockClear();
    const user = userEvent.setup();
    renderForm(category({ isActive }));

    await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    expect(updateCategory).toHaveBeenCalledWith(
      'cat-1',
      expect.objectContaining({ name: 'Kẹp tóc', parentCategoryId: 'root', isActive })
    );
    // Tầng không đổi thì không gọi lệnh lưu tầng.
    expect(setCategoryFloor).not.toHaveBeenCalled();
  });
});
