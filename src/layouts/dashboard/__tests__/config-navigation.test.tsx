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

function navPaths(userRole?: string) {
  const { result } = renderHook(() => useNavData(userRole, []));
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
