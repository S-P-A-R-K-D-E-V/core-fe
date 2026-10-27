import { getUserRoles } from './roles';

// ----------------------------------------------------------------------
// Mã quyền — trùng Core-be (CoreCms.Domain/Common/PermissionCatalog.cs, kiểm bằng [RequirePermission]). Quyền thật do API
// quyết định; web chỉ ẩn / hiện cho khớp. Danh mục đầy đủ kèm tên tiếng Việt lấy từ GET /permissions/catalog.
// ----------------------------------------------------------------------

export const PERMISSIONS = {
  analytics: {
    dashboard: 'analytics.dashboard.read',
    revenue: 'analytics.revenue.read',
    productSales: 'analytics.product-sales.read',
    customer: 'analytics.customer.read',
    inventory: 'analytics.inventory.read',
    paymentMethod: 'analytics.payment-method.read',
    tax: 'analytics.tax.read',
    expense: 'analytics.expense.read',
    debt: 'analytics.debt.read',
    breakEven: 'analytics.break-even.read',
    financial: 'analytics.financial.read',
    employeeSales: 'analytics.employee-sales.read',
    saleChannel: 'analytics.sale-channel.read',
    /** Xuất Excel — cần thêm quyền xem báo cáo tương ứng. */
    export: 'analytics.export',
  },
  /** Chi phí vận hành (/expenses/*) — mọi thao tác ghi cần thêm quyền xem (API kiểm cả hai). */
  expense: {
    read: 'expense.read',
    create: 'expense.create',
    update: 'expense.update',
    delete: 'expense.delete',
    categoryManage: 'expense.category.manage',
    recurringManage: 'expense.recurring.manage',
  },
  /**
   * Giám sát Kiểm quầy (trước đây cứng "chỉ Admin"). Xem: vào không cần ca / vị trí, xem ngày cũ, nhật ký, điều tra chênh
   * lệch. Sửa (cần kèm xem): ghi ngày cũ, sửa / xoá khoản của người khác, ghi khi không có ca.
   */
  shiftCash: {
    oversightRead: 'shift-cash.oversight.read',
    oversightManage: 'shift-cash.oversight.manage',
    /** Doanh thu ở Kiểm quầy (theo kênh tiền, đối chiếu chuyển khoản / KiotViet, hoá đơn bán) — không có: hiện "****". */
    revenueRead: 'shift-cash.revenue.read',
  },
  /** Lương — lương của chính mình (my-payroll) không cần quyền. Quyền ghi cần kèm quyền xem tương ứng. */
  payroll: {
    recordsRead: 'payroll.records.read',
    calculate: 'payroll.calculate',
    recalculate: 'payroll.recalculate',
    finalize: 'payroll.finalize',
    paymentPrepare: 'payroll.payment.prepare',
    markPaid: 'payroll.mark-paid',
    cycleManage: 'payroll.cycle.manage',
    cyclePublish: 'payroll.cycle.publish',
    cycleDelete: 'payroll.cycle.delete',
    penaltyManage: 'payroll.penalty.manage',
    policyManage: 'payroll.policy.manage',
    salaryConfigRead: 'payroll.salary-config.read',
    salaryConfigManage: 'payroll.salary-config.manage',
  },
  /** Chấm công — tự chấm công, việc của chính mình không cần quyền. */
  attendance: {
    read: 'attendance.read',
    adjust: 'attendance.adjust',
    requestProcess: 'attendance.request.process',
  },
  /** Vệ sinh — checklist của mình, chụp ảnh, đánh dấu xong không cần quyền. Chấm điểm / phạt cần kèm quyền xem. */
  cleaning: {
    read: 'cleaning.read',
    templateManage: 'cleaning.template.manage',
    review: 'cleaning.review',
    penaltyManage: 'cleaning.penalty.manage',
  },
  /**
   * Kiểm tra cửa hàng (/inspections). Trưởng ca tự kiểm nhanh ca mình và người phụ trách tự sửa lỗi của mình không cần
   * quyền; kết quả kiểm không có đường nào tới bảng lương.
   */
  inspection: {
    conduct: 'inspection.conduct',
    spot: 'inspection.spot',
    read: 'inspection.read',
    manage: 'inspection.manage',
    templateManage: 'inspection.template.manage',
    correctiveActionManage: 'inspection.corrective-action.manage',
  },
  /** Ca làm — xem mẫu / lịch ca, lịch của mình, đăng ký / nhường / đổi ca của mình không cần quyền. */
  shift: {
    templateManage: 'shift.template.manage',
    scheduleManage: 'shift.schedule.manage',
    assignmentRead: 'shift.assignment.read',
    assignmentManage: 'shift.assignment.manage',
    registrationManage: 'shift.registration.manage',
    requestReview: 'shift.request.review',
    /** Sửa ca đã chấm công / đã bắt đầu, duyệt muộn, tạo ca thay đã duyệt — mặc định chỉ Admin. */
    override: 'shift.override',
    auditRead: 'shift.audit.read',
    reminderManage: 'shift.reminder.manage',
    /** Duyệt đơn xin nghỉ ca đã xếp (Nội quy Điều 7) — tạm thời chỉ Admin. */
    leaveReview: 'shift.leave.review',
  },
  /**
   * Nhân sự theo Quy chế / Nội quy: văn bản ký xác nhận, target tuần, nhiệm vụ, biên bản, điểm + xếp loại. Nhân viên xem /
   * ký / nộp phần của mình không cần quyền.
   */
  hr: {
    policyManage: 'hr.policy.manage',
    targetManage: 'hr.target.manage',
    taskManage: 'hr.task.manage',
    recordManage: 'hr.record.manage',
    performanceRead: 'hr.performance.read',
    performanceManage: 'hr.performance.manage',
  },
  /** Hàng hoá — xem hàng, nhóm hàng, thương hiệu, đơn vị không cần quyền (màn bán hàng). Thêm / sửa cần kèm xem giá vốn. */
  products: {
    costRead: 'products.cost.read',
    create: 'products.create',
    update: 'products.update',
    delete: 'products.delete',
    /** Nhóm hàng, thương hiệu, đơn vị tính. */
    catalogManage: 'products.catalog.manage',
  },
  /** Tồn kho — xem danh sách kho không cần quyền. Chỉnh tồn trực tiếp mặc định chỉ Admin. */
  inventory: {
    warehouseManage: 'inventory.warehouse.manage',
    adjustmentRead: 'inventory.adjustment.read',
    adjust: 'inventory.adjust',
  },
  /** Phiếu kiểm kho / xuất huỷ / xuất dùng nội bộ: lập (gồm huỷ phiếu nháp) và hoàn thành đều cần kèm quyền xem. */
  stockTake: { read: 'stocktake.read', create: 'stocktake.create', complete: 'stocktake.complete' },
  damageNote: { read: 'damage-note.read', create: 'damage-note.create', complete: 'damage-note.complete' },
  internalUseNote: {
    read: 'internal-use-note.read',
    create: 'internal-use-note.create',
    complete: 'internal-use-note.complete',
  },
  /**
   * Nhập hàng — thao tác cần kèm quyền xem. Cổ đông chi hộ (giao dịch vốn) cần paidBySet. Trả nhà cung cấp từ quầy không
   * cần quyền; paymentManage mới trả không qua quầy, huỷ khoản trả bất kỳ.
   */
  purchase: {
    read: 'purchase.read',
    create: 'purchase.create',
    update: 'purchase.update',
    confirm: 'purchase.confirm',
    receive: 'purchase.receive',
    cancel: 'purchase.cancel',
    paidBySet: 'purchase.paid-by.set',
    paymentManage: 'purchase.payment.manage',
  },
  purchaseReturn: {
    read: 'purchase-return.read',
    create: 'purchase-return.create',
    complete: 'purchase-return.complete',
  },
  /** Nhà cung cấp và nhóm nhà cung cấp. */
  supplier: { read: 'supplier.read', manage: 'supplier.manage' },
  /**
   * Hoá đơn bán — bán theo giá niêm yết, xem hoá đơn mình bán hôm nay không cần quyền. priceOverride: bán khác giá,
   * chọn người bán. Phiên máy quầy xem mọi hoá đơn như trước.
   */
  sales: {
    orderRead: 'sales.order.read',
    orderExport: 'sales.order.export',
    orderUpdate: 'sales.order.update',
    orderCancel: 'sales.order.cancel',
    paymentAdd: 'sales.order.payment.add',
    priceOverride: 'sales.price.override',
  },
  salesReturn: {
    read: 'sales-return.read',
    create: 'sales-return.create',
    complete: 'sales-return.complete',
    cancel: 'sales-return.cancel',
  },
  customer: { read: 'customer.read', manage: 'customer.manage', delete: 'customer.delete' },
  coupon: { read: 'coupon.read', manage: 'coupon.manage' },
  promotionCampaign: { read: 'promotion-campaign.read', manage: 'promotion-campaign.manage' },
  posCart: { read: 'pos-cart.read', manage: 'pos-cart.manage', convert: 'pos-cart.convert' },
  orders: { read: 'orders.read', create: 'orders.create', update: 'orders.update', delete: 'orders.delete' },
  /** Tin tức trên trang công khai của cửa hàng (/store-posts, /dashboard/tin-tuc) — kể cả trợ lý AI viết bài. */
  posts: { manage: 'posts.manage' },
  /**
   * Nhân viên — hồ sơ của mình không cần quyền. Tài khoản Admin chỉ Admin đụng được, gán vai trò / thêm quản lý chỉ Admin
   * (luật theo vai trò).
   */
  user: {
    read: 'user.read',
    create: 'user.create',
    update: 'user.update',
    status: 'user.status',
    passwordReset: 'user.password.reset',
    delete: 'user.delete',
  },
} as const;

