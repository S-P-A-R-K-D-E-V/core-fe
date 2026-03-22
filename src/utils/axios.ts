import axios, { AxiosRequestConfig } from 'axios';

import { HOST_API } from 'src/config-global';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: HOST_API });

axiosInstance.interceptors.response.use(
  (res: any) => res,
  (error: any) => Promise.reject((error.response && error.response.data) || 'Something went wrong')
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
  },
  users: {
    list: '/users',
    details: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
    changeStatus: (id: string) => `/users/${id}/status`,
    resetPassword: (id: string) => `/users/${id}/reset-password`,
    me: '/users/me',
    updateProfile: '/users/me/profile',
    changePassword: '/users/me/change-password',
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
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
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
  },
  shiftSwap: {
    list: '/shift-swap/pending',
    create: '/shift-swap',
    myRequests: '/shift-swap/my-requests',
    review: (id: string) => `/shift-swap/${id}/review`,
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
  payrollCycle: {
    list: '/payroll-cycles',
    details: (id: string) => `/payroll-cycles/${id}`,
    create: '/payroll-cycles',
    update: (id: string) => `/payroll-cycles/${id}`,
    lock: (id: string) => `/payroll-cycles/${id}/lock`,
    unlock: (id: string) => `/payroll-cycles/${id}/unlock`,
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
  },
  kiotViet: {
    dailySummary: '/kiotviet/daily-summary',
    invoiceDetail: (id: number) => `/kiotviet/invoices/${id}`,
    bankAccounts: '/kiotviet/bank-accounts',
    exportExcel: '/kiotviet/export-excel',
    sync: '/kiotviet/sync',
  },
  shiftRegistrations: {
    register: '/shift-registrations/register',
    unregister: '/shift-registrations/unregister',
    bulkRegister: '/shift-registrations/bulk-register',
    list: '/shift-registrations/range',
    myRegistrations: '/shift-registrations/my-registrations',
  },
  checkinFace: {
    face: '/checkin/face',
  },
  notificationConfig: {
    list: '/notification/config',
    create: '/notification/config',
    update: (id: string) => `/notification/config/${id}`,
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
  purchaseOrders: {
    list: '/purchase-orders',
    details: (id: string) => `/purchase-orders/${id}`,
    create: '/purchase-orders',
    update: (id: string) => `/purchase-orders/${id}`,
    confirm: (id: string) => `/purchase-orders/${id}/confirm`,
    receive: (id: string) => `/purchase-orders/${id}/receive`,
    cancel: (id: string) => `/purchase-orders/${id}/cancel`,
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
    cancel: (id: string) => `/sales-orders/${id}/cancel`,
    payment: (id: string) => `/sales-orders/${id}/payment`,
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
  },
};

