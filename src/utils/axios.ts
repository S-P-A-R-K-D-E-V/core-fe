import axios, { AxiosRequestConfig } from 'axios';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: HOST_API });

/**
 * Nền tảng của client — Core-be chặn / ẩn tính năng chủ cửa hàng đã tắt trên web (vd tự chấm công, xem
 * src/auth/platform-features.ts).
 */
export const CLIENT_PLATFORM_HEADER = 'X-Client-Platform';
axiosInstance.defaults.headers.common[CLIENT_PLATFORM_HEADER] = 'web';

export const FORBIDDEN_MESSAGE = 'Bạn không có quyền thực hiện thao tác này.';

/**
 * Lỗi mà axiosInstance reject: BODY của response (xem src/utils/api-error.ts), kèm `status` HTTP khi body là object —
 * trước đây mất hẳn mã HTTP nên màn hình không phân biệt được 403 với lỗi khác. 403 body rỗng (API cũ, proxy) thành
 * { status, error: 'forbidden', message } thay vì chuỗi tiếng Anh chung chung.
 */
export function toApiError(error: any): any {
  const status: number | undefined = error?.response?.status;
  const data = error?.response?.data;

  // Chỉ gắn status vào object JSON thường — Blob/ArrayBuffer (tải file) giữ nguyên để nơi gọi tự đọc.
  if (data && Object.prototype.toString.call(data) === '[object Object]') {
    return status && data.status === undefined ? { ...data, status } : data;
  }
  if (data) return data;
  if (status === 403) {
    return { status, error: 'forbidden', title: FORBIDDEN_MESSAGE, message: FORBIDDEN_MESSAGE };
  }
  return 'Something went wrong';
}

