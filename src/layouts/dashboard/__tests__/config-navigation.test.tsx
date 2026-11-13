import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { paths } from 'src/routes/paths';

import { hasAnyRole } from 'src/auth/roles';
import { hasAnyPermission } from 'src/auth/permissions';
import { requiredRolesFor, requiredPermissionsFor } from 'src/auth/route-roles';

// ----------------------------------------------------------------------
// Cây menu quản trị mới (thanh ngang kiểu KiotViet): ai thấy trang nào — theo tính năng cửa hàng, loại chi nhánh, tính
// năng web/app, vai trò + quyền Core-be và "Menu theo vai trò". Giữ đúng các luật của menu cũ; hành động "Thêm / Tạo"
// giờ là nút "+" (actions) chứ không phải dòng menu.
// ----------------------------------------------------------------------

const brand = vi.hoisted(() => ({ isCiCi: true }));
vi.mock('src/components/branding', () => ({
  useStoreBrand: () => ({ isCiCi: brand.isCiCi }),
}));

const counter = vi.hoisted(() => ({ on: false }));
vi.mock('src/sections/counter/counter-scope', () => ({
  useCounterSession: () => counter.on,
}));

// Imported after the mocks above so the hook picks up the mocked modules.
import { useNavModules } from 'src/layouts/dashboard/config-navigation';
import { findActivePage, normalizeSearch } from 'src/layouts/dashboard/nav/nav-filter';

import { useWorkingBranch } from 'src/store/working-branch-store';

function nav(
  roles?: string | string[],
  enabledFeatures: string[] = [],
  permissions?: string[],
  blockedFeatures?: string[],
  navMenu?: unknown
) {
  const { result } = renderHook(() =>
    useNavModules(roles, enabledFeatures, permissions, blockedFeatures, navMenu)
  );
  return result.current;
}

/** Đường dẫn trang + đường dẫn hành động "+" thấy được. */
function navPaths(...args: Parameters<typeof nav>) {
  const tree = nav(...args);
  return tree.pages.flatMap((p) => [p.path, ...p.actions.map((a) => a.path)]);
}

function navKeys(...args: Parameters<typeof nav>) {
  return nav(...args).pages.map((p) => p.key);
}

const ALL_FEATURES = [
  'commerce.retail.pos',
  'commerce.retail.inventory',
  'commerce.retail.kiotviet-sync',
  'commerce.fnb.pos',
  'workforce.shift-scheduling',
  'workforce.attendance',
  'payroll.core',
  'payroll.penalty',
  'store.camera',
  'notifications.chatbot',
  'social.selling',
  'finance.shareholders',
];

afterEach(() => {
  brand.isCiCi = true;
  counter.on = false;
  useWorkingBranch.setState({ hydrated: false, branch: null, options: null, lock: null });
});

