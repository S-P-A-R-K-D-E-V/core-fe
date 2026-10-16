import { useMemo } from 'react';

import { paths } from 'src/routes/paths';

import { useCounterSession } from 'src/sections/counter/counter-scope';

import { useTranslate } from 'src/locales';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import SvgColor from 'src/components/svg-color';
import { useStoreBrand } from 'src/components/branding';

import { hasAnyRole, normalizeRoles } from 'src/auth/roles';
import { PERMISSIONS, hasAnyPermission, hasAllPermissions } from 'src/auth/permissions';

import { REPORT_PAGES, REPORT_VIEW_PERMISSIONS } from 'src/sections/pos/report/report-access';

import { BranchType, menuBranchTypes, useWorkingBranch } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`/assets/icons/navbar/${name}.svg`} sx={{ width: 1, height: 1 }} />
  // OR
  // <Iconify icon="fluent:mail-24-filled" />
  // https://icon-sets.iconify.design/solar/
  // https://www.streamlinehq.com/icons
);

const ICONS = {
  job: icon('ic_job'),
  blog: icon('ic_blog'),
  chat: icon('ic_chat'),
  mail: icon('ic_mail'),
  user: icon('ic_user'),
  file: icon('ic_file'),
  lock: icon('ic_lock'),
  tour: icon('ic_tour'),
  order: icon('ic_order'),
  label: icon('ic_label'),
  blank: icon('ic_blank'),
  kanban: icon('ic_kanban'),
  folder: icon('ic_folder'),
  banking: icon('ic_banking'),
  booking: icon('ic_booking'),
  invoice: icon('ic_invoice'),
  product: icon('ic_product'),
  calendar: icon('ic_calendar'),
  disabled: icon('ic_disabled'),
  external: icon('ic_external'),
  menuItem: icon('ic_menu_item'),
  ecommerce: icon('ic_ecommerce'),
  analytics: icon('ic_analytics'),
  dashboard: icon('ic_dashboard'),
};

// ----------------------------------------------------------------------

/** Lọc nav item theo role (người dùng có MỘT trong các vai trò của mục — gộp đủ vai trò, như API), theo feature key đang bật cho tenant hiện tại VÀ theo loại chi nhánh (đệ quy vào children).
 * Item không khai báo featureKey luôn hiện (không phải mọi mục đều gắn với 1 feature có thể tắt). featureKey là mảng =
 * hiện khi bật MỘT TRONG các khoá (vd hàng hoá dùng chung cho bán lẻ và F&B).
 * Item có branchType chỉ hiện khi loại đó nằm trong branchTypes (xem menuBranchTypes: nhân viên = loại của chi nhánh
 * đang làm việc, quản lý = các loại trong chi nhánh được phân công); branchTypes null = không thu hẹp (chủ cửa hàng). */
const PAYROLL = PERMISSIONS.payroll;
const SHIFT = PERMISSIONS.shift;
const ATTENDANCE = PERMISSIONS.attendance;
const PRODUCTS = PERMISSIONS.products;

type NavAccess = { roles: readonly string[]; permissions: readonly string[] | undefined };

function filterNavItems<
  T extends {
    roles?: string[];
    /** Có MỘT trong các quyền (mã Core-be). */
    permissions?: readonly string[];
    /** Có ĐỦ các quyền. */
    allPermissions?: readonly string[];
    featureKey?: string | string[];
    branchType?: BranchType;
    children?: T[];
  },
>(items: T[], access: NavAccess, enabledFeatures: string[], branchTypes: BranchType[] | null): T[] {
  const { roles: userRoles } = access;
  return items
    .filter((item) => hasAnyRole(userRoles, item.roles))
    .filter((item) => hasAnyPermission(access, item.permissions) && hasAllPermissions(access, item.allPermissions))
    .filter((item) => !item.branchType || !branchTypes || branchTypes.includes(item.branchType))
    .filter(
      (item) =>
        !item.featureKey ||
        (Array.isArray(item.featureKey) ? item.featureKey : [item.featureKey]).some((key) =>
          enabledFeatures.includes(key)
        )
    )
    .map((item) => ({
      ...item,
      children: item.children
        ? filterNavItems(item.children, access, enabledFeatures, branchTypes)
        : undefined,
    }));
}

