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

function navPaths(userRole?: string | string[], enabledFeatures: string[] = [], permissions?: string[]) {
  const { result } = renderHook(() => useNavData(userRole, enabledFeatures, permissions));
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
    // Quyền mặc định của Manager (Core-be) có attendance.read; Staff không có quyền nào.
    const visible = navPaths(role, features, role === 'Manager' ? ['attendance.read'] : []);
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

// Báo cáo theo quyền analytics.* (Core-be /reports/*): chủ cửa hàng thấy hết; vai trò tuỳ chỉnh thấy đúng báo cáo được cấp.
describe('useNavData — báo cáo theo quyền', () => {
  it('Admin thấy mục Báo cáo và mọi trang con', () => {
    const nav = navPaths('Admin');
    expect(nav).toContain(paths.dashboard.pos.report.root);
    expect(nav).toContain(paths.dashboard.pos.report.tax);
    expect(nav).toContain(paths.dashboard.pos.report.dashboard);
  });

  it('nhân viên thường không thấy; "Kế toán" chỉ có doanh thu thấy đúng Doanh thu', () => {
    expect(navPaths('Staff', [], [])).not.toContain(paths.dashboard.pos.report.root);

    const accountant = navPaths('Staff', [], ['analytics.revenue.read']);
    expect(accountant).toContain(paths.dashboard.pos.report.root);
    expect(accountant).toContain(paths.dashboard.pos.report.revenue);
    // Tổng quan cần thêm chi phí + hoà vốn
    expect(accountant).not.toContain(paths.dashboard.pos.report.dashboard);
    expect(accountant).not.toContain(paths.dashboard.pos.report.tax);
  });
});

// Chi phí theo quyền expense.* (Core-be /expenses/*): chủ cửa hàng thấy hết; vai trò tuỳ chỉnh thấy theo quyền được cấp.
describe('useNavData — chi phí theo quyền', () => {
  const expense = paths.dashboard.pos.expense;

  it('Admin thấy mục Chi phí và mọi trang con', () => {
    const nav = navPaths('Admin');
    [expense.root, expense.list, expense.new, expense.categories, expense.recurringTemplates].forEach((p) =>
      expect(nav).toContain(p)
    );
  });

  it('Quản lý / nhân viên thường không thấy (như trước)', () => {
    expect(navPaths('Manager', [], [])).not.toContain(expense.root);
    expect(navPaths('Staff', [], [])).not.toContain(expense.root);
  });

  it('chỉ có quyền xem: thấy danh sách, không thấy "Thêm chi phí"; có quyền thêm thì thấy', () => {
    const viewer = navPaths('Staff', [], ['expense.read']);
    expect(viewer).toContain(expense.root);
    expect(viewer).toContain(expense.list);
    expect(viewer).not.toContain(expense.new);

    expect(navPaths('Staff', [], ['expense.read', 'expense.create'])).toContain(expense.new);
  });
});

// Quản lý lương theo quyền payroll.* (Core-be): Admin / Manager như trước; vai trò tuỳ chỉnh thấy đúng mục được cấp.
describe('useNavData — lương theo quyền', () => {
  const features = ['payroll.core', 'payroll.penalty'];
  const MANAGER_DEFAULTS = [
    'payroll.records.read',
    'payroll.salary-config.read',
    'payroll.policy.manage',
  ];

  it('Admin và Manager (quyền mặc định) thấy đủ mục lương', () => {
    [navPaths('Admin', features), navPaths('Manager', features, MANAGER_DEFAULTS)].forEach((nav) => {
      expect(nav).toContain(paths.dashboard.salary.root);
      expect(nav).toContain(paths.dashboard.payroll.batch);
      expect(nav).toContain(paths.dashboard.penaltyPolicy.list);
    });
  });

  it('nhân viên thường không thấy; "Kế toán lương" chỉ xem bảng lương thấy đúng kỳ + bảng lương', () => {
    expect(navPaths('Staff', features, [])).not.toContain(paths.dashboard.salary.root);

    const accountant = navPaths('Staff', features, ['payroll.records.read']);
    expect(accountant).toContain(paths.dashboard.salary.root);
    expect(accountant).toContain(paths.dashboard.payroll.batch);
    expect(accountant).toContain(paths.dashboard.payroll.cycles);
    expect(accountant).not.toContain(paths.dashboard.salary.configuration);
    expect(accountant).not.toContain(paths.dashboard.holidayPolicy.list);
  });
});

// Ca làm + chấm công theo quyền shift.* / attendance.* (Core-be): Admin / Manager như trước; vai trò tuỳ chỉnh theo quyền.
describe('useNavData — ca làm và chấm công theo quyền', () => {
  const features = ['workforce.shift-scheduling', 'workforce.attendance'];
  const MANAGER_DEFAULTS = [
    'shift.template.manage',
    'shift.schedule.manage',
    'shift.assignment.read',
    'shift.audit.read',
    'attendance.read',
    'attendance.adjust',
    'attendance.request.process',
  ];

  it('Manager (quyền mặc định) thấy quản lý ca + chấm công, không thấy nhắc ca (chỉ Admin)', () => {
    const nav = navPaths('Manager', features, MANAGER_DEFAULTS);
    expect(nav).toContain(paths.dashboard.shift.templates.list);
    expect(nav).toContain(paths.dashboard.attendance.logs);
    expect(nav).toContain(paths.dashboard.shiftAudit.root);
    expect(nav).not.toContain(paths.dashboard.shift.reminderRules.list);
    expect(navPaths('Admin', features)).toContain(paths.dashboard.shift.reminderRules.list);
  });

  it('nhân viên thường không thấy; "Trưởng ca" chỉ xem lịch thấy đúng mục xếp ca', () => {
    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.shift.root);
    expect(staff).not.toContain(paths.dashboard.attendance.logs);
    expect(staff).toContain(paths.dashboard.attendance.checkin);

    const lead = navPaths('Staff', features, ['shift.assignment.read']);
    expect(lead).toContain(paths.dashboard.attendance.assignments);
    expect(lead).not.toContain(paths.dashboard.attendance.logs);
    expect(lead).not.toContain(paths.dashboard.shift.templates.list);
  });
});

