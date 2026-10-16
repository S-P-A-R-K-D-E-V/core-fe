import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Mục "System Jobs" chỉ hiện ở cửa hàng CiCi (core-be: /admin/workers cửa hàng khác 404),
// kể cả danh sách đầy đủ chưa lọc theo role (useNavData() không tham số, lúc người dùng chưa nạp xong).
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

import { useWorkingBranch } from 'src/store/working-branch-store';

function navPaths(userRole?: string | string[], enabledFeatures: string[] = []) {
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
  useWorkingBranch.setState({ hydrated: false, branch: null, options: null, lock: null });
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

    // Quản lý và nhân viên còn phụ thuộc loại chi nhánh (xem nhóm "menu theo loại chi nhánh" bên dưới).
    const fnbBranch = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };
    useWorkingBranch.setState({ hydrated: true, branch: fnbBranch, options: [fnbBranch] });
    expect(navPaths('Manager', ['commerce.fnb.pos'])).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Staff', ['commerce.fnb.pos'])).not.toContain(paths.dashboard.fnb.root);
  });

  it('Hàng hoá hiện với cửa hàng bán lẻ hoặc cửa hàng chỉ có F&B', () => {
    expect(navPaths('Admin', [])).not.toContain(paths.dashboard.pos.product.root);
    expect(navPaths('Admin', ['commerce.retail.inventory'])).toContain(paths.dashboard.pos.product.root);
    expect(navPaths('Admin', ['commerce.fnb.pos'])).toContain(paths.dashboard.pos.product.root);
  });
});

// Mục F&B gắn loại chi nhánh: nhân viên chỉ thấy khi chi nhánh đang làm việc là F&B, quản lý thấy khi có chi nhánh
// F&B trong phạm vi được phân công, chủ cửa hàng không bị thu hẹp. Mục dùng chung không đổi theo chi nhánh.
describe('useNavData — menu theo loại chi nhánh', () => {
  const FNB = ['commerce.fnb.pos', 'workforce.attendance'];
  const retail = { id: 'b1', name: 'Cửa hàng', type: 'retail' as const };
  const fnb = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };
  const working = (branch: typeof retail | typeof fnb | null, options: (typeof retail | typeof fnb)[] | null) =>
    useWorkingBranch.setState({ hydrated: true, branch, options });

  const staffFnbPaths = [paths.dashboard.fnb.pos, paths.dashboard.fnb.printStation, paths.dashboard.fnb.stock];

  it('nhân viên ở chi nhánh bán lẻ: không thấy mục F&B dù cửa hàng bật F&B; mục dùng chung vẫn còn', () => {
    working(retail, [retail, fnb]);
    const shown = navPaths('Staff', FNB);

    staffFnbPaths.forEach((path) => expect(shown).not.toContain(path));
    expect(shown).toContain(paths.dashboard.attendance.checkin);
    expect(shown).toContain(paths.dashboard.shiftCash.root);
  });

  it('nhân viên đổi sang chi nhánh F&B: thấy Bán hàng F&B, Máy in phiếu, Kho nguyên liệu', () => {
    working(fnb, [retail, fnb]);
    const shown = navPaths('Staff', FNB);

    staffFnbPaths.forEach((path) => expect(shown).toContain(path));
    expect(shown).toContain(paths.dashboard.attendance.checkin);
  });

  it('chưa biết chi nhánh đang làm việc: nhân viên chưa thấy mục F&B', () => {
    staffFnbPaths.forEach((path) => expect(navPaths('Staff', FNB)).not.toContain(path));
  });

  it('quản lý: theo các loại chi nhánh được phân công, không theo chi nhánh đang chọn', () => {
    working(retail, [retail, fnb]);
    expect(navPaths('Manager', FNB)).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Manager', FNB)).toContain(paths.dashboard.fnb.pos);

    working(retail, [retail]);
    expect(navPaths('Manager', FNB)).not.toContain(paths.dashboard.fnb.root);
    expect(navPaths('Manager', FNB)).not.toContain(paths.dashboard.fnb.pos);
  });

  it('chủ cửa hàng: không thu hẹp theo chi nhánh', () => {
    working(retail, [retail]);
    expect(navPaths('Admin', FNB)).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Admin', FNB)).toContain(paths.dashboard.fnb.pos);
  });

  it('cửa hàng không bật F&B: chi nhánh F&B cũng không làm hiện mục F&B', () => {
    working(fnb, [fnb]);
    expect(navPaths('Staff', ['workforce.attendance'])).not.toContain(paths.dashboard.fnb.pos);
  });
});

// Camera, giám sát và báo cáo kinh doanh chỉ dành cho chủ cửa hàng — quản lý không thấy (trang cũng chặn bằng
// RoleBasedGuard khi mở thẳng đường dẫn).
describe('useNavData — camera, giám sát, báo cáo chỉ Admin', () => {
  const features = ['store.camera', 'workforce.attendance'];
  const ownerOnly = [
    paths.dashboard.general.storeMonitor,
    paths.dashboard.attendance.live,
    paths.dashboard.attendance.kioskDevices,
    paths.dashboard.pos.report.root,
    paths.dashboard.pos.report.revenue,
    paths.dashboard.pos.report.tax,
  ];

  it('Admin thấy', () => {
    const admin = navPaths('Admin', features);
    ownerOnly.forEach((p) => expect(admin).toContain(p));
  });

  it.each(['Manager', 'Staff'])('%s không thấy', (role) => {
    const visible = navPaths(role, features);
    ownerOnly.forEach((p) => expect(visible).not.toContain(p));
    // Quản lý vẫn quản lý chấm công như cũ.
    if (role === 'Manager') expect(visible).toContain(paths.dashboard.attendance.report);
  });
});

// Người kiêm nhiều vai trò (vd Staff kiêm Admin, vai trò chính "Staff") thấy menu của MỌI vai trò — như guard và API.
// Trước đây menu chỉ xét vai trò chính nên ẩn hết mục Admin dù trang/API vẫn cho vào.
describe('useNavData — nhiều vai trò', () => {
  it('Staff kiêm Admin thấy mục chỉ dành cho Admin', () => {
    expect(navPaths('Staff')).not.toContain(paths.dashboard.automation.root);
    expect(navPaths(['Staff', 'Admin'])).toContain(paths.dashboard.automation.root);
    expect(navPaths(['Staff', 'Admin'])).toContain(paths.dashboard.storeSettings.root);
  });

  it('Staff kiêm Quản lý thấy mục của Quản lý nhưng không thấy mục chỉ Admin', () => {
    const paths2 = navPaths(['Staff', 'Manager']);
    expect(paths2).toContain(paths.dashboard.user.root);
    expect(paths2).not.toContain(paths.dashboard.storeSettings.root);
  });
});
