import { useMemo } from 'react';

import { paths } from 'src/routes/paths';

import { useTranslate } from 'src/locales';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import SvgColor from 'src/components/svg-color';

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

/** Lọc nav item theo role của user hiện tại (đệ quy vào children) */
function filterByRole<T extends { roles?: string[]; children?: T[] }>(
  items: T[],
  userRole: string
): T[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(userRole))
    .map((item) => ({
      ...item,
      children: item.children ? filterByRole(item.children, userRole) : undefined,
    }));
}

export function useNavData(userRole?: string) {
  const { t } = useTranslate();

  const data = useMemo(
    () => {
      const fullNav = [
      {
        subheader: t('overview'),
        items: [
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
          },
          {
            title: t('mySchedule'),
            path: paths.dashboard.attendance.mySchedule,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager', 'Staff'],
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
          },
          // MY PAYROLL (Staff, and also available to Admin/Manager)
          {
            title: t('myPayroll'),
            path: paths.dashboard.payroll.myPayroll,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager', 'Staff'],
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

          // SHIFT MANAGEMENT
          {
            title: t('shift'),
            path: paths.dashboard.shift.root,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager'],
            children: [
              {
                title: t('shiftTemplates'),
                path: paths.dashboard.shift.templates.list,
              },
              {
                title: t('shiftSchedules'),
                path: paths.dashboard.shift.schedules.list,
              },
            ],
          },

          // CLEANING SCHEDULE (checklist của tôi: mọi nhân viên - còn lại: Admin/Manager)
          {
            title: t('cleaning'),
            path: paths.dashboard.cleaning.root,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager', 'Staff'],
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

          // ATTENDANCE MANAGEMENT (Admin/Manager)
          {
            title: t('attendance'),
            path: paths.dashboard.attendance.root,
            icon: ICONS.booking,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('assignmentsAttendance'), path: paths.dashboard.attendance.assignments },
              { title: t('logsAttendance'), path: paths.dashboard.attendance.logs },
              { title: t('requestsAttendance'), path: paths.dashboard.attendance.requests },
              { title: t('reportsAttendance'), path: paths.dashboard.attendance.report },
              { title: t('adjustAttendance'), path: paths.dashboard.attendance.adjust },

            ],
          },
          

          // SALARY MANAGEMENT (Admin/Manager)
          {
            title: t('salaryManagement'),
            path: paths.dashboard.salary.root,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('salaryConfiguration'), path: paths.dashboard.salary.configuration },
              { title: t('salaryHistory'), path: paths.dashboard.salary.history },
              { title: t('holidayPolicy'), path: paths.dashboard.holidayPolicy.list },
              { title: t('penaltyPolicy'), path: paths.dashboard.penaltyPolicy.list },
              { title: t('payrollCycle'), path: paths.dashboard.payroll.cycles },
              { title: t('payrollBatch'), path: paths.dashboard.payroll.batch },
            ],
          },
          

          // ĐỔI CA & LÀM HỘ (unified view — tabs: Chợ ca, Bài đăng, Ca nhận, Duyệt)
          {
            title: 'Đổi ca & Làm hộ',
            path: paths.dashboard.shiftPool.root,
            icon: ICONS.job,
            roles: ['Admin', 'Manager', 'Staff'],
          },

          // SHIFT AUDIT LOG (Admin, Manager)
          {
            title: 'Audit Log ca làm',
            path: paths.dashboard.shiftAudit.root,
            icon: ICONS.file,
            roles: ['Admin', 'Manager'],
          },

          // NOTIFICATION CONFIG (Admin only)
          {
            title: 'Cấu hình thông báo',
            path: paths.dashboard.notificationConfig.root,
            icon: ICONS.mail,
            roles: ['Admin'],
          },
          // KIOTVIET SYNC (Admin only)
          {
            title: 'Đồng bộ KiotViet',
            path: paths.dashboard.kiotVietSync.root,
            icon: ICONS.ecommerce,
            roles: ['Admin'],
          },
        ],
      },
      // POS / INVENTORY
      // ----------------------------------------------------------------------
      {
        subheader: 'Quản lý kho & hàng hóa',
        roles: ['Admin'],
        items: [
          {
            title: 'Sản phẩm',
            path: paths.dashboard.pos.product.root,
            icon: ICONS.product,
            roles: ['Admin'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.product.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.product.new },
            ],
          },
          {
            title: 'Danh mục',
            path: paths.dashboard.pos.category.root,
            icon: ICONS.folder,
            roles: ['Admin'],
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
            roles: ['Admin'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.warehouse.list },
            ],
          },
          {
            title: 'Cấu hình',
            path: paths.dashboard.pos.unitOfMeasure.root,
            icon: ICONS.label,
            roles: ['Admin'],
            children: [
              { title: 'Đơn vị tính', path: paths.dashboard.pos.unitOfMeasure.list },
              { title: 'Thuộc tính biến thể', path: paths.dashboard.pos.variantAttribute.list },
            ],
          },
          {
            title: 'Nhà cung cấp',
            path: paths.dashboard.pos.supplier.root,
            icon: ICONS.user,
            roles: ['Admin'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.supplier.list },
              { title: 'Thêm mới', path: paths.dashboard.pos.supplier.new },
            ],
          },
          {
            title: 'Đơn nhập hàng',
            path: paths.dashboard.pos.purchaseOrder.root,
            icon: ICONS.order,
            roles: ['Admin'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.purchaseOrder.list },
              { title: 'Tạo đơn', path: paths.dashboard.pos.purchaseOrder.new },
            ],
          },
          {
            title: 'Khách hàng',
            path: paths.dashboard.pos.customer.root,
            icon: ICONS.user,
            roles: ['Admin'],
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
          },
          {
            title: 'Đơn bán hàng',
            path: paths.dashboard.pos.salesOrder.root,
            icon: ICONS.banking,
            roles: ['Admin'],
            children: [
              { title: 'Danh sách', path: paths.dashboard.pos.salesOrder.list },
              { title: 'Tạo đơn', path: paths.dashboard.pos.salesOrder.new },
            ],
          },
          {
            title: 'Chi phí & Công nợ',
            path: paths.dashboard.pos.expense.root,
            icon: ICONS.invoice,
            roles: ['Admin'],
            children: [
              { title: 'Danh sách chi phí', path: paths.dashboard.pos.expense.list },
              { title: 'Thêm chi phí', path: paths.dashboard.pos.expense.new },
              { title: 'Danh mục chi phí', path: paths.dashboard.pos.expense.categories },
              { title: 'Chi phí định kỳ', path: paths.dashboard.pos.expense.recurringTemplates },
            ],
          },
          {
            title: 'Hoạch toán cổ đông',
            path: paths.dashboard.pos.shareholder.root,
            icon: ICONS.banking,
            roles: ['Admin'],
            children: [
              { title: 'Cổ đông & Kênh thu tiền', path: paths.dashboard.pos.shareholder.list },
              { title: 'Sổ giao dịch vốn', path: paths.dashboard.pos.shareholder.transactions },
              { title: 'Sao kê cổ đông', path: paths.dashboard.pos.shareholder.statement },
              { title: 'Đối chiếu & Chốt sổ', path: paths.dashboard.pos.shareholder.settlement },
              { title: 'Kỳ chốt sổ', path: paths.dashboard.pos.shareholder.settlements },
            ],
          },
          {
            title: 'Báo cáo',
            path: paths.dashboard.pos.report.root,
            icon: ICONS.analytics,
            roles: ['Admin', 'Manager'],
            children: [
              { title: 'Tổng quan', path: paths.dashboard.pos.report.dashboard },
              { title: 'Doanh thu', path: paths.dashboard.pos.report.revenue },
              { title: 'SP bán chạy', path: paths.dashboard.pos.report.productSales },
              { title: 'Khách hàng', path: paths.dashboard.pos.report.customers },
              { title: 'Tồn kho', path: paths.dashboard.pos.report.inventory },
              { title: 'Báo cáo thuế', path: paths.dashboard.pos.report.tax, roles: ['Admin', 'Manager'] },
              { title: 'Chi phí', path: paths.dashboard.pos.report.expense, roles: ['Admin'] },
              { title: 'Công nợ', path: paths.dashboard.pos.report.debt, roles: ['Admin'] },
              { title: 'Điểm hòa vốn', path: paths.dashboard.pos.report.breakEven, roles: ['Admin'] },
            ],
          },
        ],
      },
      // end fullNav
      ];

      // Nếu user chưa load hoặc chưa có role → trả nguyên (SplashScreen đang hiện)
      if (!userRole) return fullNav;

      // Lọc từng group theo role, bỏ group rỗng
      return fullNav
        .map((group) => ({
          ...group,
          items: filterByRole(group.items as any[], userRole),
        }))
        .filter((group) => group.items.length > 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, userRole]
  );

  return data;
}
