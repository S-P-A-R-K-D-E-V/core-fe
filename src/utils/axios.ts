import axios, { AxiosRequestConfig } from 'axios';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: HOST_API });

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
    return Promise.reject((error.response && error.response.data) || 'Something went wrong');
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
    oauthDisconnect: (provider: string) => `/auth/oauth-connections/${provider}`,
  },
  users: {
    list: '/users',
    activeStaff: '/users/active-staff',
    details: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
    changeStatus: (id: string) => `/users/${id}/status`,
    resetPassword: (id: string) => `/users/${id}/reset-password`,
    me: '/users/me',
    updateProfile: '/users/me/profile',
    uploadAvatar: '/users/me/avatar',
    uploadIdCard: (id: string) => `/users/${id}/id-card`,
    uploadMyIdCard: '/users/me/id-card',
    changePassword: '/users/me/change-password',
    schedulingPriority: (id: string) => `/users/${id}/scheduling-priority`,
  },
  roles: {
    list: '/roles',
    details: (id: string) => `/roles/${id}`,
    create: '/roles',
    update: (id: string) => `/roles/${id}`,
    delete: (id: string) => `/roles/${id}`,
    assign: '/roles/assign',
  },
  permissions: {
    list: '/permissions',
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
    byStaffAndDate: (staffId: string, date: string) => `/shift-assignments/staff/${staffId}/date/${date}`,
    byStaffAndDateRange: (staffId: string) => `/shift-assignments/staff/${staffId}/range`,
    mySchedule: '/shift-assignments/my-schedule',
  },
  attendance: {
    checkIn: '/attendance/check-in',
    checkOut: '/attendance/check-out',
    smartCheckIn: '/attendance/smart-check-in',
    smartCheckOut: '/attendance/smart-check-out',
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
  },
  branches: {
    list: '/branches',
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
    waivePenalty: '/payroll/waive-penalty',
    removeWaiver: (waiverId: string) => `/payroll/waive-penalty/${waiverId}`,
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
  },
  penaltyPolicy: {
    list: '/penalty-policies',
    details: (id: string) => `/penalty-policies/${id}`,
    create: '/penalty-policies',
    update: (id: string) => `/penalty-policies/${id}`,
    delete: (id: string) => `/penalty-policies/${id}`,
  },
  cleaning: {
    templates: '/cleaning/templates',
    templateDetails: (id: string) => `/cleaning/templates/${id}`,
    checklist: '/cleaning/checklist',
    myChecklist: '/cleaning/my-checklist',
    completeTask: (id: string) => `/cleaning/tasks/${id}/complete`,
    reviewTask: (id: string) => `/cleaning/tasks/${id}/review`,
    shiftStaff: (id: string) => `/cleaning/tasks/${id}/shift-staff`,
    createPenalty: (id: string) => `/cleaning/tasks/${id}/penalties`,
    voidPenalty: (id: string) => `/cleaning/penalties/${id}/void`,
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
  },
  unitOfMeasures: {
    list: '/unit-of-measures',
    create: '/unit-of-measures',
    update: (id: string) => `/unit-of-measures/${id}`,
    delete: (id: string) => `/unit-of-measures/${id}`,
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
    exportExcel: '/sales-orders/export-excel',
  },
  bankAccounts: {
    list: '/bank-accounts',
  },
  paymentQr: {
    create: '/payment/qr/create',
    cancel: (id: string) => `/payment/qr/${id}/cancel`,
    status: (id: string) => `/payment/qr/${id}/status`,
  },
  reports: {
    dashboard: '/reports/dashboard',
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
    messages: (sessionId: string) => `/chatbot/sessions/${sessionId}/messages`,
    sendMessage: '/chatbot/messages',
    stockContext: '/chatbot/context/stock',
    customerContext: '/chatbot/context/customer',
    callbackOrder: '/chatbot/callback-order',
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