axiosInstance.interceptors.response.use(
  (res: any) => res,
  (error: any) => {
    // BE re-kiểm tra status mỗi request (xem ActiveUserJwtEvents ở Core-be) —
    // banned/pending giữa phiên trả 401 dù access token còn hạn. Đăng xuất
    // ngay thay vì để user thấy lỗi API lặp lại tới khi token hết hạn tự nhiên.
    if (
      typeof window !== 'undefined' &&
      error?.response?.status === 401 &&
      sessionStorage.getItem('accessToken') &&
      !window.location.pathname.startsWith('/auth/')
    ) {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      delete axiosInstance.defaults.headers.common.Authorization;
      window.location.href = '/auth/jwt/login';
    }
    return Promise.reject(toApiError(error));
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
  const [url, config] = Array.isArray(args) ? args : [args];

  const res = await axiosInstance.get(url, { ...config });

  return res.data;
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/api/auth/me',
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refreshToken: '/auth/refresh-token',
    verifyOtp: '/auth/verify-otp',
    resendOtp: '/auth/resend-otp',
    restoreSession: '/auth/restore-session',
    oauthLogin: '/auth/oauth-login',
    oauthConnections: '/auth/oauth-connections',
    oauthConnect: '/auth/oauth-connect',
    // Gỡ theo id liên kết (tài khoản cũ có thể còn >1 cùng loại; liên kết mới chỉ 1/loại); tên nhà cung cấp vẫn nhận.
    oauthDisconnect: (idOrProvider: string) => `/auth/oauth-connections/${idOrProvider}`,
    // Xin vé liên kết Google/Apple (đã đăng nhập) rồi mở trang auth /sso/start/?link=1#t=<vé>.
    oauthLinkStart: '/auth/oauth-link/start',
    ssoExchange: '/auth/sso/exchange',
    // Đăng nhập bằng mã QR: trang đăng nhập xin mã, hỏi trạng thái, rồi đổi mã + verifier lấy phiên 12 giờ.
    qrStart: '/auth/qr/start',
    qrStatus: '/auth/qr/status',
    qrExchange: '/auth/qr/exchange',
    // Thiết bị đang đăng nhập: xem các phiên còn mở của mình, đăng xuất từng thiết bị / mọi thiết bị khác từ xa.
    sessions: '/auth/sessions',
    sessionRevoke: (sessionId: string) => `/auth/sessions/${sessionId}`,
    sessionsRevokeOthers: '/auth/sessions/revoke-others',
    ssoHandoff: (tenantCode: string) => `/auth-hub/${tenantCode}/handoff`,
    // Gọi thẳng /api/app-hub trên auth host (ingress → core-api), KHÔNG qua rewrite của Next: giới hạn
    // tần suất app-hub tính theo IP client, đi qua core-fe thì mọi người dùng chung IP của ingress.
    appWebHandoff: '/api/app-hub/web-handoff',
    appHubLink: '/api/app-hub/link',
    // QR trên trang đăng nhập chung (gọi thẳng ingress /api/app-hub — tên miền auth không thuộc cửa hàng nào).
    appHubQrStart: '/api/app-hub/qr/start',
    appHubQrStatus: '/api/app-hub/qr/status',
    appHubQrExchange: '/api/app-hub/qr/exchange',
    deleteAccount: '/auth/account',
  },
  users: {
    list: '/users',
    activeStaff: '/users/active-staff',
    details: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
    changeStatus: (id: string) => `/users/${id}/status`,
    resetPassword: (id: string) => `/users/${id}/reset-password`,
    face: (id: string) => `/users/${id}/face`,
    me: '/users/me',
    updateProfile: '/users/me/profile',
    uploadAvatar: '/users/me/avatar',
    uploadIdCard: (id: string) => `/users/${id}/id-card`,
    uploadMyIdCard: '/users/me/id-card',
    changePassword: '/users/me/change-password',
    schedulingPriority: (id: string) => `/users/${id}/scheduling-priority`,
    branches: (id: string) => `/users/${id}/branches`,
  },
  roles: {
    list: '/roles',
    details: (id: string) => `/roles/${id}`,
    create: '/roles',
    update: (id: string) => `/roles/${id}`,
    delete: (id: string) => `/roles/${id}`,
    assign: '/roles/assign',
  },
  // Bật / tắt tính năng theo nền tảng (web / app) và vai trò — chỉ Admin.
  platformFeatures: {
    list: '/platform-features',
    policy: (featureKey: string, platform: string) =>
      `/platform-features/${encodeURIComponent(featureKey)}/${encodeURIComponent(platform)}`,
    accessLogs: '/platform-features/access-logs',
  },
  customRoles: {
    list: '/custom-roles',
    create: '/custom-roles',
    update: (id: string) => `/custom-roles/${id}`,
    delete: (id: string) => `/custom-roles/${id}`,
    userAssignment: (userId: string) => `/custom-roles/users/${userId}`,
  },
  permissions: {
    list: '/permissions',
    catalog: '/permissions/catalog',
    userPermissions: (userId: string) => `/permissions/user/${userId}`,
    myPermissions: '/permissions/me',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/products',
    details: (id: string) => `/products/${id}`,
    search: '/products',
  },
  shifts: {
    list: '/shifts',
    details: (id: string) => `/shifts/${id}`,
    create: '/shifts',
    update: (id: string) => `/shifts/${id}`,
    delete: (id: string) => `/shifts/${id}`,
  },
  shiftTemplates: {
    list: '/shift-templates',
    details: (id: string) => `/shift-templates/${id}`,
    create: '/shift-templates',
    update: (id: string) => `/shift-templates/${id}`,
    delete: (id: string) => `/shift-templates/${id}`,
  },
  shiftReminderRules: {
    list: '/shift-reminder-rules',
    create: '/shift-reminder-rules',
    update: (id: string) => `/shift-reminder-rules/${id}`,
    deactivate: (id: string) => `/shift-reminder-rules/${id}/deactivate`,
    preview: (id: string) => `/shift-reminder-rules/${id}/preview`,
    sendTest: (id: string) => `/shift-reminder-rules/${id}/send-test`,
  },
  shiftSchedules: {
    list: '/shift-schedules/range',
    details: (id: string) => `/shift-schedules/${id}`,
    create: '/shift-schedules',
    update: (id: string) => `/shift-schedules/${id}`,
    lock: (id: string) => `/shift-schedules/${id}/lock`,
    byTemplate: (templateId: string) => `/shift-schedules/template/${templateId}`,
  },
  shiftAssignments: {
    list: '/shift-assignments/range',
    details: (id: string) => `/shift-assignments/${id}`,
    create: '/shift-assignments',
    bulkAssign: '/shift-assignments/bulk',
    manageShift: '/shift-assignments/manage-shift',
    swap: '/shift-assignments/swap',
    checkins: '/shift-assignments/checkins',
    syncFromCheckin: '/shift-assignments/sync-from-checkin',
    syncWeekFromCheckin: '/shift-assignments/sync-week-from-checkin',
    autoAssignApply: '/shift-assignments/auto-assign-apply',
    history: '/shift-assignments/history',
    undo: (id: string) => `/shift-assignments/history/${id}/undo`,
    delete: (id: string) => `/shift-assignments/${id}`,
    zoneLead: (id: string) => `/shift-assignments/${id}/zone-lead`,
    byStaffAndDate: (staffId: string, date: string) => `/shift-assignments/staff/${staffId}/date/${date}`,
    byStaffAndDateRange: (staffId: string) => `/shift-assignments/staff/${staffId}/range`,
    mySchedule: '/shift-assignments/my-schedule',
  },
  attendance: {
    checkIn: '/attendance/check-in',
    checkInFace: '/attendance/check-in-face',
    locationPing: '/attendance/location-ping',
    checkOut: '/attendance/check-out',
    smartCheckIn: '/attendance/smart-check-in',
    smartCheckOut: '/attendance/smart-check-out',
    smartCheckInFace: '/attendance/smart-check-in-face',
    smartCheckOutFace: '/attendance/smart-check-out-face',
    logs: '/attendance/logs',
    myLogs: '/attendance/my-logs',
    manualAdjustment: '/attendance/manual-adjustment',
    adjustTime: '/attendance/adjust-time',
    autoClose: '/attendance/auto-close',
    requests: '/attendance/requests',
    myRequests: '/attendance/my-requests',
    processRequest: (id: string) => `/attendance/requests/${id}/process`,
    report: '/attendance/report',
    myReport: '/attendance/my-report',
    todayBoard: '/attendance/today-board',
    // Thiết lập chấm công của cửa hàng: { requireFaceVerification }.
    settings: '/attendance/settings',
    // Chấm công trực tiếp theo chi nhánh (camera quầy).
    branchBoard: '/attendance/branch-board',
    branchBoardBranches: '/attendance/branch-board/branches',
  },
  branches: {
    list: '/branches',
  },
  // F&B — thiết lập trên web (hợp đồng API v1, mục 3 và 4).
  fnb: {
    areas: '/fnb/areas',
    area: (id: string) => `/fnb/areas/${id}`,
    tables: '/fnb/tables',
    table: (id: string) => `/fnb/tables/${id}`,
    menu: '/fnb/menu',
    soldOut: '/fnb/menu/sold-out',
    dishToppings: (dishId: string) => `/fnb/menu/dishes/${dishId}/toppings`,
    quickNotes: '/fnb/quick-notes',
    quickNote: (id: string) => `/fnb/quick-notes/${id}`,
    // Bán hàng F&B trên web (hợp đồng API v1, mục 4.3, 5, 6).
    floor: '/fnb/floor',
    order: (id: string) => `/fnb/orders/${id}`,
    orderLines: (id: string) => `/fnb/orders/${id}/lines`,
    orderLine: (id: string, lineId: string) => `/fnb/orders/${id}/lines/${lineId}`,
    orderSend: (id: string) => `/fnb/orders/${id}/send`,
    orderVoid: (id: string) => `/fnb/orders/${id}/void`,
    orderMove: (id: string) => `/fnb/orders/${id}/move`,
    orderDiscount: (id: string) => `/fnb/orders/${id}/discount`,
    orderBill: (id: string) => `/fnb/orders/${id}/bill`,
    orderCheckout: (id: string) => `/fnb/orders/${id}/checkout`,
    orderCancel: (id: string) => `/fnb/orders/${id}/cancel`,
    ticketPrintResult: (id: string) => `/fnb/kitchen-tickets/${id}/print-result`,
    kitchenTickets: '/fnb/kitchen-tickets',
    ticketPrint: (id: string) => `/fnb/kitchen-tickets/${id}/print`,
    // Kho nguyên liệu: định lượng, tồn + số phần món còn pha được, kiểm kê / xuất huỷ.
    recipes: '/fnb/recipes',
    recipe: (productId: string) => `/fnb/recipes/${productId}`,
    stock: '/fnb/stock',
    stockAdjustments: '/fnb/stock/adjustments',
    stockLots: '/fnb/stock/lots',
    stockVariance: '/fnb/stock/variance',
    dishMargin: '/fnb/reports/dish-margin',
    stockForecast: '/fnb/stock/forecast',
    stockForecastAnalyze: '/fnb/stock/forecast/analyze',
    stockForecastOrders: '/fnb/stock/forecast/orders',
    combos: '/fnb/menu/combos',
    combo: (productId: string) => `/fnb/menu/combos/${productId}`,
    batchRecipes: '/fnb/batch-recipes',
    batchRecipe: (productId: string) => `/fnb/batch-recipes/${productId}`,
    batches: '/fnb/batches',
    batch: (id: string) => `/fnb/batches/${id}`,
    batchCancel: (id: string) => `/fnb/batches/${id}/cancel`,
    disposals: '/fnb/disposals',
    disposal: (id: string) => `/fnb/disposals/${id}`,
    disposalReview: (id: string) => `/fnb/disposals/${id}/review`,
    disposalPhotos: '/fnb/disposals/photos',
    stockCounts: '/fnb/stock-counts',
    stockCount: (id: string) => `/fnb/stock-counts/${id}`,
    stockCountEntries: (id: string) => `/fnb/stock-counts/${id}/counts`,
    stockCountReview: (id: string) => `/fnb/stock-counts/${id}/review`,
  },
  salary: {
    list: '/salary-configurations',
    create: '/salary-configurations',
    update: (id: string) => `/salary-configurations/${id}`,
    delete: (id: string) => `/salary-configurations/${id}`,
    mySalary: '/salary/my-salary',
    versionedUpsert: '/salary-configurations/versioned-upsert',
  },
  payroll: {
    calculate: '/payroll/calculate',
    generateBatch: '/payroll/generate-batch',
    byCycle: (cycleId: string) => `/payroll/by-cycle/${cycleId}`,
    recalculateCycle: (cycleId: string) => `/payroll/recalculate-cycle/${cycleId}`,
    finalize: (id: string) => `/payroll/${id}/finalize`,
    myPayroll: '/payroll/my-payroll',
    shiftDetails: (id: string) => `/payroll/${id}/shift-details`,
    penaltyDetails: (id: string) => `/payroll/${id}/penalty-details`,
    allowanceDetails: (id: string) => `/payroll/${id}/allowance-details`,
    waivePenalty: '/payroll/waive-penalty',
    removeWaiver: (waiverId: string) => `/payroll/waive-penalty/${waiverId}`,
    manualPenalties: (payrollRecordId: string) => `/payroll/${payrollRecordId}/manual-penalties`,
    createManualPenalty: '/payroll/manual-penalties',
    voidManualPenalty: (id: string) => `/payroll/manual-penalties/${id}`,
    unscheduledAttendance: (payrollRecordId: string) => `/payroll/${payrollRecordId}/unscheduled-attendance`,
    salaryConfigPreview: '/payroll/salary-config-preview',
    bulkFinalize: '/payroll/bulk-finalize',
    payment: (id: string) => `/payroll/${id}/payment`,
    paymentPrepare: (id: string) => `/payroll/${id}/payment/prepare`,
    markPaid: (id: string) => `/payroll/${id}/mark-paid`,
    recalculateRecord: (id: string) => `/payroll/${id}/recalculate`,
    calendar: (cycleId: string) => `/payroll/calendar?cycleId=${cycleId}`,
    summary: (cycleId: string) => `/payroll/summary?cycleId=${cycleId}`,
  },
  shiftSwap: {
    list: '/shift-swap/pending',
    create: '/shift-swap',
    myRequests: '/shift-swap/my-requests',
    myConfirmationRequests: '/shift-swap/my-confirmation-requests',
    review: (id: string) => `/shift-swap/${id}/review`,
    targetConfirm: (id: string) => `/shift-swap/${id}/target-confirm`,
  },
  lateCover: {
    create: '/late-cover',
    myRequests: '/late-cover/my-requests',
    pending: '/late-cover/pending',
    review: (id: string) => `/late-cover/${id}/review`,
  },
  shiftPool: {
    create: '/shift-pool',
    open: '/shift-pool/open',
    myPosts: '/shift-pool/my-posts',
    myClaims: '/shift-pool/my-claims',
    pending: '/shift-pool/pending',
    claim: (id: string) => `/shift-pool/${id}/claim`,
    cancel: (id: string) => `/shift-pool/${id}/cancel`,
    review: (id: string) => `/shift-pool/${id}/review`,
    directedResolve: (id: string) => `/shift-pool/${id}/directed-resolve`,
    byAssignment: (shiftAssignmentId: string) => `/shift-pool/by-assignment/${shiftAssignmentId}`,
    adminCreateApproved: '/shift-pool/admin-create-approved',
    adminCoverTimes: (id: string) => `/shift-pool/${id}/admin-cover-times`,
  },
  shiftAudit: {
    list: '/shift-audit',
  },
  userPreference: {
    myShiftPreferences: '/users/me/shift-preferences',
    staffShiftPreferences: (userId: string) => `/users/${userId}/shift-preferences`,
    allStaffShiftPreferences: '/users/shift-preferences/all',
  },
  holidayPolicy: {
    list: '/holiday-policies',
    details: (id: string) => `/holiday-policies/${id}`,
    create: '/holiday-policies',
    update: (id: string) => `/holiday-policies/${id}`,
    delete: (id: string) => `/holiday-policies/${id}`,
    statutoryPay: '/holiday-policies/statutory-pay',
  },
  penaltyPolicy: {
    list: '/penalty-policies',
    details: (id: string) => `/penalty-policies/${id}`,
    create: '/penalty-policies',
    update: (id: string) => `/penalty-policies/${id}`,
    delete: (id: string) => `/penalty-policies/${id}`,
    monetarySettings: '/penalty-policies/monetary-settings',
  },
  cleaning: {
    templates: '/cleaning/templates',
    templateDetails: (id: string) => `/cleaning/templates/${id}`,
    checklist: '/cleaning/checklist',
    myChecklist: '/cleaning/my-checklist',
    completeTask: (id: string) => `/cleaning/tasks/${id}/complete`,
    presignPhotos: (id: string) => `/cleaning/tasks/${id}/photos/presign`,
    reviewTask: (id: string) => `/cleaning/tasks/${id}/review`,
    shiftStaff: (id: string) => `/cleaning/tasks/${id}/shift-staff`,
    createPenalty: (id: string) => `/cleaning/tasks/${id}/penalties`,
    voidPenalty: (id: string) => `/cleaning/penalties/${id}/void`,
    weekOverview: '/cleaning/week-overview',
    taskDefinitions: '/cleaning/task-definitions',
    taskDefinitionDetails: (id: string) => `/cleaning/task-definitions/${id}`,
    templateWeek: '/cleaning/templates/week',
    duplicateWeek: '/cleaning/templates/duplicate-week',
  },
  inspections: {
    list: '/inspections',
    details: (id: string) => `/inspections/${id}`,
    templates: '/inspections/templates',
    template: (id: string) => `/inspections/templates/${id}`,
    publishTemplate: (id: string) => `/inspections/templates/${id}/publish`,
    shifts: '/inspections/shifts',
    dashboard: '/inspections/dashboard',
    stats: '/inspections/stats',
    presignPhotos: (id: string) => `/inspections/${id}/photos/presign`,
    results: (id: string) => `/inspections/${id}/results`,
    submit: (id: string) => `/inspections/${id}/submit`,
    faults: '/inspections/faults',
    mine: '/inspections/me',
    fix: (resultId: string) => `/inspections/results/${resultId}/fix`,
  },
  correctiveActions: {
    list: '/corrective-actions',
    details: (id: string) => `/corrective-actions/${id}`,
  },
  mediaLibrary: {
    cleaningPhotos: '/media-library/cleaning-photos',
    deleteCleaningPhoto: (id: string) => `/media-library/cleaning-photos/${id}`,
    chatAttachments: '/media-library/chat-attachments',
    deleteChatAttachment: '/media-library/chat-attachments/delete',
    userAvatars: '/media-library/user-avatars',
    deleteUserAvatar: (userId: string) => `/media-library/user-avatars/${userId}`,
    userIdCards: '/media-library/user-id-cards',
    deleteUserIdCard: (userId: string) => `/media-library/user-id-cards/${userId}`,
  },
  payrollCycle: {
    list: '/payroll-cycles',
    details: (id: string) => `/payroll-cycles/${id}`,
    create: '/payroll-cycles',
    update: (id: string) => `/payroll-cycles/${id}`,
    lock: (id: string) => `/payroll-cycles/${id}/lock`,
    unlock: (id: string) => `/payroll-cycles/${id}/unlock`,
    visibility: (id: string) => `/payroll-cycles/${id}/visibility`,
  },
  salaryHistory: {
    list: '/salary-history',
    byUser: (userId: string) => `/salary-history/user/${userId}`,
    mySalaryHistory: '/salary-history/my-history',
  },
  shiftCash: {
    summary: '/shift-cash/summary',
    transactions: '/shift-cash/transactions',
    transactionDetail: (id: string) => `/shift-cash/transactions/${id}`,
    denominations: '/shift-cash/denominations',
    denominationsBatch: '/shift-cash/denominations/batch',
    finalize: '/shift-cash/finalize',
    open: '/shift-cash/open',
    logs: '/shift-cash/logs',
    auditLogs: '/shift-cash/audit-logs',
    investigation: '/shift-cash/investigation',
    revenue: '/shift-cash/revenue',
    reconciliation: '/shift-cash/reconciliation',
  },
  kiotViet: {
    dailySummary: '/kiotviet/daily-summary',
    invoiceDetail: (id: number) => `/kiotviet/invoices/${id}`,
    bankAccounts: '/kiotviet/bank-accounts',
    exportExcel: '/kiotviet/export-excel',
    sync: '/kiotviet/sync',
    syncInvoices: '/kiotviet/sync/invoices',
    syncPurchaseOrders: '/kiotviet/sync/purchase-orders',
    syncSelected: '/kiotviet/sync/selected',
    syncJobStatus: (jobId: string) => `/kiotviet/sync/jobs/${jobId}`,
    syncJobCancel: (jobId: string) => `/kiotviet/sync/jobs/${jobId}/cancel`,
    syncStepRetry: (jobId: string, key: string) => `/kiotviet/sync/jobs/${jobId}/steps/${encodeURIComponent(key)}/retry`,
    syncRunning: '/kiotviet/sync/running',
    transform: '/kiotviet/transform',
    syncAndTransform: '/kiotviet/sync-and-transform',
    syncJobs: '/kiotviet/sync/jobs',
    pushRetry: (id: string) => `/kiotviet/push/sales-orders/${id}/retry`,
    pushFailed: '/kiotviet/push/failed',
    webhooksRegister: '/kiotviet/webhooks/register',
    webhooks: '/kiotviet/webhooks',
    webhookById: (id: number) => `/kiotviet/webhooks/${id}`,
    webhookLogs: '/kiotviet/webhooks/logs',
    webhookLogDetail: (id: string) => `/kiotviet/webhooks/logs/${id}`,
  },
  adminWorkers: {
    list: '/admin/workers',
    runNow: (name: string) => `/admin/workers/${name}/run-now`,
    enable: (name: string) => `/admin/workers/${name}/enable`,
    disable: (name: string) => `/admin/workers/${name}/disable`,
  },
  // Quy tắc cảnh báo tự động của cửa hàng (chỉ Admin) — mã quy tắc dạng "till.discrepancy"
  automation: {
    rules: '/automation/rules',
    rule: (code: string) => `/automation/rules/${encodeURIComponent(code)}`,
  },
  shiftRegistrations: {
    register: '/shift-registrations/register',
    unregister: '/shift-registrations/unregister',
    bulkRegister: '/shift-registrations/bulk-register',
    list: '/shift-registrations/range',
    myRegistrations: '/shift-registrations/my-registrations',
    lock: '/shift-registrations/lock',
  },
  checkinFace: {
    face: '/checkin/face',
  },
  faceTracking: {
    enrollQuality: '/face-tracking/enroll/quality',
    enrollPresign: '/face-tracking/enroll/presign',
    enrollBatch: '/face-tracking/enroll/batch',
    verifySelf: '/face-tracking/verify-self',
    enrollCameras: '/face-tracking/enroll/cameras',
    enrollmentRequests: '/face-tracking/enrollment-requests',
    approveEnrollment: (id: string) => `/face-tracking/enrollment-requests/${id}/approve`,
    rejectEnrollment: (id: string) => `/face-tracking/enrollment-requests/${id}/reject`,
  },
  notificationConfig: {
    list: '/notification/config',
    create: '/notification/config',
    update: (id: string) => `/notification/config/${id}`,
  },
  notifications: {
    list: '/notifications',
    unreadCount: '/notifications/unread-count',
    markAsRead: (id: string) => `/notifications/${id}/read`,
    markAllAsRead: '/notifications/read-all',
    delete: (id: string) => `/notifications/${id}`,
    sendManual: '/notifications/send-manual',
  },
  userTours: {
    batch: '/user-tours/batch',
    status: (tourKey: string) => `/user-tours/${tourKey}`,
    complete: (tourKey: string) => `/user-tours/${tourKey}/complete`,
    reset: (tourKey: string) => `/user-tours/${tourKey}/reset`,
  },
  // POS / Inventory
  categories: {
    list: '/categories',
    create: '/categories',
    update: (id: string) => `/categories/${id}`,
    delete: (id: string) => `/categories/${id}`,
    floor: (id: string) => `/categories/${id}/floor`,
  },
  // Đơn vị tính — BE là /units (trước trỏ /unit-of-measures không tồn tại).
  unitOfMeasures: {
    list: '/units',
    create: '/units',
    update: (id: string) => `/units/${id}`,
    delete: (id: string) => `/units/${id}`,
  },
  variantAttributes: {
    list: '/variant-attributes',
    create: '/variant-attributes',
    update: (id: string) => `/variant-attributes/${id}`,
    delete: (id: string) => `/variant-attributes/${id}`,
  },
  products: {
    list: '/products',
    details: (id: string) => `/products/${id}`,
    create: '/products',
    update: (id: string) => `/products/${id}`,
    delete: (id: string) => `/products/${id}`,
    // Đơn vị gốc + quy đổi; lịch sử giá nhập (M7 bước 1).
    units: (id: string) => `/products/${id}/units`,
    purchaseHistory: (id: string) => `/products/${id}/purchase-history`,
  },
  warehouses: {
    list: '/warehouses',
    create: '/warehouses',
    update: (id: string) => `/warehouses/${id}`,
    delete: (id: string) => `/warehouses/${id}`,
  },
  inventory: {
    list: '/inventory',
    lowStock: '/inventory/low-stock',
    transactions: '/inventory/transactions',
    adjust: '/inventory/adjust',
  },
  // Purchasing
  suppliers: {
    list: '/suppliers',
    create: '/suppliers',
    update: (id: string) => `/suppliers/${id}`,
    delete: (id: string) => `/suppliers/${id}`,
  },
  expenses: {
    list: '/expenses',
    details: (id: string) => `/expenses/${id}`,
    create: '/expenses',
    update: (id: string) => `/expenses/${id}`,
    delete: (id: string) => `/expenses/${id}`,
    categories: '/expenses/categories',
    createCategory: '/expenses/categories',
    updateCategory: (id: string) => `/expenses/categories/${id}`,
    deleteCategory: (id: string) => `/expenses/categories/${id}`,
    recurringTemplates: '/expenses/recurring-templates',
    createRecurringTemplate: '/expenses/recurring-templates',
    updateRecurringTemplate: (id: string) => `/expenses/recurring-templates/${id}`,
    deactivateRecurringTemplate: (id: string) => `/expenses/recurring-templates/${id}/deactivate`,
  },
  shareholders: {
    list: '/shareholders',
    details: (id: string) => `/shareholders/${id}`,
    create: '/shareholders',
    update: (id: string) => `/shareholders/${id}`,
    delete: (id: string) => `/shareholders/${id}`,
    channels: '/shareholders/channels',
    createChannel: '/shareholders/channels',
    updateChannel: (id: string) => `/shareholders/channels/${id}`,
    deleteChannel: (id: string) => `/shareholders/channels/${id}`,
    knownPaymentMethods: '/shareholders/channels/known-payment-methods',
    transactions: '/shareholders/transactions',
    createTransaction: '/shareholders/transactions',
    updateTransaction: (id: string) => `/shareholders/transactions/${id}`,
    deleteTransaction: (id: string) => `/shareholders/transactions/${id}`,
    statement: (id: string) => `/shareholders/${id}/statement`,
    settlementPreview: '/shareholders/settlements/preview',
    settlements: '/shareholders/settlements',
    settlementDetails: (id: string) => `/shareholders/settlements/${id}`,
    settlementBreakdown: (id: string) => `/shareholders/settlements/${id}/breakdown`,
    settlementPreviewBreakdown: '/shareholders/settlements/breakdown',
    settlementInclusion: '/shareholders/settlements/inclusion',
    markTransferPaid: (transferId: string) =>
      `/shareholders/settlements/transfers/${transferId}/mark-paid`,
  },
  purchaseOrders: {
    list: '/purchase-orders',
    details: (id: string) => `/purchase-orders/${id}`,
    create: '/purchase-orders',
    update: (id: string) => `/purchase-orders/${id}`,
    confirm: (id: string) => `/purchase-orders/${id}/confirm`,
    receive: (id: string) => `/purchase-orders/${id}/receive`,
    cancel: (id: string) => `/purchase-orders/${id}/cancel`,
    paidBy: (id: string) => `/purchase-orders/${id}/paid-by`,
    draft: '/purchase-orders/draft',
  },
  // Nhập phiếu từ ảnh hoá đơn NCC (Core-be PurchaseImportsController).
  purchaseImports: {
    capabilities: '/purchase-imports/capabilities',
    presign: '/purchase-imports/presign',
    list: '/purchase-imports',
    create: '/purchase-imports',
    details: (id: string) => `/purchase-imports/${id}`,
    line: (id: string, lineNo: number) => `/purchase-imports/${id}/lines/${lineNo}`,
    commit: (id: string) => `/purchase-imports/${id}/commit`,
    retry: (id: string) => `/purchase-imports/${id}/retry`,
    cancel: (id: string) => `/purchase-imports/${id}/cancel`,
    conversation: (id: string) => `/purchase-imports/${id}/conversation`,
    assist: (id: string) => `/purchase-imports/${id}/assist`,
    supplierSuggestions: (id: string) => `/purchase-imports/${id}/supplier-suggestions`,
    createProducts: (id: string) => `/purchase-imports/${id}/create-products`,
    kiotVietPush: (id: string) => `/purchase-imports/${id}/kiotviet-push`,
    supplierOverview: (id: string) => `/purchase-imports/${id}/supplier-overview`,
  },
  customers: {
    list: '/customers',
    create: '/customers',
    update: (id: string) => `/customers/${id}`,
    delete: (id: string) => `/customers/${id}`,
  },
  salesOrders: {
    list: '/sales-orders',
    details: (id: string) => `/sales-orders/${id}`,
    create: '/sales-orders',
    update: (id: string) => `/sales-orders/${id}`,
    cancel: (id: string) => `/sales-orders/${id}/cancel`,
    payment: (id: string) => `/sales-orders/${id}/payment`,
    receipt: (id: string) => `/sales-orders/${id}/receipt`,
    exportExcel: '/sales-orders/export-excel',
  },
  bankAccounts: {
    list: '/bank-accounts',
    // Thêm / sửa / tắt: Admin, chỉ dòng cửa hàng tự khai (dòng KiotViet chỉ đọc)
    details: (id: string) => `/bank-accounts/${id}`,
    // Mã VietQR dựng tại chỗ (mọi nhân viên): không amount = QR tĩnh in dán quầy
    vietqr: (id: string) => `/bank-accounts/${id}/vietqr`,
  },
  paymentQr: {
    create: '/payment/qr/create',
    cancel: (id: string) => `/payment/qr/${id}/cancel`,
    status: (id: string) => `/payment/qr/${id}/status`,
    /** Nguồn xác nhận chuyển khoản cho POS (StoreStaff) */
    connections: '/payment/qr/connections',
  },
  // Dịch vụ thanh toán (spark-payment) qua core-be: kết nối SePay/Casso/payOS/VNPay/ngân hàng trực tiếp (Admin), đối
  // soát (Admin, Manager).
  paymentSettings: {
    root: '/payment/settings',
    providers: '/payment/settings/providers',
    connections: '/payment/settings/connections',
    connection: (id: string) => `/payment/settings/connections/${id}`,
    sync: (id: string) => `/payment/settings/connections/${id}/sync`,
    test: (id: string) => `/payment/settings/connections/${id}/test`,
    rotateWebhookSecret: (id: string) => `/payment/settings/connections/${id}/rotate-webhook-secret`,
    // Hạn mức gói ApiPay trong chu kỳ hiện tại (ước tính)
    usage: (id: string) => `/payment/settings/connections/${id}/usage`,
    // Liên kết ngân hàng vào tài khoản ApiPay của kết nối (thay cho my.apipay.vn)
    apipayBanks: (id: string) => `/payment/settings/connections/${id}/apipay/banks`,
    apipayAvailableBanks: (id: string) =>
      `/payment/settings/connections/${id}/apipay/banks/available`,
    apipayConfirmOtp: (id: string) =>
      `/payment/settings/connections/${id}/apipay/banks/confirm-otp`,
    apipayUseBank: (id: string, publicId: string) =>
      `/payment/settings/connections/${id}/apipay/banks/${encodeURIComponent(publicId)}/use`,
    // Tài khoản ngân hàng kèm kết nối đối soát của từng tài khoản (Admin)
    bankAccounts: '/payment/bank-accounts',
    // Đăng ký báo có qua S Payment (số TK + CCCD/MST + SĐT + OTP, khoá ngân hàng ở phía SPARK)
    bankLinks: '/payment/settings/bank-links',
    bankLinkBanks: '/payment/settings/bank-links/banks',
    bankLinkConfirm: (id: string) => `/payment/settings/bank-links/${id}/confirm`,
    bankLinkRevoke: (id: string) => `/payment/settings/bank-links/${id}/revoke`,
    bankLinkCancelRevoke: (id: string) => `/payment/settings/bank-links/${id}/cancel-revoke`,
  },
  paymentReconciliation: {
    summary: '/payment/reconciliation/summary',
    transactions: '/payment/reconciliation/transactions',
    intents: '/payment/reconciliation/intents',
    match: (id: string) => `/payment/reconciliation/transactions/${id}/match`,
    ignore: (id: string) => `/payment/reconciliation/transactions/${id}/ignore`,
  },
  onlineOrders: {
    list: '/online-orders',
    details: (id: string) => `/online-orders/${id}`,
    cancel: (id: string) => `/online-orders/${id}/cancel`,
    pack: (id: string) => `/online-orders/${id}/pack`,
    ship: (id: string) => `/online-orders/${id}/ship`,
    complete: (id: string) => `/online-orders/${id}/complete`,
    cancelShipment: (id: string) => `/online-orders/${id}/shipment/cancel`,
  },
  // Thanh toán → Cài đặt: phương thức theo kênh (POS / Online), chính sách bán online (chủ cửa hàng)
  paymentChannels: {
    channels: '/payment/settings/channels',
    onlineShop: '/payment/settings/online-shop',
    branchPickupAddress: (branchId: string) => `/payment/settings/online-shop/branches/${branchId}/pickup-address`,
  },
  // Kết nối hãng vận chuyển (GHN, GHTK...) — chuyển tiếp tới spark-shipping (chủ cửa hàng)
  shippingSettings: {
    root: '/shipping/settings',
    carriers: '/shipping/settings/carriers',
    connections: '/shipping/settings/connections',
    connection: (id: string) => `/shipping/settings/connections/${id}`,
    test: (id: string) => `/shipping/settings/connections/${id}/test`,
    accounts: (carrier: string) => `/shipping/settings/carriers/${carrier}/accounts`,
    otp: (carrier: string) => `/shipping/settings/carriers/${carrier}/otp`,
    link: (carrier: string) => `/shipping/settings/carriers/${carrier}/link`,
  },
  // Trang bán online công khai (không cần đăng nhập)
  storefront: {
    checkoutConfig: '/public/storefront/checkout-config',
    provinces: '/public/storefront/address/provinces',
    wards: '/public/storefront/address/wards',
    shippingQuote: '/public/storefront/shipping/quote',
    checkout: '/public/storefront/checkout',
    order: (code: string) => `/public/storefront/orders/${encodeURIComponent(code)}`,
    pay: (code: string) => `/public/storefront/orders/${encodeURIComponent(code)}/pay`,
    repayQuote: (code: string) => `/public/storefront/orders/${encodeURIComponent(code)}/repay-quote`,
    cancel: (code: string) => `/public/storefront/orders/${encodeURIComponent(code)}/cancel`,
  },
  reports: {
    dashboard: '/reports/dashboard',
    storeMonitor: '/reports/store-monitor',
    revenue: '/reports/revenue',
    revenueExport: '/reports/revenue/export',
    productSales: '/reports/product-sales',
    productSalesExport: '/reports/product-sales/export',
    customers: '/reports/customers',
    customersExport: '/reports/customers/export',
    inventory: '/reports/inventory',
    inventoryExport: '/reports/inventory/export',
    paymentMethods: '/reports/payment-methods',
    salesOrdersExport: '/reports/sales-orders/export',
    barcodeLookup: (barcode: string) => `/reports/barcode/${barcode}`,
    tax: '/reports/tax',
    taxExport: '/reports/tax/export',
    expenses: '/reports/expenses',
    debtSummary: '/reports/debt-summary',
    breakEven: '/reports/break-even',
  },
  chatbot: {
    startSession: '/chatbot/sessions',
    capabilities: '/chatbot/capabilities',
    messages: (sessionId: string) => `/chatbot/sessions/${sessionId}/messages`,
    attachmentsPresign: (sessionId: string) => `/chatbot/sessions/${sessionId}/attachments/presign`,
    sendMessage: '/chatbot/messages',
    stockContext: '/chatbot/context/stock',
    customerContext: '/chatbot/context/customer',
    callbackOrder: '/chatbot/callback-order',
  },
  customerDisplay: {
    config: '/pos-display/config',
    settings: '/pos-display/settings',
    branchSettings: (branchId: string) => `/pos-display/settings/${branchId}`,
    presign: '/pos-display/media/presign',
  },
  kiosk: {
    confirmCheckIn: '/kiosk/confirm-checkin',
    confirmCheckOut: '/kiosk/confirm-checkout',
    pairingRequest: '/kiosk-pairing/request',
    pairingStatus: (pairingId: string) => `/kiosk-pairing/${pairingId}/status`,
    pairingClaim: '/kiosk-pairing/claim',
    devices: '/kiosk-devices',
    deviceRevoke: (deviceId: string) => `/kiosk-devices/${deviceId}/revoke`,
    device: (deviceId: string) => `/kiosk-devices/${deviceId}`,
  },
  messenger: {
    conversations: '/messenger/conversations',
    openPrivate: '/messenger/conversations/private',
    createGroup: '/messenger/conversations/group',
    members: (conversationId: string) => `/messenger/conversations/${conversationId}/members`,
    member: (conversationId: string, memberId: string) =>
      `/messenger/conversations/${conversationId}/members/${memberId}`,
    messages: (conversationId: string) => `/messenger/conversations/${conversationId}/messages`,
    attachments: (conversationId: string) => `/messenger/conversations/${conversationId}/attachments`,
    markRead: (conversationId: string) => `/messenger/conversations/${conversationId}/read`,
    users: '/messenger/users',
  },
};