type PermissionSource = { role?: unknown; roles?: unknown; permissions?: unknown } | null | undefined;

/** Admin (chủ cửa hàng) có mọi quyền — như API (quyền mặc định của Admin là "*"). */
function isOwner(user: PermissionSource): boolean {
  return getUserRoles(user).includes('Admin');
}

/**
 * Quyền đã biết chưa: chủ cửa hàng luôn biết (mọi quyền); người khác cần GET /users/me xong (token không mang quyền).
 * Chưa biết thì màn hình nên chờ thay vì báo "không có quyền".
 */
export function permissionsKnown(user: PermissionSource): boolean {
  return isOwner(user) || Array.isArray(user?.permissions);
}

export function getUserPermissions(user: PermissionSource): string[] {
  return Array.isArray(user?.permissions) ? (user!.permissions as string[]) : [];
}

export function hasPermission(user: PermissionSource, code: string): boolean {
  return isOwner(user) || getUserPermissions(user).includes(code);
}

/** Có MỘT trong các quyền; không khai báo = không giới hạn. */
export function hasAnyPermission(user: PermissionSource, codes: readonly string[] | null | undefined): boolean {
  if (!codes || codes.length === 0) return true;
  return codes.some((code) => hasPermission(user, code));
}

/** Có ĐỦ các quyền; không khai báo = không giới hạn. */
export function hasAllPermissions(user: PermissionSource, codes: readonly string[] | null | undefined): boolean {
  if (!codes || codes.length === 0) return true;
  return codes.every((code) => hasPermission(user, code));
}
