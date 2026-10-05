import { it, expect, describe } from 'vitest';

import { paths } from 'src/routes/paths';

import { CHATBOT_WEB_ROUTES, resolveChatbotRoute } from 'src/components/chatbot/chatbot-routes';
import {
  quickActionsFor,
  CHATBOT_QUICK_ACTIONS,
  resolveChatbotAudience,
} from 'src/components/chatbot/chatbot-quick-actions';
import {
  stripUiFence,
  parseHttpUrl,
  suggestionsOf,
  progressLabel,
  summarizeSteps,
  friendlyToolLabel,
  normalizeChatbotBlocks,
} from 'src/components/chatbot/chatbot-blocks';

// ----------------------------------------------------------------------
// Hàm thuần của khung chat: ánh xạ khoá route → trang web, kiểm lại khối của câu trả lời, nhãn tiến
// độ không lộ tên tool, đối tượng theo phiên.
// ----------------------------------------------------------------------

const ALL_FEATURES = [
  'workforce.shift-scheduling',
  'workforce.attendance',
  'payroll.core',
  'commerce.retail.inventory',
  'commerce.retail.pos',
];

const admin = { role: 'Admin', roles: ['Admin'], enabledFeatures: ALL_FEATURES };
const manager = { role: 'Manager', roles: ['Manager'], enabledFeatures: ALL_FEATURES };
const staff = { role: 'Staff', roles: ['Staff'], enabledFeatures: ALL_FEATURES };

