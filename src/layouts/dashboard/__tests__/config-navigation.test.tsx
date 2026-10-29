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

function navPaths(
  userRole?: string | string[],
  enabledFeatures: string[] = [],
  permissions?: string[],
  blockedFeatures?: string[]
) {
  const { result } = renderHook(() => useNavData(userRole, enabledFeatures, permissions, blockedFeatures));
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

  // Thiết bị cửa hàng (máy quầy, kiosk): chủ + quản lý (quản lý chỉ chi nhánh mình — server lọc); nhân viên không.
  it('Thiết bị cửa hàng: chủ và quản lý thấy, nhân viên không', () => {
    expect(navPaths('Admin', features)).toContain(paths.dashboard.storeSettings.devices);
    expect(navPaths('Manager', features)).toContain(paths.dashboard.storeSettings.devices);
    expect(navPaths('Staff', features)).not.toContain(paths.dashboard.storeSettings.devices);
  });
});

// Mục Thanh toán gom đối soát, đơn online, Cài đặt (phương thức theo kênh, bán online, tài khoản, báo có) — mỗi trang theo
// vai trò của nó.
describe('useNavData — Thanh toán', () => {
  const p = paths.dashboard.payment;

  it('chủ cửa hàng thấy cả ba trang trong một mục', () => {
    const visible = navPaths('Admin');
    [p.root, p.reconciliation, p.onlineOrders, p.settings].forEach((path) => expect(visible).toContain(path));
    expect(visible).not.toContain(paths.dashboard.onlineOrders.root);
  });

  it('quản lý thấy đối soát và đơn online; nhân viên chỉ thấy đơn online (gói hàng)', () => {
    const manager = navPaths('Manager');
    expect(manager).toEqual(expect.arrayContaining([p.root, p.reconciliation, p.onlineOrders]));
    expect(manager).not.toContain(p.settings);
    const staff = navPaths('Staff');
    expect(staff).toEqual(expect.arrayContaining([p.root, p.onlineOrders]));
    expect(staff).not.toContain(p.reconciliation);
    expect(staff).not.toContain(p.settings);
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
    // Quyền mặc định của Manager (GET /users/me) gồm user.read.
    const paths2 = navPaths(['Staff', 'Manager'], [], ['user.read']);
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

// Nhập hàng / nhà cung cấp theo quyền purchase.* / supplier.* (Core-be): trước đây chỉ Admin dù API cho cả Manager.
describe('useNavData — nhập hàng và nhà cung cấp theo quyền', () => {
  const features = ['commerce.retail.inventory'];

  it('Manager (quyền mặc định) thấy đơn nhập + nhà cung cấp; nhân viên thường không', () => {
    const manager = navPaths('Manager', features, ['purchase.read', 'purchase.create', 'supplier.read', 'supplier.manage']);
    expect(manager).toContain(paths.dashboard.pos.purchaseOrder.new);
    expect(manager).toContain(paths.dashboard.pos.supplier.new);

    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.pos.purchaseOrder.root);
    expect(staff).not.toContain(paths.dashboard.pos.supplier.root);
  });

  it('"Kế toán" chỉ xem: thấy danh sách, không thấy "Tạo đơn" / "Thêm mới"', () => {
    const viewer = navPaths('Staff', features, ['purchase.read', 'supplier.read']);
    expect(viewer).toContain(paths.dashboard.pos.purchaseOrder.list);
    expect(viewer).toContain(paths.dashboard.pos.supplier.list);
    expect(viewer).not.toContain(paths.dashboard.pos.purchaseOrder.new);
    expect(viewer).not.toContain(paths.dashboard.pos.supplier.new);
  });
});

// Đơn bán, khách hàng theo quyền sales.* / customer.* (Core-be): trước đây chỉ Admin dù API cho cả Manager.
describe('useNavData — đơn bán và khách hàng theo quyền', () => {
  const features = ['commerce.retail.pos'];

  it('Manager (quyền mặc định) thấy; nhân viên thường không', () => {
    const manager = navPaths('Manager', features, ['sales.order.read', 'customer.read', 'customer.manage']);
    expect(manager).toContain(paths.dashboard.pos.salesOrder.list);
    expect(manager).toContain(paths.dashboard.pos.customer.new);

    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.pos.salesOrder.root);
    expect(staff).not.toContain(paths.dashboard.pos.customer.root);
  });

  it('"CSKH" chỉ xem khách: thấy danh sách, không thấy "Thêm mới"', () => {
    const cs = navPaths('Staff', features, ['customer.read']);
    expect(cs).toContain(paths.dashboard.pos.customer.list);
    expect(cs).not.toContain(paths.dashboard.pos.customer.new);
  });
});

// Nhân viên theo quyền user.read (Core-be): Admin / Manager như trước; vai trò tuỳ chỉnh "Nhân sự" được cấp thì thấy.
describe('useNavData — nhân viên theo quyền', () => {
  it('Manager (quyền mặc định) và "Nhân sự" thấy; nhân viên thường không', () => {
    expect(navPaths('Manager', [], ['user.read'])).toContain(paths.dashboard.user.list);
    expect(navPaths('Staff', [], ['user.read', 'user.update'])).toContain(paths.dashboard.user.list);
    expect(navPaths('Staff', [], [])).not.toContain(paths.dashboard.user.root);
  });
});

// Chủ cửa hàng tắt tự chấm công trên web với người này (GET /users/me blockedFeatures) → ẩn mục Check In/Out.
describe('useNavData — tính năng tắt theo nền tảng', () => {
  const ATTENDANCE_FEATURES = ['workforce.attendance'];

  it('ẩn Check In/Out khi tự chấm công bị tắt trên web, mục khác giữ nguyên', () => {
    const blocked = navPaths('Staff', ATTENDANCE_FEATURES, [], ['attendance.self-checkin']);

    expect(blocked).not.toContain(paths.dashboard.attendance.checkin);
    expect(blocked).toContain(paths.dashboard.attendance.faceEnrollment);
  });

  it('không bị tắt (hoặc chưa nạp) thì vẫn hiện', () => {
    expect(navPaths('Staff', ATTENDANCE_FEATURES, [])).toContain(paths.dashboard.attendance.checkin);
    expect(navPaths('Staff', ATTENDANCE_FEATURES, [], [])).toContain(paths.dashboard.attendance.checkin);
  });

  it('Quản lý lương ẩn khi "Xem bảng lương" bị tắt; Lương của tôi vẫn còn', () => {
    const FEATURES = ['payroll.core', 'payroll.penalty'];
    expect(navPaths('Admin', FEATURES, [])).toContain(paths.dashboard.payroll.cycles);

    const blocked = navPaths('Admin', FEATURES, [], ['payroll.records']);
    expect(blocked).not.toContain(paths.dashboard.salary.root);
    expect(blocked).not.toContain(paths.dashboard.payroll.cycles);
    expect(blocked).not.toContain(paths.dashboard.salary.configuration);
    expect(blocked).toContain(paths.dashboard.payroll.myPayroll);
  });

  it('Lương của tôi ẩn khi "Xem lương của mình" bị tắt', () => {
    const FEATURES = ['payroll.core'];
    expect(navPaths('Staff', FEATURES, [])).toContain(paths.dashboard.payroll.myPayroll);
    expect(navPaths('Staff', FEATURES, [], ['payroll.self'])).not.toContain(paths.dashboard.payroll.myPayroll);
  });

  it('kiểm quầy, việc của tôi, bán hàng, báo cáo ẩn theo đúng tính năng bị tắt', () => {
    const FEATURES = ['commerce.retail.pos', 'workforce.shift-scheduling'];
    const all = navPaths('Admin', FEATURES, []);
    expect(all).toEqual(
      expect.arrayContaining([
        paths.dashboard.shiftCash.root,
        paths.dashboard.cleaning.myChecklist,
        paths.dashboard.pos.sale.root,
        paths.dashboard.pos.salesOrder.new,
        paths.dashboard.pos.report.root,
      ])
    );

    const blocked = navPaths('Admin', FEATURES, [], [
      'shift-cash.counter',
      'cleaning.tasks',
      'sales.pos',
      'analytics.reports',
    ]);
    expect(blocked).not.toContain(paths.dashboard.shiftCash.root);
    expect(blocked).not.toContain(paths.dashboard.cleaning.myChecklist);
    expect(blocked).not.toContain(paths.dashboard.pos.sale.root);
    expect(blocked).not.toContain(paths.dashboard.pos.salesOrder.new);
    expect(blocked).not.toContain(paths.dashboard.pos.report.root);
    // Hạng mục & lịch và danh sách hoá đơn không thuộc tính năng nào.
    expect(blocked).toContain(paths.dashboard.inspection.templates);
    expect(blocked).toContain(paths.dashboard.pos.salesOrder.list);
  });
});