describe('cây menu — module theo nghiệp vụ', () => {
  it('chủ cửa hàng thấy 9 module theo thứ tự KiotViet + Cài đặt + Cá nhân', () => {
    const tree = nav('Admin', ALL_FEATURES);
    expect(tree.modules.map((m) => m.title)).toEqual([
      'Tổng quan',
      'Đơn hàng',
      'Hàng hoá',
      'Mua hàng',
      'Khách hàng',
      'Nhân viên',
      'Sổ quỹ',
      'Báo cáo',
      'Bán online',
    ]);
    expect(tree.settings?.title).toBe('Cài đặt');
    expect(tree.me?.title).toBe('Cá nhân');
  });

  it('khoá trang không trùng nhau trong cây đầy đủ', () => {
    const keys = navKeys('Admin', ALL_FEATURES);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('không còn dòng menu "Thêm mới / Tạo" — chỉ là hành động "+"', () => {
    const pagePaths = nav('Admin', ALL_FEATURES).pages.map((p) => p.path);
    [
      paths.dashboard.pos.product.new,
      paths.dashboard.pos.category.new,
      paths.dashboard.pos.supplier.new,
      paths.dashboard.pos.purchaseOrder.new,
      paths.dashboard.pos.customer.new,
      paths.dashboard.pos.expense.new,
      paths.dashboard.role.new,
      paths.dashboard.user.new,
    ].forEach((p) => expect(pagePaths).not.toContain(p));
  });

  it('nhân viên thu ngân: menu gọn — Đơn hàng, Hàng hoá, Sổ quỹ + Cá nhân', () => {
    const tree = nav('Staff', ALL_FEATURES, []);
    expect(tree.modules.map((m) => m.key)).toEqual(['sales', 'goods', 'cash']);
    expect(tree.settings).toBeNull();
    const business = tree.pages.filter((p) => p.moduleKey !== 'me').map((p) => p.key);
    expect(business).toEqual([
      'sales.pos',
      'sales.online-orders',
      'goods.products',
      'goods.shift-checks',
      'cash.shift',
    ]);
    expect(tree.me?.groups.length).toBeGreaterThan(0);
  });

  it('việc của mình ở Cá nhân, việc quản lý người khác ở Nhân viên', () => {
    const staff = navKeys('Staff', ALL_FEATURES, []);
    expect(staff).toEqual(
      expect.arrayContaining(['me.leave', 'me.records', 'me.violations', 'me.inspection'])
    );
    expect(staff).not.toContain('hr.records');
    expect(staff).not.toContain('work.inspection');

    // Quản lý có inspection.read: dùng "Kiểm tra ca" trong Nhân viên, không trùng ở Cá nhân.
    const manager = navKeys('Manager', ALL_FEATURES, ['inspection.read', 'hr.record.manage']);
    expect(manager).toContain('work.inspection');
    expect(manager).not.toContain('me.inspection');
    expect(manager).toContain('hr.records');
    expect(manager).toContain('me.records');
  });

  it('Duyệt khuôn mặt và Chấm công trực tiếp không còn trong Cá nhân', () => {
    const tree = nav('Admin', ALL_FEATURES);
    const byKey = new Map(tree.pages.map((p) => [p.key, p]));
    expect(byKey.get('staff.face-approvals')?.moduleKey).toBe('staff');
    expect(byKey.get('home.live')?.moduleKey).toBe('home');
    expect(byKey.get('goods.shift-checks')?.moduleKey).toBe('goods');
  });
});

describe('System Jobs', () => {
  it('CiCi: Admin vẫn thấy System Jobs', () => {
    expect(navPaths('Admin')).toContain(paths.dashboard.systemJobs.root);
  });

  it('cửa hàng khác: ẩn System Jobs với Admin và trong danh sách đầy đủ', () => {
    brand.isCiCi = false;
    expect(navPaths('Admin')).not.toContain(paths.dashboard.systemJobs.root);
    expect(navPaths(undefined)).not.toContain(paths.dashboard.systemJobs.root);
    expect(navPaths('Admin')).toContain(paths.dashboard.notificationConfig.root);
  });
});

describe('Cảnh báo tự động', () => {
  it('Admin thấy, kể cả ở cửa hàng không phải CiCi', () => {
    expect(navPaths('Admin')).toContain(paths.dashboard.automation.root);
    brand.isCiCi = false;
    expect(navPaths('Admin')).toContain(paths.dashboard.automation.root);
  });

  it.each(['Manager', 'Staff'])('%s không thấy', (role) => {
    expect(navPaths(role)).not.toContain(paths.dashboard.automation.root);
  });
});

describe('F&B', () => {
  it('Thiết lập F&B chỉ hiện khi bật commerce.fnb.pos, cho Admin và Quản lý', () => {
    expect(navPaths('Admin', ['commerce.retail.inventory'])).not.toContain(
      paths.dashboard.fnb.root
    );
    expect(navPaths('Admin', ['commerce.fnb.pos'])).toContain(paths.dashboard.fnb.root);

    const fnbBranch = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };
    useWorkingBranch.setState({ hydrated: true, branch: fnbBranch, options: [fnbBranch] });
    expect(navPaths('Manager', ['commerce.fnb.pos'])).toContain(paths.dashboard.fnb.root);
    expect(navPaths('Staff', ['commerce.fnb.pos'])).not.toContain(paths.dashboard.fnb.root);
  });

  it('Hàng hoá hiện với cửa hàng bán lẻ hoặc cửa hàng chỉ có F&B', () => {
    expect(navPaths('Admin', [])).not.toContain(paths.dashboard.pos.product.list);
    expect(navPaths('Admin', ['commerce.retail.inventory'])).toContain(
      paths.dashboard.pos.product.list
    );
    expect(navPaths('Admin', ['commerce.fnb.pos'])).toContain(paths.dashboard.pos.product.list);
  });
});

describe('menu theo loại chi nhánh', () => {
  const FNB = ['commerce.fnb.pos', 'workforce.attendance'];
  const retail = { id: 'b1', name: 'Cửa hàng', type: 'retail' as const };
  const fnb = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };
  const working = (
    branch: typeof retail | typeof fnb | null,
    options: (typeof retail | typeof fnb)[] | null
  ) => useWorkingBranch.setState({ hydrated: true, branch, options });

  const staffFnbPaths = [
    paths.dashboard.fnb.pos,
    paths.dashboard.fnb.printStation,
    paths.dashboard.fnb.stock,
  ];

  it('nhân viên ở chi nhánh bán lẻ: không thấy mục F&B; mục dùng chung vẫn còn', () => {
    working(retail, [retail, fnb]);
    const shown = navPaths('Staff', FNB);
    staffFnbPaths.forEach((path) => expect(shown).not.toContain(path));
    expect(shown).toContain(paths.dashboard.attendance.checkin);
    expect(shown).toContain(paths.dashboard.shiftCash.root);
  });

  it('nhân viên đổi sang chi nhánh F&B: thấy Bán hàng F&B, Máy in phiếu, Nguyên liệu', () => {
    working(fnb, [retail, fnb]);
    const shown = navPaths('Staff', FNB);
    staffFnbPaths.forEach((path) => expect(shown).toContain(path));
  });

  it('chưa biết chi nhánh đang làm việc: nhân viên chưa thấy mục F&B', () => {
    staffFnbPaths.forEach((path) => expect(navPaths('Staff', FNB)).not.toContain(path));
  });

  it('quản lý: theo các loại chi nhánh được phân công', () => {
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
});

describe('camera, giám sát, báo cáo chỉ Admin', () => {
  const features = ['store.camera', 'workforce.attendance'];
  const ownerOnly = [
    paths.dashboard.general.storeMonitor,
    paths.dashboard.attendance.live,
    paths.dashboard.pos.report.dashboard,
    paths.dashboard.pos.report.revenue,
    paths.dashboard.pos.report.tax,
  ];

  it('Admin thấy', () => {
    const admin = navPaths('Admin', features);
    ownerOnly.forEach((p) => expect(admin).toContain(p));
  });

  it.each(['Manager', 'Staff'])('%s không thấy', (role) => {
    const visible = navPaths(role, features, role === 'Manager' ? ['attendance.read'] : []);
    ownerOnly.forEach((p) => expect(visible).not.toContain(p));
    if (role === 'Manager') expect(visible).toContain(paths.dashboard.attendance.report);
  });

  it('Thiết bị cửa hàng: chủ và quản lý thấy, nhân viên không', () => {
    expect(navPaths('Admin', features)).toContain(paths.dashboard.storeSettings.devices);
    expect(navPaths('Manager', features)).toContain(paths.dashboard.storeSettings.devices);
    expect(navPaths('Staff', features)).not.toContain(paths.dashboard.storeSettings.devices);
  });

  it('Mẫu in: theo quyền sales.print-template.manage', () => {
    const p = paths.dashboard.storeSettings.printTemplates;
    expect(navPaths('Admin', features)).toContain(p);
    expect(navPaths('Manager', features, ['sales.print-template.manage'])).toContain(p);
    expect(navPaths('Staff', features, [])).not.toContain(p);
  });
});

describe('thanh toán tách theo nghiệp vụ', () => {
  const p = paths.dashboard.payment;

  it('đối soát ở Sổ quỹ, đơn online ở Đơn hàng, cài đặt ở ⚙ Cài đặt', () => {
    const byKey = new Map(nav('Admin').pages.map((x) => [x.key, x]));
    expect(byKey.get('cash.reconciliation')?.path).toBe(p.reconciliation);
    expect(byKey.get('sales.online-orders')?.moduleKey).toBe('sales');
    expect(byKey.get('set.payment')?.moduleKey).toBe('settings');
  });

  it('quản lý thấy đối soát và đơn online; nhân viên chỉ thấy đơn online', () => {
    const manager = navPaths('Manager');
    expect(manager).toEqual(expect.arrayContaining([p.reconciliation, p.onlineOrders]));
    expect(manager).not.toContain(p.settings);
    const staff = navPaths('Staff');
    expect(staff).toContain(p.onlineOrders);
    expect(staff).not.toContain(p.reconciliation);
    expect(staff).not.toContain(p.settings);
  });
});

describe('nhiều vai trò', () => {
  it('Staff kiêm Admin thấy mục chỉ dành cho Admin', () => {
    expect(navPaths('Staff')).not.toContain(paths.dashboard.automation.root);
    expect(navPaths(['Staff', 'Admin'])).toContain(paths.dashboard.automation.root);
    expect(navPaths(['Staff', 'Admin'])).toContain(paths.dashboard.storeSettings.root);
  });

  it('Staff kiêm Quản lý thấy mục của Quản lý nhưng không thấy mục chỉ Admin', () => {
    const shown = navPaths(['Staff', 'Manager'], [], ['user.read']);
    expect(shown).toContain(paths.dashboard.user.list);
    expect(shown).not.toContain(paths.dashboard.storeSettings.root);
  });
});

describe('báo cáo theo quyền', () => {
  it('nhân viên thường không thấy; "Kế toán" chỉ có doanh thu thấy đúng Doanh thu', () => {
    expect(navPaths('Staff', [], [])).not.toContain(paths.dashboard.pos.report.revenue);
    const accountant = navPaths('Staff', [], ['analytics.revenue.read']);
    expect(accountant).toContain(paths.dashboard.pos.report.revenue);
    expect(accountant).not.toContain(paths.dashboard.pos.report.dashboard);
    expect(accountant).not.toContain(paths.dashboard.pos.report.tax);
  });
});

describe('chi phí theo quyền', () => {
  const expense = paths.dashboard.pos.expense;

  it('Admin thấy chi phí, danh mục, định kỳ và nút Thêm chi phí', () => {
    const shown = navPaths('Admin');
    [expense.list, expense.new, expense.categories, expense.recurringTemplates].forEach((p) =>
      expect(shown).toContain(p)
    );
  });

  it('Quản lý / nhân viên thường không thấy', () => {
    expect(navPaths('Manager', [], [])).not.toContain(expense.list);
    expect(navPaths('Staff', [], [])).not.toContain(expense.list);
  });

  it('chỉ có quyền xem: thấy danh sách, không có nút Thêm; có quyền thêm thì có', () => {
    const viewer = navPaths('Staff', [], ['expense.read']);
    expect(viewer).toContain(expense.list);
    expect(viewer).not.toContain(expense.new);
    expect(navPaths('Staff', [], ['expense.read', 'expense.create'])).toContain(expense.new);
  });
});

describe('lương theo quyền', () => {
  const features = ['payroll.core', 'payroll.penalty'];
  const MANAGER_DEFAULTS = [
    'payroll.records.read',
    'payroll.salary-config.read',
    'payroll.policy.manage',
  ];

  it('Admin và Manager (quyền mặc định) thấy đủ mục lương', () => {
    [navPaths('Admin', features), navPaths('Manager', features, MANAGER_DEFAULTS)].forEach(
      (shown) => {
        expect(shown).toContain(paths.dashboard.salary.configuration);
        expect(shown).toContain(paths.dashboard.payroll.batch);
        expect(shown).toContain(paths.dashboard.penaltyPolicy.list);
      }
    );
  });

  it('nhân viên thường không thấy; "Kế toán lương" thấy đúng kỳ + bảng lương', () => {
    expect(navPaths('Staff', features, [])).not.toContain(paths.dashboard.payroll.batch);
    const accountant = navPaths('Staff', features, ['payroll.records.read']);
    expect(accountant).toContain(paths.dashboard.payroll.batch);
    expect(accountant).toContain(paths.dashboard.payroll.cycles);
    expect(accountant).not.toContain(paths.dashboard.salary.configuration);
    expect(accountant).not.toContain(paths.dashboard.holidayPolicy.list);
  });
});

describe('ca làm và chấm công theo quyền', () => {
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

  it('Manager thấy quản lý ca + chấm công, không thấy nhắc ca (chỉ Admin)', () => {
    const shown = navPaths('Manager', features, MANAGER_DEFAULTS);
    expect(shown).toContain(paths.dashboard.shift.templates.list);
    expect(shown).toContain(paths.dashboard.attendance.logs);
    expect(shown).toContain(paths.dashboard.shiftAudit.root);
    expect(shown).not.toContain(paths.dashboard.shift.reminderRules.list);
    expect(navPaths('Admin', features)).toContain(paths.dashboard.shift.reminderRules.list);
  });

  it('nhân viên thường không thấy; "Trưởng ca" chỉ xem lịch thấy đúng mục xếp ca', () => {
    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.shift.schedules.list);
    expect(staff).not.toContain(paths.dashboard.attendance.logs);
    expect(staff).toContain(paths.dashboard.attendance.checkin);

    const lead = navPaths('Staff', features, ['shift.assignment.read']);
    expect(lead).toContain(paths.dashboard.attendance.assignments);
    expect(lead).not.toContain(paths.dashboard.attendance.logs);
    expect(lead).not.toContain(paths.dashboard.shift.templates.list);
  });
});

describe('hàng hoá, kho, nhập hàng theo quyền', () => {
  const features = ['commerce.retail.inventory'];
  const MANAGER_DEFAULTS = [
    'products.cost.read',
    'products.create',
    'products.update',
    'products.delete',
    'products.catalog.manage',
    'inventory.warehouse.manage',
  ];

  it('Admin và Manager thấy thêm hàng, nhóm hàng, kho, đơn vị tính, tồn kho', () => {
    [navPaths('Admin', features), navPaths('Manager', features, MANAGER_DEFAULTS)].forEach(
      (shown) => {
        expect(shown).toContain(paths.dashboard.pos.product.new);
        expect(shown).toContain(paths.dashboard.pos.category.list);
        expect(shown).toContain(paths.dashboard.pos.warehouse.list);
        expect(shown).toContain(paths.dashboard.pos.unitOfMeasure.list);
        expect(shown).toContain(paths.dashboard.pos.inventory.list);
      }
    );
    expect(navPaths('Manager', features, MANAGER_DEFAULTS)).not.toContain(
      paths.dashboard.pos.variantAttribute.list
    );
  });

  it('nhân viên thường: thấy danh sách hàng (chỉ xem), không có nút thêm, không thấy quản lý kho', () => {
    const staff = navPaths('Staff', features, []);
    expect(staff).toContain(paths.dashboard.pos.product.list);
    expect(staff).not.toContain(paths.dashboard.pos.product.new);
    expect(staff).not.toContain(paths.dashboard.pos.category.list);
    expect(staff).not.toContain(paths.dashboard.pos.warehouse.list);
    expect(staff).not.toContain(paths.dashboard.pos.inventory.list);
  });

  it('Manager thấy phiếu nhập + nhà cung cấp kèm nút tạo; "Kế toán" chỉ xem không có nút', () => {
    const manager = navPaths('Manager', features, [
      'purchase.read',
      'purchase.create',
      'supplier.read',
      'supplier.manage',
    ]);
    expect(manager).toContain(paths.dashboard.pos.purchaseOrder.new);
    expect(manager).toContain(paths.dashboard.pos.purchaseOrder.import);
    expect(manager).toContain(paths.dashboard.pos.supplier.new);

    const viewer = navPaths('Staff', features, ['purchase.read', 'supplier.read']);
    expect(viewer).toContain(paths.dashboard.pos.purchaseOrder.list);
    expect(viewer).toContain(paths.dashboard.pos.supplier.list);
    expect(viewer).not.toContain(paths.dashboard.pos.purchaseOrder.new);
    expect(viewer).not.toContain(paths.dashboard.pos.supplier.new);
  });
});

describe('hoá đơn, khách hàng, nhân viên theo quyền', () => {
  const features = ['commerce.retail.pos'];

  it('Manager thấy hoá đơn + khách hàng; nhân viên thường không', () => {
    const manager = navPaths('Manager', features, [
      'sales.order.read',
      'customer.read',
      'customer.manage',
    ]);
    expect(manager).toContain(paths.dashboard.pos.salesOrder.list);
    expect(manager).toContain(paths.dashboard.pos.customer.new);
    const staff = navPaths('Staff', features, []);
    expect(staff).not.toContain(paths.dashboard.pos.salesOrder.list);
    expect(staff).not.toContain(paths.dashboard.pos.customer.list);
  });

  it('màn bán hàng: mọi nhân viên (theo tính năng web/app "Bán hàng")', () => {
    expect(navPaths('Staff', features, [])).toContain(paths.dashboard.pos.sale.root);
    expect(navPaths('Staff', features, [], ['sales.pos'])).not.toContain(
      paths.dashboard.pos.sale.root
    );
  });

  it('danh sách nhân viên theo user.read', () => {
    expect(navPaths('Manager', [], ['user.read'])).toContain(paths.dashboard.user.list);
    expect(navPaths('Staff', [], ['user.read', 'user.update'])).toContain(
      paths.dashboard.user.list
    );
    expect(navPaths('Staff', [], [])).not.toContain(paths.dashboard.user.list);
  });
});

describe('tính năng tắt theo nền tảng', () => {
  it('ẩn Chấm công vào / ra khi tự chấm công bị tắt trên web', () => {
    const blocked = navPaths('Staff', ['workforce.attendance'], [], ['attendance.self-checkin']);
    expect(blocked).not.toContain(paths.dashboard.attendance.checkin);
    expect(blocked).toContain(paths.dashboard.attendance.faceEnrollment);
    expect(navPaths('Staff', ['workforce.attendance'], [])).toContain(
      paths.dashboard.attendance.checkin
    );
  });

  it('Quản lý lương ẩn khi "Xem bảng lương" bị tắt; Lương của tôi vẫn còn', () => {
    const FEATURES = ['payroll.core', 'payroll.penalty'];
    expect(navPaths('Admin', FEATURES, [])).toContain(paths.dashboard.payroll.cycles);
    const blocked = navPaths('Admin', FEATURES, [], ['payroll.records']);
    expect(blocked).not.toContain(paths.dashboard.payroll.cycles);
    expect(blocked).not.toContain(paths.dashboard.salary.configuration);
    expect(blocked).not.toContain(paths.dashboard.penaltyPolicy.list);
    expect(blocked).toContain(paths.dashboard.payroll.myPayroll);
  });

  it('kiểm quầy, việc của tôi, bán hàng, báo cáo ẩn theo đúng tính năng bị tắt', () => {
    const FEATURES = ['commerce.retail.pos', 'workforce.shift-scheduling'];
    expect(navPaths('Admin', FEATURES, [])).toEqual(
      expect.arrayContaining([
        paths.dashboard.shiftCash.root,
        paths.dashboard.cleaning.myChecklist,
        paths.dashboard.pos.sale.root,
        paths.dashboard.pos.report.revenue,
      ])
    );
    const blocked = navPaths(
      'Admin',
      FEATURES,
      [],
      ['shift-cash.counter', 'cleaning.tasks', 'sales.pos', 'analytics.reports']
    );
    expect(blocked).not.toContain(paths.dashboard.shiftCash.root);
    expect(blocked).not.toContain(paths.dashboard.cleaning.myChecklist);
    expect(blocked).not.toContain(paths.dashboard.pos.sale.root);
    expect(blocked).not.toContain(paths.dashboard.pos.report.revenue);
    expect(blocked).toContain(paths.dashboard.inspection.templates);
    expect(blocked).toContain(paths.dashboard.pos.salesOrder.list);
  });
});

describe('Bán online', () => {
  it('chỉ hiện khi cửa hàng bật social.selling', () => {
    expect(navPaths('Admin')).not.toContain(paths.dashboard.social.root);
    const admin = navPaths('Admin', ['social.selling']);
    [
      paths.dashboard.social.root,
      paths.dashboard.social.channels,
      paths.dashboard.social.settings,
      paths.dashboard.social.overview,
      paths.dashboard.social.calendar,
    ].forEach((p) => expect(admin).toContain(p));
  });

  it('quản lý có social.posts thấy Bài đăng, không thấy Kênh kết nối', () => {
    const manager = navPaths('Manager', ['social.selling'], ['social.posts']);
    expect(manager).toContain(paths.dashboard.social.root);
    expect(manager).not.toContain(paths.dashboard.social.channels);
    expect(navPaths('Staff', ['social.selling'], [])).not.toContain(paths.dashboard.social.root);
  });
});

describe('máy quầy', () => {
  it('chỉ có module Máy quầy, ai đăng nhập cũng vậy', () => {
    counter.on = true;
    const tree = nav('Staff', ['commerce.retail.pos', 'commerce.retail.inventory'], []);
    expect(tree.modules.map((m) => m.key)).toEqual(['counter']);
    expect(tree.settings).toBeNull();
    expect(tree.me).toBeNull();
    expect(tree.pages.map((p) => p.path)).toEqual(
      expect.arrayContaining([paths.dashboard.pos.sale.root, paths.dashboard.pos.salesOrder.list])
    );
  });
});

describe('Menu theo vai trò (navMenu)', () => {
  const policy = {
    hiddenKeys: ['goods.products', 'staff.roles', 'cash.shift'],
    pinnedKeys: ['sales.pos', 'pay.batch', 'unknown.key'],
    homeKey: 'sales.pos',
    hideFromSearch: false,
  };

  it('ẩn mục khỏi menu nhưng vẫn tìm được; ghim / trang mở đầu chỉ gồm mục thấy được', () => {
    const tree = nav('Staff', ALL_FEATURES, [], [], policy);
    const keys = tree.pages.map((p) => p.key);
    expect(keys).not.toContain('goods.products');
    expect(keys).not.toContain('cash.shift');
    expect(tree.searchable.map((p) => p.key)).toContain('goods.products');
    // pay.batch: nhân viên không có quyền — không hiện dù được ghim; khoá lạ bị bỏ.
    expect(tree.rolePins).toEqual(['sales.pos']);
    expect(tree.homeKey).toBe('sales.pos');
  });

  it('ẩn cả tìm kiếm khi chủ cửa hàng chọn', () => {
    const tree = nav('Staff', ALL_FEATURES, [], [], { ...policy, hideFromSearch: true });
    expect(tree.searchable.map((p) => p.key)).not.toContain('goods.products');
  });

  it('không ẩn được "Vai trò & quyền" với chủ cửa hàng', () => {
    expect(navKeys('Admin', ALL_FEATURES, undefined, [], policy)).toContain('staff.roles');
  });

  it('ẩn menu không bao giờ làm hiện mục không có quyền', () => {
    const keys = navKeys('Staff', ALL_FEATURES, [], [], {
      hiddenKeys: [],
      pinnedKeys: ['set.store'],
      homeKey: 'set.store',
    });
    expect(keys).not.toContain('set.store');
  });
});

describe('menu khớp luật chặn route (thấy mục thì mở được trang)', () => {
  const MANAGER = [
    'payroll.records.read',
    'payroll.salary-config.read',
    'payroll.policy.manage',
    'payroll.complaint.review',
    'attendance.read',
    'attendance.adjust',
    'attendance.request.process',
    'shift.template.manage',
    'shift.schedule.manage',
    'shift.assignment.read',
    'shift.request.review',
    'shift.audit.read',
    'inspection.read',
    'hr.task.manage',
    'products.cost.read',
    'products.create',
    'products.catalog.manage',
    'inventory.warehouse.manage',
    'purchase.read',
    'purchase.create',
    'supplier.read',
    'supplier.manage',
    'sales.order.read',
    'sales.print-template.manage',
    'customer.read',
    'customer.manage',
    'user.read',
    'user.create',
    'user.update',
    'posts.manage',
    'social.posts',
  ];
  const users: [string, string[], string[] | undefined][] = [
    ['Admin', ['Admin'], undefined],
    ['Quản lý', ['Manager'], MANAGER],
    ['Nhân viên', ['Staff'], []],
    [
      'Kế toán',
      ['Staff'],
      [
        'expense.read',
        'expense.create',
        'analytics.revenue.read',
        'purchase.read',
        'supplier.read',
      ],
    ],
  ];

  it.each(users)('%s', (_, roles, permissions) => {
    const tree = nav(roles, ALL_FEATURES, permissions ?? [], []);
    const user = { roles, permissions: permissions ?? [] };
    tree.pages
      .flatMap((p) => [p.path, ...p.actions.map((a) => a.path)])
      .forEach((full) => {
        const path = full.split('?')[0];
        const needRoles = requiredRolesFor(path);
        const needPerms = requiredPermissionsFor(path);
        expect(hasAnyRole(roles, needRoles), `${path} cần vai trò ${needRoles}`).toBe(true);
        expect(hasAnyPermission(user, needPerms), `${path} cần quyền ${needPerms}`).toBe(true);
      });
  });
});

describe('trang đang mở và tìm không dấu', () => {
  it('khớp đường dẫn dài nhất, trang con thuộc trang danh sách', () => {
    const { pages } = nav('Admin', ALL_FEATURES);
    expect(findActivePage(pages, `${paths.dashboard.pos.purchaseOrder.root}/abc/edit`)?.key).toBe(
      'purchase.orders'
    );
    expect(findActivePage(pages, paths.dashboard.shiftCash.monthly)?.key).toBe(
      'cash.shift-monthly'
    );
    expect(findActivePage(pages, paths.dashboard.shiftCash.root)?.key).toBe('cash.shift');
    expect(findActivePage(pages, paths.dashboard.pos.expense.categories)?.key).toBe(
      'cash.expense-categories'
    );
    expect(findActivePage(pages, paths.dashboard.storeSettings.root, '?tab=agent-keys')?.key).toBe(
      'set.mcp'
    );
    expect(findActivePage(pages, paths.dashboard.storeSettings.root, '')?.key).toBe('set.store');
  });

  it('bỏ dấu tiếng Việt', () => {
    expect(normalizeSearch('Phiếu nhập hàng')).toBe('phieu nhap hang');
    expect(normalizeSearch('Đơn hàng')).toBe('don hang');
  });
});
