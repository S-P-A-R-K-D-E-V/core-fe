import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { STAFF_GUIDE } from '../guide/staff-guide-content';

// ----------------------------------------------------------------------
// Trang "Hướng dẫn sử dụng app cho nhân viên": nội dung tĩnh hiển thị đủ các phần, mục lục trỏ đúng neo,
// và nội dung giữ đúng các mốc của quy chế (10.000đ/điểm, 24 giờ, 3 ngày làm việc).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/branding', () => ({ useStoreBrand: () => ({ isCiCi: true }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading, action }: { heading: string; action?: React.ReactNode }) => (
    <div>
      <h1>{heading}</h1>
      {action}
    </div>
  ),
}));

const { default: StaffGuideView } = await import('../guide/staff-guide-view');

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <StaffGuideView />
    </ThemeProvider>
  );

describe('StaffGuideView', () => {
  it('hiện tiêu đề, mọi phần và mục lục trỏ tới từng mục', () => {
    renderView();

    expect(screen.getByRole('heading', { level: 1, name: STAFF_GUIDE.title })).toBeInTheDocument();
    STAFF_GUIDE.parts.forEach((part) => {
      expect(screen.getAllByText(part.title).length).toBeGreaterThan(0);
      part.sections.forEach((s) => {
        expect(document.getElementById(s.id)).not.toBeNull();
        expect(screen.getByRole('link', { name: s.title })).toHaveAttribute('href', `#${s.id}`);
      });
    });
    expect(screen.getByRole('button', { name: /In \/ Lưu PDF/ })).toBeInTheDocument();
  });

  it('mã neo không trùng nhau', () => {
    const ids = STAFF_GUIDE.parts.flatMap((p) => [p.id, ...p.sections.map((s) => s.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('giữ đúng các mốc chính của quy chế', () => {
    const text = JSON.stringify(STAFF_GUIDE);
    expect(text).toContain('10.000đ');
    expect(text).toContain('24 giờ');
    expect(text).toContain('3 ngày làm việc');
    expect(text).toContain('25.500đ');
  });
});