/**
 * `roles`: mọi vai trò của người dùng (getUserRoles) — một chuỗi cũng nhận. Chưa có vai trò → danh sách đầy đủ.
 * `permissions`: quyền hiệu lực (GET /users/me); Admin luôn đủ quyền.
 */
export function useNavData(
  roles?: string | readonly string[],
  enabledFeatures?: string[],
  permissions?: readonly string[]
) {
  const { t } = useTranslate();

  // Khoá chuỗi cho deps: mảng vai trò tạo mới mỗi lần render.
  const rolesKey = normalizeRoles(roles).join('|');
  const userRoles = useMemo(() => (rolesKey ? rolesKey.split('|') : []), [rolesKey]);

  const { isCiCi } = useStoreBrand();

  const branch = useWorkingBranch((s) => s.branch);
  const branchOptions = useWorkingBranch((s) => s.options);
  const branchTypes = useMemo(
    () => menuBranchTypes(userRoles, branch, branchOptions),
    [userRoles, branch, branchOptions]
  );

  const counterSession = useCounterSession();

  const data = useMemo(
    () => {
      // Máy quầy (ai đăng nhập cũng vậy): chỉ bán hàng — không lọc theo vai trò, vẫn lọc theo tính năng cửa hàng và
      // loại chi nhánh. Server chặn cùng phạm vi (CounterScopeMiddleware).
      if (counterSession) {
        const counterNav = [
          {
            subheader: 'Máy quầy',
            items: [
              { title: 'Bán hàng', path: paths.dashboard.pos.sale.root, icon: ICONS.ecommerce, featureKey: 'commerce.retail.pos' },
              {
                title: 'Bán hàng F&B',
                path: paths.dashboard.fnb.pos,
                icon: ICONS.ecommerce,
                featureKey: 'commerce.fnb.pos',
                branchType: 'fnb' as BranchType,
              },
              {
                title: 'Máy in phiếu',
                path: paths.dashboard.fnb.printStation,
                icon: ICONS.invoice,
                featureKey: 'commerce.fnb.pos',
                branchType: 'fnb' as BranchType,
              },
              {
                title: 'Hoá đơn',
                path: paths.dashboard.pos.salesOrder.list,
                icon: ICONS.order,
                featureKey: ['commerce.retail.pos', 'commerce.fnb.pos'],
              },
              {
                title: 'Hàng hoá',
                path: paths.dashboard.pos.product.list,
                icon: ICONS.product,
                featureKey: ['commerce.retail.inventory', 'commerce.fnb.pos'],
              },
              {
                title: 'Khách hàng',
                path: paths.dashboard.pos.customer.list,
                icon: ICONS.user,
                featureKey: ['commerce.retail.pos', 'commerce.fnb.pos'],
              },
              { title: t('shiftCash'), path: paths.dashboard.shiftCash.root, icon: ICONS.banking },
            ],
          },
        ];
        return counterNav
          .map((group) => ({
            ...group,
            items: filterNavItems(group.items as any[], { roles: userRoles, permissions }, enabledFeatures ?? [], branchTypes),
          }))
          .filter((group) => group.items.length > 0);
      }

      const fullNav = [
      {
        subheader: t('overview'),
        items: [
          // Giám sát cửa hàng: lượt khách qua camera, hoá đơn, chuyển đổi, nhân sự hôm nay — chỉ chủ cửa hàng.
          {
            title: 'Giám sát cửa hàng',
            path: paths.dashboard.general.storeMonitor,
            icon: ICONS.analytics,
            roles: ['Admin'],
            featureKey: 'store.camera',
          },
          // SHIFT CASH (Kiểm tiền quầy)
          {
            title: t('shiftCash'),
            path: paths.dashboard.shiftCash.root,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager', 'Staff'],
          },
        ]
      },
      {
        subheader: "Cá nhân",
        items: [
          // MY ATTENDANCE (Staff, and also available to Admin/Manager)
          {
            title: t('checkInOut'),
            path: paths.dashboard.attendance.checkin,
            icon: ICONS.job,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.attendance',
          },
          {
            title: t('mySchedule'),
            path: paths.dashboard.attendance.mySchedule,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.shift-scheduling',
          },
          {
            title: t('faceEnrollment'),
            path: paths.dashboard.attendance.faceEnrollment,
            icon: ICONS.user,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.attendance',
          },
          // Chấm công trực tiếp: camera quầy + ca hôm nay + người camera thấy, theo chi nhánh — chỉ chủ cửa hàng.
          {
            title: 'Chấm công trực tiếp',
            path: paths.dashboard.attendance.live,
            icon: ICONS.dashboard,
            roles: ['Admin'],
            featureKey: 'store.camera',
          },
          // {
          //   title: t('myLogs'),
          //   path: paths.dashboard.attendance.myLogs,
          //   icon: ICONS.booking,
          //   roles: ['Admin', 'Manager', 'Staff'],
          // },
          {
            title: t('shiftRegistration'),
            path: paths.dashboard.attendance.shiftRegistration,
            icon: ICONS.label,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.shift-scheduling',
          },
          // MY PAYROLL (Staff, and also available to Admin/Manager)
          {
            title: t('myPayroll'),
            path: paths.dashboard.payroll.myPayroll,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'payroll.core',
          },
        ]
      },
      
      // MANAGEMENT
      // ----------------------------------------------------------------------
      {
        subheader: t('management'),
        items: [
          // CHATBOT ADMIN (internal)
          {
            title: 'Chatbot nội bộ',
            path: paths.dashboard.chatbotAdmin,
            icon: ICONS.chat,
            roles: ['Admin'],
            featureKey: 'notifications.chatbot',
          },

          // INTERNAL MESSENGER
          {
            title: 'Tin nhắn nội bộ',
            path: paths.dashboard.messenger,
            icon: ICONS.chat,
          },

          // USER
          {
            title: t('user'),
            path: paths.dashboard.user.root,
            icon: ICONS.user,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('list'), path: paths.dashboard.user.list },
            ],
          },

          // THIẾT LẬP F&B (khu vực, bàn, thực đơn, ghi chú nhanh) — chỉ cửa hàng bật commerce.fnb.pos.
          {
            title: 'Thiết lập F&B',
            path: paths.dashboard.fnb.root,
            icon: ICONS.order,
            roles: ['Admin', 'Manager'],
            featureKey: 'commerce.fnb.pos',
            branchType: 'fnb' as BranchType,
          },

          // CÀI ĐẶT CỬA HÀNG (thương hiệu, KiotViet riêng, khoá API cho trợ lý AI)
          {
            title: 'Cài đặt cửa hàng',
            path: paths.dashboard.storeSettings.root,
            icon: ICONS.label,
            roles: ['Admin'],
          },
          // THIẾT BỊ CỬA HÀNG: máy quầy (app / web), kiosk chấm công, camera — ghép bằng mã, đổi tên, thu hồi.
          {
            title: 'Thiết bị cửa hàng',
            path: paths.dashboard.storeSettings.devices,
            icon: ICONS.tour,
            roles: ['Admin', 'Manager'],
          },

          // ROLE MANAGEMENT
          {
            title: t('role'),
            path: paths.dashboard.role.root,
            icon: ICONS.lock,
            roles: ['Admin'],
            children: [
              { title: t('list'), path: paths.dashboard.role.list },
              { title: t('create'), path: paths.dashboard.role.new },
            ],
          },

          // SHIFT MANAGEMENT — theo quyền shift.* (Core-be; mặc định Admin, Manager; nhắc ca chỉ Admin).
          {
            title: t('shift'),
            path: paths.dashboard.shift.root,
            icon: ICONS.calendar,
            permissions: [SHIFT.templateManage, SHIFT.scheduleManage, SHIFT.reminderManage],
            featureKey: 'workforce.shift-scheduling',
            children: [
              {
                title: t('shiftTemplates'),
                path: paths.dashboard.shift.templates.list,
                allPermissions: [SHIFT.templateManage],
              },
              {
                title: t('shiftSchedules'),
                path: paths.dashboard.shift.schedules.list,
                allPermissions: [SHIFT.scheduleManage],
              },
              {
                title: t('shiftReminderRules'),
                path: paths.dashboard.shift.reminderRules.list,
                allPermissions: [SHIFT.reminderManage],
              },
            ],
          },

          // CLEANING SCHEDULE (checklist của tôi: mọi nhân viên - còn lại: Admin/Manager)
          {
            title: t('cleaning'),
            path: paths.dashboard.cleaning.root,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.cleaning',
            children: [
              { title: t('cleaningMyChecklist'), path: paths.dashboard.cleaning.myChecklist },
              { title: t('cleaningTaskLibrary'), path: paths.dashboard.cleaning.taskLibrary, roles: ['Admin', 'Manager'] },
              { title: t('cleaningWeekBuilder'), path: paths.dashboard.cleaning.weekBuilder, roles: ['Admin', 'Manager'] },
              { title: t('cleaningTemplates'), path: paths.dashboard.cleaning.templates, roles: ['Admin', 'Manager'] },
              { title: t('cleaningReview'), path: paths.dashboard.cleaning.review, roles: ['Admin', 'Manager'] },
              { title: t('cleaningWeekOverview'), path: paths.dashboard.cleaning.weekOverview, roles: ['Admin', 'Manager'] },
            ],
          },

          // MEDIA LIBRARY (Admin - xem/xoá media cũ trên R2)
          {
            title: t('mediaLibrary'),
            path: paths.dashboard.mediaLibrary.root,
            icon: ICONS.folder,
            roles: ['Admin'],
          },

          // ATTENDANCE MANAGEMENT — theo quyền attendance.* / shift.assignment.read (mặc định Admin, Manager).
          {
            title: t('attendance'),
            path: paths.dashboard.attendance.root,
            icon: ICONS.booking,
            permissions: [SHIFT.assignmentRead, ATTENDANCE.read, ATTENDANCE.requestProcess, ATTENDANCE.adjust],
            featureKey: 'workforce.attendance',
            children: [
              {
                title: t('assignmentsAttendance'),
                path: paths.dashboard.attendance.assignments,
                allPermissions: [SHIFT.assignmentRead],
              },
              { title: t('logsAttendance'), path: paths.dashboard.attendance.logs, allPermissions: [ATTENDANCE.read] },
              {
                title: t('requestsAttendance'),
                path: paths.dashboard.attendance.requests,
                allPermissions: [ATTENDANCE.requestProcess],
              },
              { title: t('reportsAttendance'), path: paths.dashboard.attendance.report, allPermissions: [ATTENDANCE.read] },
              { title: t('adjustAttendance'), path: paths.dashboard.attendance.adjust, allPermissions: [ATTENDANCE.adjust] },
            ],
          },
          

          // SALARY MANAGEMENT — theo quyền payroll.* (Core-be; mặc định Admin, Manager như trước).
          {
            title: t('salaryManagement'),
            path: paths.dashboard.salary.root,
            icon: ICONS.banking,
            permissions: [PAYROLL.salaryConfigRead, PAYROLL.policyManage, PAYROLL.recordsRead],
            children: [
              {
                title: t('salaryConfiguration'),
                path: paths.dashboard.salary.configuration,
                featureKey: 'payroll.core',
                allPermissions: [PAYROLL.salaryConfigRead],
              },
              {
                title: t('salaryHistory'),
                path: paths.dashboard.salary.history,
                featureKey: 'payroll.core',
                allPermissions: [PAYROLL.salaryConfigRead],
              },
              {
                title: t('holidayPolicy'),
                path: paths.dashboard.holidayPolicy.list,
                featureKey: 'payroll.core',
                allPermissions: [PAYROLL.policyManage],
              },
              {
                title: t('penaltyPolicy'),
                path: paths.dashboard.penaltyPolicy.list,
                featureKey: 'payroll.penalty',
                allPermissions: [PAYROLL.policyManage],
              },
              {
                title: t('payrollCycle'),
                path: paths.dashboard.payroll.cycles,
                featureKey: 'payroll.core',
                allPermissions: [PAYROLL.recordsRead],
              },
              {
                title: t('payrollBatch'),
                path: paths.dashboard.payroll.batch,
                featureKey: 'payroll.core',
                allPermissions: [PAYROLL.recordsRead],
              },
            ],
          },
          

          // ĐỔI CA & LÀM HỘ (unified view — tabs: Chợ ca, Bài đăng, Ca nhận, Duyệt)
          {
            title: 'Đổi ca & Làm hộ',
            path: paths.dashboard.shiftPool.root,
            icon: ICONS.job,
            roles: ['Admin', 'Manager', 'Staff'],
            featureKey: 'workforce.shift-scheduling',
          },

          // SHIFT AUDIT LOG — shift.audit.read (mặc định Admin, Manager)
          {
            title: 'Audit Log ca làm',
            path: paths.dashboard.shiftAudit.root,
            icon: ICONS.file,
            permissions: [SHIFT.auditRead],
            featureKey: 'workforce.shift-scheduling',
          },

          // PHIÊN CHAT AGENT (Admin, Manager) — theo dõi phiên đang hoạt động + nhận trả lời tay
          {
            title: 'Phiên chat AI',
            path: paths.dashboard.agentSessions.root,
            icon: ICONS.chat,
            roles: ['Admin', 'Manager'],
            featureKey: 'notifications.chatbot',
          },

          // NOTIFICATION CONFIG (Admin only)
          {
            title: 'Cấu hình thông báo',
            path: paths.dashboard.notificationConfig.root,
            icon: ICONS.mail,
            roles: ['Admin'],
          },
          // CẢNH BÁO TỰ ĐỘNG (Admin only) — bật/tắt + ngưỡng các cảnh báo hệ thống tự gửi cho Admin
          {
            title: 'Cảnh báo tự động',
            path: paths.dashboard.automation.root,
            icon: <Iconify icon="solar:bell-bold-duotone" sx={{ width: 1, height: 1 }} />,
            roles: ['Admin'],
          },
          // KIOTVIET SYNC (Admin only)
          {
            title: 'Đồng bộ KiotViet',
            path: paths.dashboard.kiotVietSync.root,
            icon: ICONS.ecommerce,
            roles: ['Admin'],
            featureKey: 'commerce.retail.kiotviet-sync',
          },
          // SYSTEM JOBS (chỉ Admin của CiCi) — core-be chỉ mở /admin/workers cho cửa hàng CiCi,
          // cửa hàng khác nhận 404 nên không hiện mục này (kể cả trong ô tìm kiếm / mục yêu thích).
          ...(isCiCi
            ? [
                {
                  title: 'System Jobs',
                  path: paths.dashboard.systemJobs.root,
                  icon: ICONS.job,
                  roles: ['Admin'],
                },
              ]
            : []),
        ],
      },
      // POS / INVENTORY
      // ----------------------------------------------------------------------
      {
        subheader: 'Quản lý kho & hàng hóa',
        items: [
          // Hàng hoá, nhóm hàng, kho, đơn vị tính — theo quyền products.* / inventory.* (Core-be; mặc định Admin, Manager).
          // Danh sách hàng (chỉ xem) mọi nhân viên đã có ở mục "Hàng hoá" phía trên.
          {
            title: 'Sản phẩm',
            path: paths.dashboard.pos.product.root,
            icon: ICONS.product,
            permissions: [PRODUCTS.create, PRODUCTS.update, PRODUCTS.delete],
            // Hàng hoá / nhóm hàng dùng chung bán lẻ và F&B (món là hàng hoá có Loại mặt hàng = Món).
            featureKey: ['commerce.retail.inventory', 'commerce.fnb.pos'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.product.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.product.new, allPermissions: [PRODUCTS.create] },
            ],
          },
          {
            title: 'Danh mục',
            path: paths.dashboard.pos.category.root,
            icon: ICONS.folder,
            permissions: [PRODUCTS.catalogManage],
            // Hàng hoá / nhóm hàng dùng chung bán lẻ và F&B (món là hàng hoá có Loại mặt hàng = Món).
            featureKey: ['commerce.retail.inventory', 'commerce.fnb.pos'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.category.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.category.new },
            ],
          },
          {
            title: 'Tồn kho',
            path: paths.dashboard.pos.inventory.root,
            icon: ICONS.ecommerce,
            roles: ['Admin'],
            featureKey: 'commerce.retail.inventory',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.inventory.list },
              { title: 'Sắp hết hàng', path: paths.dashboard.pos.inventory.lowStock },
              { title: 'Lịch sử nhập xuất', path: paths.dashboard.pos.inventory.transactions },
            ],
          },
          {
            title: 'Kho hàng',
            path: paths.dashboard.pos.warehouse.root,
            icon: ICONS.banking,
            permissions: [PERMISSIONS.inventory.warehouseManage],
            featureKey: 'commerce.retail.inventory',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.warehouse.list },
            ],
          },
          {
            title: 'Cấu hình',
            path: paths.dashboard.pos.unitOfMeasure.root,
            icon: ICONS.label,
            permissions: [PRODUCTS.catalogManage],
            featureKey: 'commerce.retail.inventory',
            children: [
              { title: 'Đơn vị tính', path: paths.dashboard.pos.unitOfMeasure.list },
              // Core-be chưa có /variant-attributes — giữ như cũ (chỉ Admin), không mở thêm.
              { title: 'Thuộc tính biến thể', path: paths.dashboard.pos.variantAttribute.list, roles: ['Admin'] },
            ],
          },
          // Nhà cung cấp, nhập hàng — theo quyền supplier.* / purchase.* (Core-be; mặc định Admin, Manager).
          {
            title: 'Nhà cung cấp',
            path: paths.dashboard.pos.supplier.root,
            icon: ICONS.user,
            permissions: [PERMISSIONS.supplier.read],
            featureKey: 'commerce.retail.inventory',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.supplier.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.supplier.new, allPermissions: [PERMISSIONS.supplier.manage] },
            ],
          },
          {
            title: 'Đơn nhập hàng',
            path: paths.dashboard.pos.purchaseOrder.root,
            icon: ICONS.order,
            permissions: [PERMISSIONS.purchase.read],
            featureKey: 'commerce.retail.inventory',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.purchaseOrder.list },
              { title: 'Tạo đơn', path: paths.dashboard.pos.purchaseOrder.new, allPermissions: [PERMISSIONS.purchase.create] },
            ],
          },
          {
            title: 'Khách hàng',
            path: paths.dashboard.pos.customer.root,
            icon: ICONS.user,
            roles: ['Admin'],
            featureKey: 'commerce.retail.pos',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.customer.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.customer.new },
            ],
          },
          {
            title: 'POS Bán hàng',
            path: paths.dashboard.pos.sale.root,
            icon: ICONS.ecommerce,
            roles: ['Admin'],
            featureKey: 'commerce.retail.pos',
          },
          // BÁN HÀNG F&B (sơ đồ bàn, gọi món, gửi bar, thanh toán) — mọi vai trò, trong phạm vi chi nhánh được phân công.
          {
            title: 'Bán hàng F&B',
            path: paths.dashboard.fnb.pos,
            icon: ICONS.ecommerce,
            featureKey: 'commerce.fnb.pos',
            branchType: 'fnb' as BranchType,
          },
          // MÁY IN PHIẾU F&B (máy tính quầy bar tự in phiếu bar của chi nhánh).
          {
            title: 'Máy in phiếu',
            path: paths.dashboard.fnb.printStation,
            icon: ICONS.invoice,
            featureKey: 'commerce.fnb.pos',
            branchType: 'fnb' as BranchType,
          },
          // KHO NGUYÊN LIỆU F&B: tồn + số phần món còn pha được; hạn dùng theo lô; phiếu xuất huỷ và phiếu kiểm kho (nhân viên
          // lập, quản lý duyệt); báo cáo hao hụt (chủ / quản lý).
          {
            title: 'Kho nguyên liệu',
            path: paths.dashboard.fnb.stock,
            icon: ICONS.product,
            featureKey: 'commerce.fnb.pos',
            branchType: 'fnb' as BranchType,
            children: [
              { title: 'Tồn & món còn pha', path: paths.dashboard.fnb.stock },
              { title: 'Hạn dùng', path: paths.dashboard.fnb.expiry },
              { title: 'Pha mẻ', path: paths.dashboard.fnb.batches },
              { title: 'Xuất huỷ', path: paths.dashboard.fnb.disposals },
              { title: 'Kiểm kho', path: paths.dashboard.fnb.stockCounts },
              { title: 'Hao hụt', path: paths.dashboard.fnb.variance, roles: ['Admin', 'Manager'] },
              { title: 'Lãi gộp theo món', path: paths.dashboard.fnb.margin, roles: ['Admin', 'Manager'] },
              { title: 'Dự báo nhập', path: paths.dashboard.fnb.forecast, roles: ['Admin', 'Manager'] },
            ],
          },
          {
            title: 'Đơn bán hàng',
            path: paths.dashboard.pos.salesOrder.root,
            icon: ICONS.banking,
            roles: ['Admin'],
            featureKey: 'commerce.retail.pos',
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.salesOrder.list },
              { title: 'Tạo đơn', path: paths.dashboard.pos.salesOrder.new },
            ],
          },
          // ĐƠN ONLINE (storefront): chỉ sinh hoá đơn khi khách đã thanh toán.
          {
            title: 'Đơn online',
            path: paths.dashboard.onlineOrders.root,
            icon: ICONS.order,
            roles: ['Admin', 'Manager'],
          },
          // ĐỐI SOÁT THANH TOÁN: giao dịch ngân hàng / cổng ↔ thanh toán, khớp tay, bỏ qua.
          {
            title: 'Đối soát thanh toán',
            path: paths.dashboard.payment.reconciliation,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager'],
          },
          {
            title: 'Chi phí & Công nợ',
            path: paths.dashboard.pos.expense.root,
            icon: ICONS.invoice,
            // Theo quyền expense.* (Core-be /expenses/*): chủ cửa hàng có đủ; vai trò tuỳ chỉnh được cấp từng phần.
            permissions: [PERMISSIONS.expense.read],
            children: [
              { title: 'Danh sách chi phí', path: paths.dashboard.pos.expense.list },
              {
                title: 'Thêm chi phí',
                path: paths.dashboard.pos.expense.new,
                allPermissions: [PERMISSIONS.expense.create],
              },
              { title: 'Danh mục chi phí', path: paths.dashboard.pos.expense.categories },
              { title: 'Chi phí định kỳ', path: paths.dashboard.pos.expense.recurringTemplates },
            ],
          },
          {
            title: 'Hoạch toán cổ đông',
            path: paths.dashboard.pos.shareholder.root,
            icon: ICONS.banking,
            roles: ['Admin'],
            featureKey: 'finance.shareholders',
            children: [
              { title: 'Cổ đông & Kênh thu tiền', path: paths.dashboard.pos.shareholder.list },
              { title: 'Sổ giao dịch vốn', path: paths.dashboard.pos.shareholder.transactions },
              { title: 'Sao kê cổ đông', path: paths.dashboard.pos.shareholder.statement },
              { title: 'Đối chiếu & Chốt sổ', path: paths.dashboard.pos.shareholder.settlement },
              { title: 'Kỳ chốt sổ', path: paths.dashboard.pos.shareholder.settlements },
            ],
          },
          {
            // Báo cáo kinh doanh.
            title: 'Báo cáo',
            path: paths.dashboard.pos.report.root,
            icon: ICONS.analytics,
            // Theo quyền analytics.* (Core-be /reports/*): chủ cửa hàng có đủ; vai trò tuỳ chỉnh được cấp từng báo cáo.
            permissions: REPORT_VIEW_PERMISSIONS,
            children: REPORT_PAGES.map((page) => ({
              title: page.title,
              path: page.path,
              allPermissions: page.permissions,
            })),
          },
        ],
      },
      // end fullNav
      ];

      // Nếu user chưa load hoặc chưa có role → trả nguyên (SplashScreen đang hiện)
      if (userRoles.length === 0) return fullNav;

      // Lọc từng group theo role + feature đang bật cho tenant + loại chi nhánh, bỏ group rỗng.
      // enabledFeatures undefined (chưa fetch xong /users/me) → coi như chưa bật gì, tránh
      // nháy hiện rồi ẩn khi tenant có feature bị tắt.
      return fullNav
        .map((group) => ({
          ...group,
          items: filterNavItems(
            group.items as any[],
            { roles: userRoles, permissions },
            enabledFeatures ?? [],
            branchTypes
          ),
        }))
        .filter((group) => group.items.length > 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, userRoles, enabledFeatures, permissions, isCiCi, branchTypes, counterSession]
  );

  return data;
}
