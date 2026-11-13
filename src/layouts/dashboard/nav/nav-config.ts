import { paths } from 'src/routes/paths';

import { PERMISSIONS } from 'src/auth/permissions';
import { PLATFORM_FEATURES } from 'src/auth/platform-features';

import { REPORT_PAGES } from 'src/sections/pos/report/report-access';

import type { NavPage, NavModule } from './nav-types';

// ----------------------------------------------------------------------
// Cây menu quản trị theo nghiệp vụ cửa hàng (kiểu KiotViet): Tổng quan · Đơn hàng · Hàng hoá · Mua hàng · Khách hàng ·
// Nhân viên · Sổ quỹ · Báo cáo · Bán online, cộng ⚙ Cài đặt và Cá nhân. Mỗi trang có đúng MỘT chỗ; riêng trang dùng chung
// "của mình / quản lý người khác" có lối vào ở Cá nhân (mọi người) và ở Nhân viên (theo quyền quản lý).
// Hành động "Thêm / Tạo" không còn là dòng menu — là nút "+" cạnh trang và lệnh trong ô tìm nhanh.
// Quyền ở đây phải khớp ROUTE_ROLE_RULES (src/auth/route-roles.ts) — có test so khớp.
// ----------------------------------------------------------------------

const P = PERMISSIONS;
const PF = PLATFORM_FEATURES;

const RETAIL_POS = 'commerce.retail.pos';
const RETAIL_INVENTORY = 'commerce.retail.inventory';
const FNB_POS = 'commerce.fnb.pos';
const SHIFTS = 'workforce.shift-scheduling';
const ATTENDANCE = 'workforce.attendance';
const PAYROLL_CORE = 'payroll.core';
const CAMERA = 'store.camera';
const CHATBOT = 'notifications.chatbot';
const SOCIAL = 'social.selling';

const ADMIN = ['Admin'] as const;
const MANAGERS = ['Admin', 'Manager'] as const;

const report = (path: string): Pick<NavPage, 'path' | 'allPermissions'> => ({
  path,
  allPermissions: REPORT_PAGES.find((p) => p.path === path)?.permissions ?? [],
});

