import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Mục "System Jobs" chỉ hiện ở cửa hàng CiCi (core-be: /admin/workers cửa hàng khác 404),
// kể cả danh sách đầy đủ chưa lọc theo role (ô tìm kiếm dùng useNavData() không tham số).
// ----------------------------------------------------------------------

vi.mock('src/locales', () => ({
  useTranslate: () => ({ t: (key: string) => key }),
}));

const brand = vi.hoisted(() => ({ isCiCi: true }));
vi.mock('src/components/branding', () => ({
  useStoreBrand: () => ({ isCiCi: brand.isCiCi }),
}));

// Imported after the mocks above so the hook picks up the mocked modules.
import { useNavData } from 'src/layouts/dashboard/config-navigation';

function navPaths(userRole?: string, enabledFeatures: string[] = []) {
  const { result } = renderHook(() => useNavData(userRole, enabledFeatures));
  const out: string[] = [];
  result.current.forEach((group: any) =>
    group.items.forEach((item: any) => {
      out.push(item.path);
      item.children?.forEach((child: any) => out.push(child.path));
    })
  );
  return out;
}

afterEach(() => {
  brand.isCiCi = true;
});

describe('useNavData — System Jobs', () => {
  it('CiCi: Admin vẫn thấy System Jobs', () => {
    expect(navPaths('Admin')).toContain(paths.dashboard.systemJobs.root);
  });

  it('cửa hàng khác: ẩn System Jobs với Admin và trong danh sách đầy đủ', () => {
    brand.isCiCi = false;

    expect(navPaths('Admin')).not.toContain(paths.dashboard.systemJobs.root);
    expect(navPaths(undefined)).not.toContain(paths.dashboard.systemJobs.root);
    // Mục Admin khác vẫn còn
    expect(navPaths('Admin')).toContain(paths.dashboard.notificationConfig.root);
  });
});

// Mục "Cảnh báo tự động" chỉ dành cho Admin (core-be: AutomationController chỉ cho vai trò Admin), ở mọi cửa hàng.
describe('useNavData — Cảnh báo tự động', () => {
  it('Admin thấy, kể cả ở cửa hàng không phải CiCi', () => {
    expect(navPaths('Admin')).toContain(paths.dashboard.automation.root);

    brand.isCiCi = false;
    expect(navPaths('Admin')).toContain(paths.dashboard.automation.root);
  });

  it.each(['Manager', 'Staff'])('%s không thấy', (role) => {
    expect(navPaths(role)).not.toContain(paths.dashboard.automation.root);
  });
});

// F&B: trang Thiết lập F&B chỉ hiện khi cửa hàng bật commerce.fnb.pos; Hàng hoá dùng chung bán lẻ và F&B nên hiện khi
// bật MỘT TRONG hai khoá.
describe('useNavData — F&B', () => {
  it('Thiết lập F&B chỉ hiện khi bật commerce.fnb.pos, cho Admin và Quản lý', () => {
    expect(navPaths('Admin', ['commerce.retail.inventory'])).not.toContain(paths.dashboard.fnb.root);
    expect(navPaths('Admin', ['commerce.fnb.pos'])).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Manager', ['commerce.fnb.pos'])).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Staff', ['commerce.fnb.pos'])).not.toContain(paths.dashboard.fnb.root);
  });

  it('Hàng hoá hiện với cửa hàng bán lẻ hoặc cửa hàng chỉ có F&B', () => {
    expect(navPaths('Admin', [])).not.toContain(paths.dashboard.pos.product.root);
    expect(navPaths('Admin', ['commerce.retail.inventory'])).toContain(paths.dashboard.pos.product.root);
    expect(navPaths('Admin', ['commerce.fnb.pos'])).toContain(paths.dashboard.pos.product.root);
  });
});