describe('resolveChatbotRoute', () => {
  it('ánh xạ khoá của server sang đường dẫn dashboard có thật', () => {
    expect(resolveChatbotRoute('schedule', null, staff)).toBe(
      paths.dashboard.attendance.mySchedule
    );
    expect(resolveChatbotRoute('payroll', undefined, staff)).toBe(
      paths.dashboard.payroll.myPayroll
    );
    expect(resolveChatbotRoute('shift-register', {}, staff)).toBe(
      paths.dashboard.attendance.shiftRegistration
    );
    expect(resolveChatbotRoute('shift-swap', null, staff)).toBe(paths.dashboard.shiftPool.root);
    expect(resolveChatbotRoute('team-schedule', null, manager)).toBe(
      paths.dashboard.attendance.assignments
    );
    expect(resolveChatbotRoute('approvals', null, manager)).toBe(
      paths.dashboard.attendance.requests
    );
    expect(resolveChatbotRoute('revenue-report', null, admin)).toBe(
      paths.dashboard.pos.report.revenue
    );
    expect(resolveChatbotRoute('payroll-cycle', null, admin)).toBe(paths.dashboard.payroll.cycles);
    expect(resolveChatbotRoute('users', null, admin)).toBe(paths.dashboard.user.list);
    expect(resolveChatbotRoute('invoices', null, admin)).toBe(paths.dashboard.pos.salesOrder.list);
  });

  it('đặt tham số vào đường dẫn khi web có trang chi tiết theo id', () => {
    expect(resolveChatbotRoute('invoice-detail', { id: 'abc-123' }, admin)).toBe(
      paths.dashboard.pos.salesOrder.details('abc-123')
    );
    expect(resolveChatbotRoute('product-detail', { id: 'p_1' }, admin)).toBe(
      paths.dashboard.pos.product.edit('p_1')
    );
    expect(resolveChatbotRoute('user-detail', { userId: 'u1' }, admin)).toBe(
      paths.dashboard.user.edit('u1')
    );
    // Web chưa mở thẳng kỳ lương theo id → trang "Bảng lương nhân viên".
    expect(resolveChatbotRoute('payroll-cycle-detail', { cycleId: 'c1' }, admin)).toBe(
      paths.dashboard.payroll.batch
    );
  });

  it('khoá không có trang web hợp lý / khoá lạ → null (không hiện nút)', () => {
    expect(resolveChatbotRoute('notifications', null, admin)).toBeNull();
    expect(resolveChatbotRoute('khong-co', null, admin)).toBeNull();
    expect(resolveChatbotRoute('constructor', null, admin)).toBeNull();
    expect(resolveChatbotRoute(42, null, admin)).toBeNull();
    expect(resolveChatbotRoute('/dashboard/pos/sale', null, admin)).toBeNull();
  });

  it('kiểm vai trò trên web: trang menu ẩn với vai trò đó thì không mở', () => {
    expect(resolveChatbotRoute('revenue-report', null, staff)).toBeNull();
    expect(resolveChatbotRoute('team-schedule', null, staff)).toBeNull();
    expect(resolveChatbotRoute('products', null, staff)).toBeNull(); // web: chỉ Admin
    expect(resolveChatbotRoute('invoices', null, manager)).toBeNull(); // web: chỉ Admin
    expect(resolveChatbotRoute('schedule', null, null)).toBeNull(); // khách
    expect(resolveChatbotRoute('schedule', null, { role: 'User', roles: [] })).toBeNull();
  });

  it('kiểm tính năng của cửa hàng', () => {
    const noPayroll = { ...admin, enabledFeatures: ['workforce.attendance'] };
    expect(resolveChatbotRoute('payroll', null, noPayroll)).toBeNull();
    expect(resolveChatbotRoute('checkin', null, noPayroll)).toBe(
      paths.dashboard.attendance.checkin
    );
    // Trang không gắn tính năng nào thì luôn mở được.
    expect(resolveChatbotRoute('users', null, { role: 'Admin' })).toBe(paths.dashboard.user.list);
    expect(resolveChatbotRoute('payroll', null, { role: 'Admin' })).toBeNull();
  });

  it('tham số thiếu / thừa / sai dạng → null', () => {
    expect(resolveChatbotRoute('invoice-detail', null, admin)).toBeNull();
    expect(resolveChatbotRoute('invoice-detail', {}, admin)).toBeNull();
    expect(resolveChatbotRoute('invoice-detail', { id: '../../etc' }, admin)).toBeNull();
    expect(resolveChatbotRoute('invoice-detail', { id: 'a b' }, admin)).toBeNull();
    expect(resolveChatbotRoute('invoice-detail', { id: 12 }, admin)).toBeNull();
    expect(resolveChatbotRoute('invoice-detail', { id: 'ok', extra: 'x' }, admin)).toBeNull();
    expect(resolveChatbotRoute('schedule', { id: 'x' }, staff)).toBeNull();
    expect(resolveChatbotRoute('schedule', ['x'], staff)).toBeNull();
    expect(resolveChatbotRoute('schedule', 'x', staff)).toBeNull();
  });

  it('mọi đường dẫn trong bảng đều nằm dưới /dashboard', () => {
    Object.entries(CHATBOT_WEB_ROUTES).forEach(([key, def]) => {
      const params = Object.fromEntries((def.params ?? []).map((name) => [name, 'x1']));
      expect(def.path(params), key).toMatch(/^\/dashboard\//);
    });
  });
});

describe('normalizeChatbotBlocks', () => {
  it('không phải mảng → []', () => {
    expect(normalizeChatbotBlocks(null, admin)).toEqual([]);
    expect(normalizeChatbotBlocks({ type: 'link' }, admin)).toEqual([]);
  });

  it('giữ khối hợp lệ, đổi nút mở màn thành đường dẫn web', () => {
    const blocks = normalizeChatbotBlocks(
      [
        {
          type: 'action',
          id: 'a1',
          kind: 'navigate',
          label: 'Mở kỳ lương',
          route: 'payroll-cycle',
        },
        {
          type: 'action',
          id: 'a2',
          kind: 'tool',
          label: 'Chốt kỳ lương',
          prompt: 'Chốt kỳ lương tháng 9',
          confirm: { title: 'Chốt kỳ lương?', message: 'Chốt kỳ lương tháng 9' },
        },
        { type: 'link', url: 'https://kiotviet.vn/huong-dan', title: 'Hướng dẫn' },
        { type: 'image', url: 'https://cdn.kiotviet.vn/a.jpg', alt: 'Kẹp tóc' },
        { type: 'image', objectKey: 'products/a/b.jpg' },
        {
          type: 'suggestions',
          items: [{ label: 'So với tuần trước?', prompt: 'So với tuần trước?' }],
        },
      ],
      admin
    );

    expect(blocks).toEqual([
      {
        type: 'action',
        kind: 'navigate',
        id: 'a1',
        label: 'Mở kỳ lương',
        href: paths.dashboard.payroll.cycles,
      },
      {
        type: 'action',
        kind: 'tool',
        id: 'a2',
        label: 'Chốt kỳ lương',
        prompt: 'Chốt kỳ lương tháng 9',
        confirm: { title: 'Chốt kỳ lương?', message: 'Chốt kỳ lương tháng 9' },
      },
      {
        type: 'link',
        url: 'https://kiotviet.vn/huong-dan',
        title: 'Hướng dẫn',
        host: 'kiotviet.vn',
      },
      { type: 'image', src: 'https://cdn.kiotviet.vn/a.jpg', alt: 'Kẹp tóc' },
      { type: 'image', src: '/media/products/a/b.jpg', alt: undefined },
      {
        type: 'suggestions',
        items: [{ label: 'So với tuần trước?', prompt: 'So với tuần trước?' }],
      },
    ]);
    expect(suggestionsOf(blocks)).toEqual([
      { label: 'So với tuần trước?', prompt: 'So với tuần trước?' },
    ]);
  });

  it('bỏ nút mở màn mà người dùng này không vào được / khoá không có trang web', () => {
    const raw = [
      { type: 'action', kind: 'navigate', label: 'Báo cáo doanh thu', route: 'revenue-report' },
      { type: 'action', kind: 'navigate', label: 'Thông báo', route: 'notifications' },
    ];
    expect(normalizeChatbotBlocks(raw, staff)).toEqual([]);
    expect(normalizeChatbotBlocks(raw, admin)).toHaveLength(1);
  });

  it('bỏ khối không an toàn hoặc sai dạng', () => {
    const blocks = normalizeChatbotBlocks(
      [
        null,
        'chuỗi',
        { type: 'la' },
        { type: 'link', url: 'javascript:alert(1)' },
        { type: 'link', url: 'https://user:pass@evil.example/x' },
        { type: 'image', url: 'http://khong-https.example/a.jpg' },
        { type: 'image', objectKey: 'id-cards/abc.jpg' },
        { type: 'image', objectKey: '../secret.jpg' },
        { type: 'image', url: 'https://a.example/a.jpg', objectKey: 'products/a.jpg' },
        { type: 'action', kind: 'tool', label: 'Thiếu xác nhận', prompt: 'Làm gì đó' },
        {
          type: 'action',
          kind: 'tool',
          label: 'Thiếu câu lệnh',
          confirm: { title: 'x', message: 'y' },
        },
        { type: 'action', kind: 'navigate', label: '', route: 'schedule' },
        { type: 'action', kind: 'la', label: 'Lạ' },
        { type: 'suggestions', items: [] },
        { type: 'suggestions', items: 'x' },
      ],
      admin
    );
    expect(blocks).toEqual([]);
  });

  it('cắt theo giới hạn: 3 nút, 4 gợi ý, bỏ link trùng', () => {
    const tool = (n: number) => ({
      type: 'action',
      kind: 'tool',
      label: `Nút ${n}`,
      prompt: `Lệnh ${n}`,
      confirm: { title: `Nút ${n}?`, message: `Lệnh ${n}` },
    });
    const blocks = normalizeChatbotBlocks(
      [
        tool(1),
        tool(2),
        tool(3),
        tool(4),
        { type: 'link', url: 'https://a.example/x' },
        { type: 'link', url: 'https://a.example/x' },
        {
          type: 'suggestions',
          items: ['1', '2', '2', '3', '4', '5'].map((label) => ({ label, prompt: label })),
        },
        { type: 'suggestions', items: [{ label: 'khối thứ hai', prompt: 'x' }] },
      ],
      admin
    );

    expect(blocks.filter((b) => b.type === 'action')).toHaveLength(3);
    expect(blocks.filter((b) => b.type === 'link')).toHaveLength(1);
    expect(suggestionsOf(blocks).map((s) => s.label)).toEqual(['1', '2', '3', '4']);
    // Nút không có id của server → id tự cấp theo thứ tự.
    expect(blocks.filter((b) => b.type === 'action').map((b) => (b as any).id)).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });
});

describe('parseHttpUrl / stripUiFence', () => {
  it('chỉ nhận URL http(s) tuyệt đối', () => {
    expect(parseHttpUrl('https://Example.com/a?b=1')).toEqual({
      scheme: 'https',
      host: 'example.com',
    });
    expect(parseHttpUrl('http://example.com:8080')).toEqual({
      scheme: 'http',
      host: 'example.com',
    });
    expect(parseHttpUrl('ftp://example.com')).toBeNull();
    expect(parseHttpUrl('/dashboard')).toBeNull();
    expect(parseHttpUrl('https://exa mple.com')).toBeNull();
    expect(parseHttpUrl(undefined)).toBeNull();
  });

  it('cắt khối máy ```spark… kể cả khi chưa đóng', () => {
    expect(stripUiFence('Doanh thu 5 triệu.\n```spark-ui\n{"blocks":[')).toBe('Doanh thu 5 triệu.');
    expect(stripUiFence('Không có khối máy')).toBe('Không có khối máy');
    expect(stripUiFence('Mã:\n```js\nconst a = 1;\n```')).toBe('Mã:\n```js\nconst a = 1;\n```');
  });
});

describe('friendlyToolLabel', () => {
  it('không để lộ tên tool: suy nhãn theo tiền tố', () => {
    expect(friendlyToolLabel('analytics_revenue_read', 'analytics_revenue_read')).toBe(
      'Đang xem báo cáo'
    );
    expect(friendlyToolLabel('attendance_report_read')).toBe('Đang tra cứu chấm công');
    expect(friendlyToolLabel('payroll_cycle_read')).toBe('Đang tra cứu lương');
    expect(friendlyToolLabel('shift_assignments_read')).toBe('Đang tra cứu ca làm');
    expect(friendlyToolLabel('shifts_read')).toBe('Đang tra cứu ca làm');
    expect(friendlyToolLabel('orders_read_list')).toBe('Đang tra cứu đơn hàng');
    expect(friendlyToolLabel('kiotviet_invoices_read_list')).toBe('Đang tra cứu đơn hàng');
    expect(friendlyToolLabel('pos-cart_read_list')).toBe('Đang tra cứu đơn hàng');
    expect(friendlyToolLabel('pos_cart_read_list')).toBe('Đang tra cứu đơn hàng');
    expect(friendlyToolLabel('inventory_search')).toBe('Đang tra cứu hàng hoá');
    expect(friendlyToolLabel('products_read_list')).toBe('Đang tra cứu hàng hoá');
    expect(friendlyToolLabel('stocktake_read_list')).toBe('Đang tra cứu hàng hoá');
    expect(friendlyToolLabel('employees_read_list')).toBe('Đang tra cứu nhân viên');
    expect(friendlyToolLabel('cash_summary_read')).toBe('Đang tra cứu thu chi');
    expect(friendlyToolLabel('cash-voucher_read')).toBe('Đang tra cứu thu chi');
    expect(friendlyToolLabel('expense_read_list')).toBe('Đang tra cứu thu chi');
    expect(friendlyToolLabel('settlement_read_list')).toBe('Đang tra cứu thu chi');
    expect(friendlyToolLabel('load_tools')).toBe('Đang chuẩn bị');
  });

  it('tool tự phục vụ của nhân viên (staff_*) xét phần đứng sau', () => {
    expect(friendlyToolLabel('staff_schedule_read')).toBe('Đang tra cứu ca làm');
    expect(friendlyToolLabel('staff_shift_registration_register')).toBe('Đang tra cứu ca làm');
    expect(friendlyToolLabel('staff_payroll_read')).toBe('Đang tra cứu lương');
    expect(friendlyToolLabel('staff_profile_read')).toBe('Đang tra cứu dữ liệu');
  });

  it('tool lạ / không có tên → nhãn chung', () => {
    expect(friendlyToolLabel('brand_read')).toBe('Đang tra cứu dữ liệu');
    expect(friendlyToolLabel(null, null)).toBe('Đang tra cứu dữ liệu');
    expect(friendlyToolLabel(undefined, 'Calling tool…')).toBe('Đang tra cứu dữ liệu');
  });

  it('chỉ dùng nhãn của server khi rõ ràng là câu chữ cho người đọc', () => {
    expect(friendlyToolLabel('vision', 'Đang xem ảnh')).toBe('Đang xem ảnh');
    expect(friendlyToolLabel('analytics_revenue_read', 'Đang xem Doanh thu…')).toBe(
      'Đang xem Doanh thu'
    );
    // Có dấu tiếng Việt nhưng lẫn tên tool → vẫn không dùng.
    expect(friendlyToolLabel('analytics_revenue_read', 'Đang gọi analytics_revenue_read')).toBe(
      'Đang xem báo cáo'
    );
    expect(friendlyToolLabel('orders_read_list', 'Running orders_read_list')).toBe(
      'Đang tra cứu đơn hàng'
    );
  });

  it('nhãn mặc định của Gateway (tên tool đổi "_" thành dấu cách + hậu tố trạng thái) vẫn là tên thô', () => {
    // Hậu tố "— hoàn tất" có dấu tiếng Việt nhưng phần còn lại chỉ là tên tool.
    expect(friendlyToolLabel('employees_list', 'employees list — hoàn tất')).toBe(
      'Đang tra cứu nhân viên'
    );
    expect(friendlyToolLabel('attendance_report', 'attendance report — hoàn tất')).toBe(
      'Đang tra cứu chấm công'
    );
    expect(friendlyToolLabel('analytics_revenue', 'analytics revenue')).toBe('Đang xem báo cáo');
    expect(friendlyToolLabel('staff_my_schedule', 'staff my schedule — lỗi')).toBe(
      'Đang tra cứu ca làm'
    );
    // Không có tên tool đi kèm: phần lõi không có dấu tiếng Việt → nhãn chung.
    expect(friendlyToolLabel(null, 'some tool — hoàn tất')).toBe('Đang tra cứu dữ liệu');
    expect(
      summarizeSteps([
        {
          id: 's1',
          kind: 'tool',
          name: 'employees_list',
          label: 'employees list — hoàn tất',
          state: 'done',
        },
        {
          id: 's2',
          kind: 'tool',
          name: 'attendance_report',
          label: 'attendance report — hoàn tất',
          state: 'done',
        },
      ])
    ).toBe('Đã tra cứu nhân viên, tra cứu chấm công');
  });
});

describe('progressLabel / summarizeSteps', () => {
  it('ưu tiên bước đang chạy, rồi tới sự kiện status, rồi nhãn mặc định', () => {
    expect(
      progressLabel({
        steps: [
          { id: 's1', name: 'analytics_revenue_read', label: 'x', state: 'done' },
          { id: 's2', name: 'attendance_logs_read', label: 'x', state: 'running' },
        ],
        activity: null,
        hasContent: false,
      })
    ).toBe('Đang tra cứu chấm công…');

    expect(
      progressLabel({
        steps: [],
        activity: { kind: 'tool', name: 'payroll_summary_read', label: 'payroll_summary_read' },
        hasContent: false,
      })
    ).toBe('Đang tra cứu lương…');

    expect(
      progressLabel({
        activity: { kind: 'thinking', name: null, label: 'Thinking' },
        hasContent: false,
      })
    ).toBe('Đang suy nghĩ…');

    expect(
      progressLabel({
        steps: [{ id: 's1', name: 'orders_read_list', state: 'done' }],
        hasContent: false,
      })
    ).toBe('Đang tổng hợp câu trả lời…');

    expect(progressLabel({ hasContent: false })).toBe('Đang trả lời…');
    expect(progressLabel({ hasContent: true })).toBe('Đang trả lời…');
  });

  it('tóm tắt các bước đã làm: gộp trùng, bỏ bước chuẩn bị và bước lỗi', () => {
    expect(
      summarizeSteps([
        { id: 's1', name: 'load_tools', state: 'done' },
        { id: 's2', name: 'analytics_revenue_read', state: 'done' },
        { id: 's3', name: 'analytics_dashboard_read', state: 'done' },
        { id: 's4', name: 'attendance_report_read', state: 'done' },
        { id: 's5', name: 'payroll_cycle_read', state: 'error' },
      ])
    ).toBe('Đã xem báo cáo, tra cứu chấm công');

    expect(summarizeSteps([])).toBeNull();
    expect(summarizeSteps(null)).toBeNull();
    expect(summarizeSteps([{ id: 's1', name: 'load_tools', state: 'done' }])).toBeNull();
  });
});

describe('đối tượng + câu hỏi nhanh', () => {
  it('đối tượng theo tier / agent của phiên, chưa có phiên thì theo vai trò', () => {
    expect(resolveChatbotAudience({ agent: 'InternalAdmin', tier: 'cici_admin' })).toBe('admin');
    expect(resolveChatbotAudience({ agent: 'Staff', tier: 'cici_staff' })).toBe('staff');
    expect(resolveChatbotAudience({ agent: 'CustomerSupport', tier: 'cici_customer' })).toBe(
      'customer'
    );
    // Quản lý cửa hàng SaaS: agent Staff nhưng hỏi số liệu cửa hàng.
    expect(resolveChatbotAudience({ agent: 'Staff', tier: 'store_manager' })).toBe('admin');
    expect(resolveChatbotAudience({ agent: 'InternalAdmin', tier: 'store_admin' })).toBe('admin');
    // Server cũ không trả tier → theo agent; phiên thắng vai trò đăng nhập.
    expect(resolveChatbotAudience({ agent: 'Staff', role: 'Admin' })).toBe('staff');
    expect(resolveChatbotAudience({ agent: 'CustomerSupport', tier: 'none', role: 'Admin' })).toBe(
      'customer'
    );
    // Chưa có phiên.
    expect(resolveChatbotAudience({ role: 'Admin' })).toBe('admin');
    expect(resolveChatbotAudience({ role: 'Manager' })).toBe('staff');
    expect(resolveChatbotAudience({ roles: ['Staff'] })).toBe('staff');
    expect(resolveChatbotAudience({})).toBe('customer');
  });

  it('danh mục câu hỏi nhanh theo đối tượng', () => {
    expect(CHATBOT_QUICK_ACTIONS.admin.map((a) => a.label)).toEqual([
      'Doanh thu hôm nay',
      'Ai đang trong ca',
      'Kiểm quầy',
      'Bán chạy tuần này',
      'Đi trễ tháng này',
      'Kỳ lương',
      'Đăng ký ca tuần tới',
    ]);
    expect(CHATBOT_QUICK_ACTIONS.staff.map((a) => a.label)).toEqual([
      'Lịch làm của tôi',
      'Lương của tôi',
      'Ca còn trống',
      'Đăng ký ca',
      'Đổi ca',
    ]);
    expect(CHATBOT_QUICK_ACTIONS.customer.map((a) => a.label)).toEqual([
      'Sản phẩm nổi bật',
      'Kiểm tra còn hàng',
      'Địa chỉ & giờ mở cửa',
    ]);
    expect(CHATBOT_QUICK_ACTIONS.admin[0].prompt).toBe(
      'Doanh thu hôm nay của cửa hàng là bao nhiêu, so với hôm qua thế nào?'
    );
  });

  it('quản lý cửa hàng SaaS không thấy câu hỏi cần công cụ tiền', () => {
    expect(quickActionsFor('admin', 'cici_admin')).toHaveLength(7);
    expect(quickActionsFor('admin', 'store_manager').map((a) => a.label)).toEqual([
      'Ai đang trong ca',
      'Bán chạy tuần này',
      'Đi trễ tháng này',
      'Đăng ký ca tuần tới',
    ]);
  });
});