/** Module nghiệp vụ (thanh ngang). */
export function buildBusinessModules(): NavModule[] {
  return [
    {
      key: 'home',
      title: 'Tổng quan',
      icon: 'solar:home-2-bold-duotone',
      groups: [
        {
          key: 'home.main',
          title: 'Tổng quan',
          pages: [
            {
              key: 'home.business',
              title: 'Kinh doanh',
              ...report(paths.dashboard.pos.report.dashboard),
              platformFeature: PF.reports,
              keywords: 'tong quan doanh thu loi nhuan lai lo dashboard',
            },
            {
              key: 'home.monitor',
              title: 'Giám sát cửa hàng',
              path: paths.dashboard.general.storeMonitor,
              roles: ADMIN,
              featureKey: CAMERA,
              keywords: 'camera luot khach',
            },
            {
              key: 'home.live',
              title: 'Chấm công trực tiếp',
              path: paths.dashboard.attendance.live,
              roles: ADMIN,
              featureKey: CAMERA,
              keywords: 'camera cham cong hom nay',
            },
          ],
        },
      ],
    },
    {
      key: 'sales',
      title: 'Đơn hàng',
      icon: 'solar:bill-list-bold-duotone',
      groups: [
        {
          key: 'sales.counter',
          title: 'Bán tại quầy',
          pages: [
            {
              key: 'sales.pos',
              title: 'Màn bán hàng',
              path: paths.dashboard.pos.sale.root,
              featureKey: RETAIL_POS,
              platformFeature: PF.posSale,
              keywords: 'pos ban hang thu ngan quay',
            },
            {
              key: 'sales.fnb',
              title: 'Bán hàng F&B',
              path: paths.dashboard.fnb.pos,
              featureKey: FNB_POS,
              branchType: 'fnb',
              keywords: 'goi mon ban so do ban',
            },
            {
              key: 'sales.print-station',
              title: 'Máy in phiếu',
              path: paths.dashboard.fnb.printStation,
              featureKey: FNB_POS,
              branchType: 'fnb',
              keywords: 'in phieu bar bep',
            },
          ],
        },
        {
          key: 'sales.docs',
          title: 'Chứng từ',
          pages: [
            {
              key: 'sales.invoices',
              title: 'Hoá đơn',
              path: paths.dashboard.pos.salesOrder.list,
              match: [paths.dashboard.pos.salesOrder.root],
              permissions: [P.sales.orderRead],
              featureKey: RETAIL_POS,
              keywords: 'hoa don don ban',
            },
          ],
        },
        {
          key: 'sales.online',
          title: 'Bán online',
          pages: [
            {
              key: 'sales.online-orders',
              title: 'Đơn online (gói hàng)',
              path: paths.dashboard.payment.onlineOrders,
              keywords: 'don online goi hang giao hang web',
            },
          ],
        },
      ],
    },
    {
      key: 'goods',
      title: 'Hàng hoá',
      icon: 'solar:box-bold-duotone',
      groups: [
        {
          key: 'goods.products',
          title: 'Hàng hoá',
          pages: [
            {
              key: 'goods.products',
              title: 'Danh sách hàng',
              path: paths.dashboard.pos.product.list,
              match: [paths.dashboard.pos.product.root],
              featureKey: [RETAIL_INVENTORY, FNB_POS],
              keywords: 'san pham mat hang hang hoa ma vach',
              actions: [
                {
                  title: 'Thêm hàng hoá',
                  path: paths.dashboard.pos.product.new,
                  permissions: [P.products.create],
                  keywords: 'them san pham tao hang moi',
                },
              ],
            },
          ],
        },
        {
          key: 'goods.stock',
          title: 'Kho',
          featureKey: RETAIL_INVENTORY,
          pages: [
            {
              key: 'goods.inventory',
              title: 'Tồn kho',
              path: paths.dashboard.pos.inventory.list,
              // Trang có giá trị tồn → theo quyền xem giá vốn (trước đây cứng chỉ Admin).
              permissions: [P.products.costRead],
              keywords: 'ton kho so luong',
            },
            {
              key: 'goods.low-stock',
              title: 'Sắp hết hàng',
              path: paths.dashboard.pos.inventory.lowStock,
              permissions: [P.products.costRead],
              keywords: 'het hang canh bao',
            },
            {
              key: 'goods.transactions',
              title: 'Lịch sử nhập xuất',
              path: paths.dashboard.pos.inventory.transactions,
              permissions: [P.products.costRead],
              keywords: 'the kho nhap xuat',
            },
            {
              key: 'goods.shift-checks',
              title: 'Kiểm hàng ca',
              path: paths.dashboard.pos.inventory.shiftChecks,
              featureKey: SHIFTS,
              keywords: 'kiem hang ca dem hang khu vuc',
            },
          ],
        },
        {
          key: 'goods.fnb',
          title: 'Nguyên liệu F&B',
          featureKey: FNB_POS,
          branchType: 'fnb',
          pages: [
            {
              key: 'fnb.stock',
              title: 'Tồn & món còn pha',
              path: paths.dashboard.fnb.stock,
              keywords: 'nguyen lieu ton',
            },
            {
              key: 'fnb.expiry',
              title: 'Hạn dùng',
              path: paths.dashboard.fnb.expiry,
              keywords: 'het han lo',
            },
            { key: 'fnb.batches', title: 'Pha mẻ', path: paths.dashboard.fnb.batches },
            {
              key: 'fnb.disposals',
              title: 'Xuất huỷ nguyên liệu',
              path: paths.dashboard.fnb.disposals,
              keywords: 'xuat huy',
            },
            {
              key: 'fnb.stock-counts',
              title: 'Kiểm kho nguyên liệu',
              path: paths.dashboard.fnb.stockCounts,
              keywords: 'kiem kho',
            },
            {
              key: 'fnb.variance',
              title: 'Hao hụt',
              path: paths.dashboard.fnb.variance,
              roles: MANAGERS,
            },
            {
              key: 'fnb.margin',
              title: 'Lãi gộp theo món',
              path: paths.dashboard.fnb.margin,
              roles: MANAGERS,
            },
            {
              key: 'fnb.forecast',
              title: 'Dự báo nhập',
              path: paths.dashboard.fnb.forecast,
              roles: MANAGERS,
            },
          ],
        },
        {
          key: 'goods.setup',
          title: 'Thiết lập',
          setup: true,
          pages: [
            {
              key: 'goods.categories',
              title: 'Nhóm hàng',
              path: paths.dashboard.pos.category.list,
              match: [paths.dashboard.pos.category.root],
              permissions: [P.products.catalogManage],
              featureKey: [RETAIL_INVENTORY, FNB_POS],
              keywords: 'danh muc nhom hang',
              actions: [{ title: 'Thêm nhóm hàng', path: paths.dashboard.pos.category.new }],
            },
            {
              key: 'goods.units',
              title: 'Đơn vị tính',
              path: paths.dashboard.pos.unitOfMeasure.list,
              match: [paths.dashboard.pos.unitOfMeasure.root],
              permissions: [P.products.catalogManage],
              featureKey: RETAIL_INVENTORY,
              keywords: 'dvt don vi',
            },
            {
              key: 'goods.variant-attributes',
              title: 'Thuộc tính biến thể',
              path: paths.dashboard.pos.variantAttribute.list,
              match: [paths.dashboard.pos.variantAttribute.root],
              // Core-be chưa có /variant-attributes — giữ như cũ (chỉ Admin).
              roles: ADMIN,
              featureKey: RETAIL_INVENTORY,
              keywords: 'mau size bien the',
            },
            {
              key: 'goods.warehouses',
              title: 'Kho hàng',
              path: paths.dashboard.pos.warehouse.list,
              match: [paths.dashboard.pos.warehouse.root],
              permissions: [P.inventory.warehouseManage],
              featureKey: RETAIL_INVENTORY,
              keywords: 'kho chi nhanh',
            },
          ],
        },
      ],
    },
    {
      key: 'purchase',
      title: 'Mua hàng',
      icon: 'solar:delivery-bold-duotone',
      featureKey: RETAIL_INVENTORY,
      groups: [
        {
          key: 'purchase.main',
          title: 'Nhập hàng',
          pages: [
            {
              key: 'purchase.orders',
              title: 'Phiếu nhập hàng',
              path: paths.dashboard.pos.purchaseOrder.list,
              match: [paths.dashboard.pos.purchaseOrder.root],
              permissions: [P.purchase.read],
              keywords: 'nhap hang don nhap phieu nhap',
              actions: [
                {
                  title: 'Tạo phiếu nhập',
                  path: paths.dashboard.pos.purchaseOrder.new,
                  permissions: [P.purchase.create],
                  keywords: 'tao don nhap hang',
                },
                {
                  title: 'Nhập từ ảnh hoá đơn',
                  path: paths.dashboard.pos.purchaseOrder.import,
                  permissions: [P.purchase.create],
                  keywords: 'chup anh hoa don ncc ocr',
                },
              ],
            },
          ],
        },
        {
          key: 'purchase.partners',
          title: 'Đối tác',
          pages: [
            {
              key: 'purchase.suppliers',
              title: 'Nhà cung cấp',
              path: paths.dashboard.pos.supplier.list,
              match: [paths.dashboard.pos.supplier.root],
              permissions: [P.supplier.read],
              keywords: 'ncc nha cung cap',
              actions: [
                {
                  title: 'Thêm nhà cung cấp',
                  path: paths.dashboard.pos.supplier.new,
                  permissions: [P.supplier.manage],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'customer',
      title: 'Khách hàng',
      icon: 'solar:users-group-rounded-bold-duotone',
      groups: [
        {
          key: 'customer.main',
          title: 'Khách hàng',
          pages: [
            {
              key: 'customer.list',
              title: 'Khách hàng',
              path: paths.dashboard.pos.customer.list,
              match: [paths.dashboard.pos.customer.root],
              permissions: [P.customer.read],
              featureKey: RETAIL_POS,
              keywords: 'khach hang',
              actions: [
                {
                  title: 'Thêm khách hàng',
                  path: paths.dashboard.pos.customer.new,
                  permissions: [P.customer.manage],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'staff',
      title: 'Nhân viên',
      icon: 'solar:user-id-bold-duotone',
      groups: [
        {
          key: 'staff.people',
          title: 'Nhân viên',
          pages: [
            {
              key: 'staff.users',
              title: 'Danh sách nhân viên',
              path: paths.dashboard.user.list,
              permissions: [P.user.read],
              keywords: 'nhan vien nguoi dung tai khoan',
              actions: [
                {
                  title: 'Thêm nhân viên',
                  path: paths.dashboard.user.new,
                  permissions: [P.user.create],
                  keywords: 'moi nhan vien tao tai khoan',
                },
              ],
            },
            {
              key: 'staff.roles',
              title: 'Vai trò & quyền',
              path: paths.dashboard.role.list,
              match: [paths.dashboard.role.root],
              roles: ADMIN,
              locked: true,
              keywords: 'phan quyen vai tro menu hien thi',
              actions: [{ title: 'Thêm vai trò', path: paths.dashboard.role.new }],
            },
            {
              key: 'staff.face-approvals',
              title: 'Duyệt khuôn mặt',
              path: paths.dashboard.attendance.faceApprovals,
              permissions: [P.user.update],
              featureKey: ATTENDANCE,
              keywords: 'khuon mat face duyet',
            },
            {
              key: 'staff.contracts',
              title: 'Hợp đồng & hồ sơ',
              path: paths.dashboard.hr.contracts,
              permissions: [P.hr.contractManage],
              featureKey: SHIFTS,
              keywords: 'hop dong lao dong ho so',
            },
          ],
        },
        {
          key: 'staff.shifts',
          title: 'Ca làm',
          featureKey: SHIFTS,
          pages: [
            {
              key: 'shift.schedules',
              title: 'Lịch ca',
              path: paths.dashboard.shift.schedules.list,
              permissions: [P.shift.scheduleManage],
              keywords: 'lich ca xep lich',
            },
            {
              key: 'shift.assignments',
              title: 'Xếp ca / lịch làm mọi người',
              path: paths.dashboard.attendance.assignments,
              permissions: [P.shift.assignmentRead],
              featureKey: ATTENDANCE,
              keywords: 'xep ca phan ca lich lam',
            },
            {
              key: 'shift.pool-review',
              title: 'Duyệt đổi ca & làm hộ',
              path: paths.dashboard.shiftPool.pending,
              permissions: [P.shift.requestReview],
              keywords: 'doi ca lam ho cho ca duyet',
            },
            {
              key: 'shift.leave-review',
              title: 'Duyệt nghỉ ca',
              path: paths.dashboard.hr.leave,
              permissions: [P.shift.leaveReview],
              keywords: 'xin nghi phep duyet',
            },
            {
              key: 'shift.audit',
              title: 'Nhật ký thay đổi ca',
              path: paths.dashboard.shiftAudit.root,
              permissions: [P.shift.auditRead],
              keywords: 'audit log ca lam',
            },
          ],
        },
        {
          key: 'staff.attendance',
          title: 'Chấm công',
          featureKey: ATTENDANCE,
          pages: [
            {
              key: 'att.logs',
              title: 'Nhật ký chấm công',
              path: paths.dashboard.attendance.logs,
              permissions: [P.attendance.read],
              keywords: 'diem danh cham cong log',
            },
            {
              key: 'att.report',
              title: 'Bảng công',
              path: paths.dashboard.attendance.report,
              permissions: [P.attendance.read],
              keywords: 'bao cao diem danh cong thang',
            },
            {
              key: 'att.requests',
              title: 'Yêu cầu sửa chấm công',
              path: paths.dashboard.attendance.requests,
              permissions: [P.attendance.requestProcess],
              keywords: 'sua cham cong yeu cau diem danh',
            },
            {
              key: 'att.adjust',
              title: 'Chấm công hộ / điều chỉnh',
              path: paths.dashboard.attendance.adjust,
              permissions: [P.attendance.adjust],
              keywords: 'cham ho dieu chinh gio',
            },
          ],
        },
        {
          key: 'staff.payroll',
          title: 'Lương',
          platformFeature: PF.payroll,
          featureKey: PAYROLL_CORE,
          pages: [
            {
              key: 'pay.batch',
              title: 'Bảng lương',
              path: paths.dashboard.payroll.batch,
              permissions: [P.payroll.recordsRead],
              keywords: 'bang luong nhan vien tinh luong',
            },
            {
              key: 'pay.cycles',
              title: 'Kỳ lương',
              path: paths.dashboard.payroll.cycles,
              permissions: [P.payroll.recordsRead],
              keywords: 'chu ky tra luong',
            },
            {
              key: 'pay.salary-config',
              title: 'Mức lương',
              path: paths.dashboard.salary.configuration,
              permissions: [P.payroll.salaryConfigRead],
              keywords: 'cau hinh luong co ban phu cap',
            },
            {
              key: 'pay.salary-history',
              title: 'Lịch sử lương',
              path: paths.dashboard.salary.history,
              permissions: [P.payroll.salaryConfigRead],
            },
            {
              key: 'pay.complaints',
              title: 'Khiếu nại phiếu lương',
              path: paths.dashboard.payroll.complaints,
              permissions: [P.payroll.complaintReview],
              keywords: 'khieu nai',
            },
            {
              key: 'pay.bonus-programs',
              title: 'Chương trình thưởng',
              path: paths.dashboard.payroll.bonusPrograms,
              permissions: [P.payroll.bonusProgramManage],
              keywords: 'thuong',
            },
            {
              key: 'pay.quarter-bonus',
              title: 'Thưởng quý',
              path: paths.dashboard.payroll.quarterBonus,
              permissions: [P.payroll.quarterBonusManage],
            },
            {
              key: 'pay.cost-forecast',
              title: 'Chi phí nhân sự dự kiến',
              path: paths.dashboard.payroll.costForecast,
              permissions: [P.payroll.costForecastRead],
              keywords: 'bhxh du kien chi phi luong',
            },
          ],
        },
        {
          key: 'staff.work',
          title: 'Công việc & kiểm tra',
          featureKey: SHIFTS,
          pages: [
            {
              key: 'work.inspection',
              title: 'Kiểm tra ca',
              path: paths.dashboard.inspection.root,
              exact: true,
              permissions: [P.inspection.read],
              keywords: 'kiem tra ca',
            },
            {
              key: 'work.assigned',
              title: 'Giao việc & sửa tận gốc',
              path: paths.dashboard.cleaning.assigned,
              permissions: [
                P.hr.taskManage,
                P.inspection.read,
                P.inspection.correctiveActionManage,
              ],
              keywords: 'giao viec nhiem vu sua loi',
            },
            {
              key: 'work.history',
              title: 'Lịch sử kiểm',
              path: paths.dashboard.inspection.history,
              permissions: [P.inspection.read],
            },
            {
              key: 'work.heatmap',
              title: 'Bản đồ lỗi',
              path: paths.dashboard.inspection.heatmap,
              permissions: [P.inspection.read],
              keywords: 'heatmap loi',
            },
          ],
        },
        {
          key: 'staff.hr',
          title: 'Hiệu suất & kỷ luật',
          featureKey: SHIFTS,
          pages: [
            {
              key: 'hr.ranking',
              title: 'Bảng xếp hạng tháng',
              path: paths.dashboard.hr.overview,
              permissions: [P.hr.performanceRead],
              keywords: 'xep hang diem thang tong quan nhan su',
            },
            {
              key: 'hr.performance',
              title: 'Điểm & xếp loại',
              path: paths.dashboard.hr.performance,
              permissions: [P.hr.performanceRead],
              keywords: 'diem hieu suat xep loai',
            },
            {
              key: 'hr.targets',
              title: 'Target tuần',
              path: paths.dashboard.hr.targets,
              permissions: [P.hr.targetManage],
              keywords: 'muc tieu doanh so',
            },
            {
              key: 'hr.records',
              title: 'Biên bản',
              path: paths.dashboard.hr.records,
              permissions: [P.hr.recordManage],
              keywords: 'bien ban',
            },
            {
              key: 'hr.violations',
              title: 'Vi phạm & điểm trừ',
              path: paths.dashboard.hr.violations,
              permissions: [P.hr.violationManage],
              keywords: 'vi pham ky luat diem tru',
            },
          ],
        },
        {
          key: 'staff.setup',
          title: 'Thiết lập',
          setup: true,
          pages: [
            {
              key: 'shift.templates',
              title: 'Mẫu ca',
              path: paths.dashboard.shift.templates.list,
              permissions: [P.shift.templateManage],
              featureKey: SHIFTS,
              keywords: 'mau ca lam',
            },
            {
              key: 'shift.reminders',
              title: 'Nhắc ca tự động',
              path: paths.dashboard.shift.reminderRules.list,
              permissions: [P.shift.reminderManage],
              featureKey: SHIFTS,
              keywords: 'nhac lich lam',
            },
            {
              key: 'work.items',
              title: 'Hạng mục & lịch kiểm tra',
              path: paths.dashboard.inspection.templates,
              permissions: [P.inspection.templateManage],
              featureKey: SHIFTS,
            },
            {
              key: 'pay.holiday-policy',
              title: 'Chính sách ngày lễ',
              path: paths.dashboard.holidayPolicy.list,
              match: [paths.dashboard.holidayPolicy.root],
              permissions: [P.payroll.policyManage],
              featureKey: PAYROLL_CORE,
              platformFeature: PF.payroll,
              keywords: 'nghi le',
            },
            {
              key: 'pay.penalty-policy',
              title: 'Chính sách phạt',
              path: paths.dashboard.penaltyPolicy.list,
              match: [paths.dashboard.penaltyPolicy.root],
              permissions: [P.payroll.policyManage],
              featureKey: 'payroll.penalty',
              platformFeature: PF.payroll,
              keywords: 'phat di muon',
            },
            {
              key: 'hr.policies-manage',
              title: 'Nội quy & văn bản',
              path: paths.dashboard.hr.policies,
              permissions: [P.hr.policyManage],
              featureKey: SHIFTS,
              keywords: 'noi quy van ban',
            },
            {
              key: 'hr.announcements',
              title: 'Popup thông báo',
              path: paths.dashboard.hr.announcements,
              permissions: [P.hr.announcementManage],
              featureKey: SHIFTS,
              keywords: 'thong bao popup',
            },
            {
              key: 'hr.rules',
              title: 'Luật nhân sự',
              path: paths.dashboard.hr.rules,
              permissions: [P.hr.ruleManage],
              featureKey: SHIFTS,
              keywords: 'cau hinh luat',
            },
          ],
        },
      ],
    },
    {
      key: 'cash',
      title: 'Sổ quỹ',
      icon: 'solar:wallet-money-bold-duotone',
      groups: [
        {
          key: 'cash.counter',
          title: 'Tiền tại quầy',
          pages: [
            {
              key: 'cash.shift',
              title: 'Kiểm quầy',
              path: paths.dashboard.shiftCash.root,
              platformFeature: PF.shiftCash,
              keywords: 'kiem tien ca dem tien chot ca thu chi quay',
            },
            {
              key: 'cash.shift-monthly',
              title: 'Thu chi quầy theo tháng',
              path: paths.dashboard.shiftCash.monthly,
              permissions: [P.shiftCash.oversightRead],
              platformFeature: PF.shiftCash,
              keywords: 'thu chi thang',
            },
          ],
        },
        {
          key: 'cash.funds',
          title: 'Đối soát & chi phí',
          pages: [
            {
              key: 'cash.reconciliation',
              title: 'Đối soát chuyển khoản',
              path: paths.dashboard.payment.reconciliation,
              roles: MANAGERS,
              keywords: 'doi soat chuyen khoan ngan hang thanh toan',
            },
            {
              key: 'cash.expenses',
              title: 'Chi phí',
              path: paths.dashboard.pos.expense.list,
              permissions: [P.expense.read],
              keywords: 'chi phi',
              actions: [
                {
                  title: 'Thêm chi phí',
                  path: paths.dashboard.pos.expense.new,
                  permissions: [P.expense.create],
                },
              ],
            },
          ],
        },
        {
          key: 'cash.shareholders',
          title: 'Cổ đông',
          roles: ADMIN,
          featureKey: 'finance.shareholders',
          pages: [
            {
              key: 'sh.list',
              title: 'Cổ đông & kênh thu tiền',
              path: paths.dashboard.pos.shareholder.list,
              keywords: 'co dong von hach toan',
            },
            {
              key: 'sh.transactions',
              title: 'Sổ giao dịch vốn',
              path: paths.dashboard.pos.shareholder.transactions,
            },
            {
              key: 'sh.statement',
              title: 'Sao kê cổ đông',
              path: paths.dashboard.pos.shareholder.statement,
            },
            {
              key: 'sh.settlement',
              title: 'Đối chiếu & chốt sổ',
              path: paths.dashboard.pos.shareholder.settlement,
            },
            {
              key: 'sh.settlements',
              title: 'Kỳ chốt sổ',
              path: paths.dashboard.pos.shareholder.settlements,
            },
          ],
        },
        {
          key: 'cash.setup',
          title: 'Thiết lập',
          setup: true,
          pages: [
            {
              key: 'cash.expense-categories',
              title: 'Danh mục chi phí',
              path: paths.dashboard.pos.expense.categories,
              permissions: [P.expense.read],
            },
            {
              key: 'cash.recurring-expenses',
              title: 'Chi phí định kỳ',
              path: paths.dashboard.pos.expense.recurringTemplates,
              permissions: [P.expense.read],
            },
          ],
        },
      ],
    },
    {
      key: 'report',
      title: 'Báo cáo',
      icon: 'solar:chart-2-bold-duotone',
      platformFeature: PF.reports,
      groups: [
        {
          key: 'report.sales',
          title: 'Bán hàng',
          pages: [
            {
              key: 'rep.revenue',
              title: 'Doanh thu',
              ...report(paths.dashboard.pos.report.revenue),
              keywords: 'bao cao doanh thu',
            },
            {
              key: 'rep.product-sales',
              title: 'Hàng bán chạy',
              ...report(paths.dashboard.pos.report.productSales),
              keywords: 'san pham ban chay top',
            },
            {
              key: 'rep.customers',
              title: 'Khách hàng',
              ...report(paths.dashboard.pos.report.customers),
            },
          ],
        },
        {
          key: 'report.goods',
          title: 'Hàng hoá',
          pages: [
            {
              key: 'rep.inventory',
              title: 'Tồn kho',
              ...report(paths.dashboard.pos.report.inventory),
            },
          ],
        },
        {
          key: 'report.finance',
          title: 'Tài chính',
          pages: [
            { key: 'rep.expense', title: 'Chi phí', ...report(paths.dashboard.pos.report.expense) },
            {
              key: 'rep.debt',
              title: 'Công nợ',
              ...report(paths.dashboard.pos.report.debt),
              keywords: 'cong no',
            },
            {
              key: 'rep.break-even',
              title: 'Điểm hoà vốn',
              ...report(paths.dashboard.pos.report.breakEven),
              keywords: 'hoa von',
            },
            {
              key: 'rep.tax',
              title: 'Thuế',
              ...report(paths.dashboard.pos.report.tax),
              keywords: 'bao cao thue vat',
            },
          ],
        },
      ],
    },
    {
      key: 'online',
      title: 'Bán online',
      icon: 'solar:global-bold-duotone',
      groups: [
        {
          key: 'online.social',
          title: 'Mạng xã hội',
          featureKey: SOCIAL,
          pages: [
            {
              key: 'online.overview',
              title: 'Tổng quan',
              path: paths.dashboard.social.overview,
              permissions: [P.social.posts],
              keywords: 'threads ban hang online',
            },
            {
              key: 'online.posts',
              title: 'Bài đăng',
              path: paths.dashboard.social.root,
              exact: true,
              match: [paths.dashboard.social.new],
              permissions: [P.social.posts],
              keywords: 'bai dang threads',
              actions: [{ title: 'Soạn bài đăng', path: paths.dashboard.social.new }],
            },
            {
              key: 'online.calendar',
              title: 'Lịch đăng',
              path: paths.dashboard.social.calendar,
              permissions: [P.social.posts],
            },
          ],
        },
        {
          key: 'online.website',
          title: 'Website',
          pages: [
            {
              key: 'online.news',
              title: 'Tin tức website',
              path: paths.dashboard.news.root,
              permissions: [P.posts.manage],
              keywords: 'tin tuc blog bai viet',
              actions: [{ title: 'Viết bài tin tức', path: paths.dashboard.news.new }],
            },
          ],
        },
        {
          key: 'online.setup',
          title: 'Thiết lập',
          setup: true,
          featureKey: SOCIAL,
          pages: [
            {
              key: 'online.channels',
              title: 'Kênh kết nối',
              path: paths.dashboard.social.channels,
              permissions: [P.social.channels],
              keywords: 'ket noi threads',
            },
            {
              key: 'online.settings',
              title: 'Cấu hình bán online',
              path: paths.dashboard.social.settings,
              permissions: [P.social.channels],
            },
          ],
        },
      ],
    },
  ];
}

/** ⚙ Cài đặt — thứ dùng cho cả cửa hàng / hệ thống. Thiết lập của từng nghiệp vụ nằm cuối module đó. */
export function buildSettingsModule(isCiCi: boolean): NavModule {
  return {
    key: 'settings',
    title: 'Cài đặt',
    icon: 'solar:settings-bold-duotone',
    groups: [
      {
        key: 'settings.store',
        title: 'Cửa hàng',
        pages: [
          {
            key: 'set.store',
            title: 'Thông tin cửa hàng',
            path: paths.dashboard.storeSettings.root,
            exact: true,
            roles: ADMIN,
            locked: true,
            keywords: 'cai dat cua hang thuong hieu logo kiotviet man hinh khach',
          },
          {
            key: 'set.payment',
            title: 'Thanh toán & giao hàng',
            path: paths.dashboard.payment.settings,
            match: [paths.dashboard.payment.bankAccounts, paths.dashboard.payment.notifications],
            roles: ADMIN,
            keywords: 'phuong thuc thanh toan tai khoan ngan hang giao hang bao co s payment',
          },
          {
            key: 'set.devices',
            title: 'Thiết bị cửa hàng',
            path: paths.dashboard.storeSettings.devices,
            match: [paths.dashboard.attendance.kioskDevices],
            roles: MANAGERS,
            keywords: 'may quay kiosk camera thiet bi',
          },
          {
            key: 'set.print-templates',
            title: 'Mẫu in',
            path: paths.dashboard.storeSettings.printTemplates,
            permissions: [P.sales.printTemplateManage],
            keywords: 'mau in hoa don tem ma vach',
          },
          {
            key: 'set.fnb',
            title: 'Thiết lập F&B',
            path: paths.dashboard.fnb.root,
            exact: true,
            roles: MANAGERS,
            featureKey: FNB_POS,
            branchType: 'fnb',
            keywords: 'ban khu vuc thuc don ghi chu',
          },
        ],
      },
      {
        key: 'settings.automation',
        title: 'Tự động & thông báo',
        pages: [
          {
            key: 'set.notifications',
            title: 'Cấu hình thông báo',
            path: paths.dashboard.notificationConfig.root,
            roles: ADMIN,
          },
          {
            key: 'set.alerts',
            title: 'Cảnh báo tự động',
            path: paths.dashboard.automation.root,
            roles: ADMIN,
            keywords: 'canh bao nguong',
          },
        ],
      },
      {
        key: 'settings.connections',
        title: 'Kết nối',
        pages: [
          {
            key: 'set.kiotviet',
            title: 'Đồng bộ KiotViet',
            path: paths.dashboard.kiotVietSync.root,
            roles: ADMIN,
            featureKey: 'commerce.retail.kiotviet-sync',
            keywords: 'kiot viet dong bo',
          },
          {
            key: 'set.mcp',
            title: 'Kết nối MCP & khoá API',
            path: `${paths.dashboard.storeSettings.root}?tab=agent-keys`,
            exact: true,
            roles: ADMIN,
            keywords: 'api key mcp tro ly ai',
          },
          {
            key: 'set.platform-features',
            title: 'Tính năng web / app',
            path: `${paths.dashboard.storeSettings.root}?tab=platform-features`,
            exact: true,
            roles: ADMIN,
            keywords: 'tat tinh nang nen tang dien thoai',
          },
        ],
      },
      {
        key: 'settings.ai',
        title: 'Trợ lý AI',
        featureKey: CHATBOT,
        pages: [
          {
            key: 'set.chatbot',
            title: 'Chatbot nội bộ',
            path: paths.dashboard.chatbotAdmin,
            roles: ADMIN,
            keywords: 'ai bot',
          },
          {
            key: 'set.agent-sessions',
            title: 'Phiên chat AI',
            path: paths.dashboard.agentSessions.root,
            roles: MANAGERS,
            keywords: 'ai chat phien',
          },
        ],
      },
      {
        key: 'settings.system',
        title: 'Hệ thống',
        pages: [
          {
            key: 'set.media',
            title: 'Thư viện media',
            path: paths.dashboard.mediaLibrary.root,
            roles: ADMIN,
            keywords: 'anh r2 media',
          },
          // core-be chỉ mở /admin/workers cho cửa hàng CiCi — cửa hàng khác nhận 404 nên không có mục này.
          ...(isCiCi
            ? [
                {
                  key: 'set.system-jobs',
                  title: 'System Jobs',
                  path: paths.dashboard.systemJobs.root,
                  roles: ADMIN,
                  keywords: 'worker job he thong',
                },
              ]
            : []),
        ],
      },
    ],
  };
}

/** Cá nhân — việc của chính mình (mọi nhân viên). */
export function buildMeModule(): NavModule {
  return {
    key: 'me',
    title: 'Cá nhân',
    icon: 'solar:user-circle-bold-duotone',
    groups: [
      {
        key: 'me.daily',
        title: 'Hằng ngày',
        pages: [
          {
            key: 'me.checkin',
            title: 'Chấm công vào / ra',
            path: paths.dashboard.attendance.checkin,
            featureKey: ATTENDANCE,
            platformFeature: PF.selfCheckIn,
            keywords: 'check in diem danh vao ca ra ca',
          },
          {
            key: 'me.schedule',
            title: 'Lịch làm của tôi',
            path: paths.dashboard.attendance.mySchedule,
            featureKey: SHIFTS,
            keywords: 'lich lam ca nhan',
          },
          {
            key: 'me.registration',
            title: 'Đăng ký ca',
            path: paths.dashboard.attendance.shiftRegistration,
            featureKey: SHIFTS,
          },
          {
            key: 'me.shift-pool',
            title: 'Đổi ca & làm hộ',
            path: paths.dashboard.shiftPool.root,
            exact: true,
            match: [
              paths.dashboard.shiftPool.browse,
              paths.dashboard.shiftPool.myPosts,
              paths.dashboard.shiftPool.myClaims,
            ],
            featureKey: SHIFTS,
            keywords: 'doi ca nho lam ho cho ca',
          },
          {
            key: 'me.leave',
            title: 'Xin nghỉ ca',
            path: paths.dashboard.hr.leave,
            featureKey: SHIFTS,
            keywords: 'nghi phep',
          },
          {
            key: 'me.work',
            title: 'Việc của tôi',
            path: paths.dashboard.cleaning.myChecklist,
            featureKey: SHIFTS,
            platformFeature: PF.cleaningTasks,
            keywords: 'checklist ve sinh viec duoc giao',
          },
          {
            // Trưởng ca / nhân viên kiểm ca mình — quản lý dùng "Kiểm tra ca" trong Nhân viên.
            key: 'me.inspection',
            title: 'Kiểm tra ca',
            path: paths.dashboard.inspection.root,
            exact: true,
            featureKey: SHIFTS,
            exceptPermissions: [P.inspection.read],
            keywords: 'truong ca kiem tra',
          },
          {
            key: 'me.messenger',
            title: 'Tin nhắn nội bộ',
            path: paths.dashboard.messenger,
            keywords: 'chat nhan tin',
          },
        ],
      },
      {
        key: 'me.profile',
        title: 'Lương & hồ sơ của tôi',
        pages: [
          {
            key: 'me.payroll',
            title: 'Lương của tôi',
            path: paths.dashboard.payroll.myPayroll,
            featureKey: PAYROLL_CORE,
            platformFeature: PF.payrollSelf,
            keywords: 'phieu luong bang luong ca nhan',
          },
          {
            key: 'me.policies',
            title: 'Nội quy & ký xác nhận',
            path: paths.dashboard.hr.policies,
            featureKey: SHIFTS,
          },
          {
            key: 'me.overview',
            title: 'Điểm tháng của tôi',
            path: paths.dashboard.hr.overview,
            featureKey: SHIFTS,
          },
          {
            key: 'me.performance',
            title: 'Điểm & xếp loại',
            path: paths.dashboard.hr.performance,
            featureKey: SHIFTS,
          },
          {
            key: 'me.targets',
            title: 'Target tuần',
            path: paths.dashboard.hr.targets,
            featureKey: SHIFTS,
          },
          {
            key: 'me.records',
            title: 'Biên bản của tôi',
            path: paths.dashboard.hr.records,
            featureKey: SHIFTS,
          },
          {
            key: 'me.violations',
            title: 'Vi phạm của tôi',
            path: paths.dashboard.hr.violations,
            featureKey: SHIFTS,
          },
          {
            key: 'me.contracts',
            title: 'Hợp đồng của tôi',
            path: paths.dashboard.hr.contracts,
            featureKey: SHIFTS,
          },
        ],
      },
      {
        key: 'me.account',
        title: 'Tài khoản',
        pages: [
          {
            key: 'me.face',
            title: 'Đăng ký khuôn mặt',
            path: paths.dashboard.attendance.faceEnrollment,
            featureKey: ATTENDANCE,
            keywords: 'face khuon mat',
          },
          {
            key: 'me.account',
            title: 'Tài khoản',
            path: paths.dashboard.user.account,
            match: [paths.dashboard.user.profile],
            keywords: 'doi mat khau ho so ca nhan',
          },
          {
            key: 'me.guide',
            title: 'Hướng dẫn sử dụng app',
            path: paths.dashboard.hr.guide,
            keywords: 'tro giup help',
          },
        ],
      },
    ],
  };
}

/** Máy quầy (ai đăng nhập cũng vậy): chỉ bán hàng — server chặn cùng phạm vi (CounterScopeMiddleware). */
export function buildCounterModule(): NavModule {
  return {
    key: 'counter',
    title: 'Máy quầy',
    icon: 'solar:shop-bold-duotone',
    flat: true,
    groups: [
      {
        key: 'counter.main',
        title: 'Máy quầy',
        pages: [
          {
            key: 'sales.pos',
            title: 'Bán hàng',
            path: paths.dashboard.pos.sale.root,
            featureKey: RETAIL_POS,
            platformFeature: PF.posSale,
          },
          {
            key: 'sales.fnb',
            title: 'Bán hàng F&B',
            path: paths.dashboard.fnb.pos,
            featureKey: FNB_POS,
            branchType: 'fnb',
          },
          {
            key: 'sales.print-station',
            title: 'Máy in phiếu',
            path: paths.dashboard.fnb.printStation,
            featureKey: FNB_POS,
            branchType: 'fnb',
          },
          {
            key: 'sales.invoices',
            title: 'Hoá đơn',
            path: paths.dashboard.pos.salesOrder.list,
            match: [paths.dashboard.pos.salesOrder.root],
            featureKey: [RETAIL_POS, FNB_POS],
          },
          {
            key: 'goods.products',
            title: 'Hàng hoá',
            path: paths.dashboard.pos.product.list,
            match: [paths.dashboard.pos.product.root],
            featureKey: [RETAIL_INVENTORY, FNB_POS],
          },
          {
            key: 'customer.list',
            title: 'Khách hàng',
            path: paths.dashboard.pos.customer.list,
            match: [paths.dashboard.pos.customer.root],
            featureKey: [RETAIL_POS, FNB_POS],
          },
          {
            key: 'cash.shift',
            title: 'Kiểm tiền ca',
            path: paths.dashboard.shiftCash.root,
            platformFeature: PF.shiftCash,
          },
        ],
      },
    ],
  };
}