// Hàng hoá / kho theo quyền products.* / inventory.* (Core-be): menu quản lý trước đây chỉ Admin dù API cho cả Manager.
describe('useNavData — hàng hoá và kho theo quyền', () => {
  const features = ['commerce.retail.inventory'];
  const MANAGER_DEFAULTS = [
    'products.cost.read',
    'products.create',
    'products.update',
    'products.delete',
    'products.catalog.manage',
    'inventory.warehouse.manage',
  ];

  it('Admin và Manager (quyền mặc định) thấy quản lý sản phẩm, danh mục, kho, đơn vị tính', () => {
    [navPaths('Admin', features), navPaths('Manager', features, MANAGER_DEFAULTS)].forEach((nav) => {
      expect(nav).toContain(paths.dashboard.pos.product.new);
      expect(nav).toContain(paths.dashboard.pos.category.list);
      expect(nav).toContain(paths.dashboard.pos.warehouse.list);
      expect(nav).toContain(paths.dashboard.pos.unitOfMeasure.list);
    });
    // Chưa có API phía Core-be — giữ chỉ Admin.
    expect(navPaths('Manager', features, MANAGER_DEFAULTS)).not.toContain(paths.dashboard.pos.variantAttribute.list);
  });

  it('nhân viên thường không thấy menu quản lý; "Thủ kho" chỉ sửa hàng không thấy "Thêm mới"', () => {
    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.pos.product.root);
    expect(staff).not.toContain(paths.dashboard.pos.product.new);
    expect(staff).not.toContain(paths.dashboard.pos.category.list);
    expect(staff).not.toContain(paths.dashboard.pos.warehouse.list);

    const keeper = navPaths('Staff', features, ['products.update', 'products.cost.read']);
    expect(keeper).toContain(paths.dashboard.pos.product.root);
    expect(keeper).not.toContain(paths.dashboard.pos.product.new);
    expect(keeper).not.toContain(paths.dashboard.pos.category.list);
  });
});
