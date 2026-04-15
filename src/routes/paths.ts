import { paramCase } from 'src/utils/change-case';

import { _id, _postTitles } from 'src/_mock/assets';

// ----------------------------------------------------------------------

const MOCK_ID = _id[1];

const MOCK_TITLE = _postTitles[2];

const ROOTS = {
  AUTH: '/auth',
  AUTH_DEMO: '/auth-demo',
  DASHBOARD: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  comingSoon: '/coming-soon',
  maintenance: '/maintenance',
  pricing: '/pricing',
  payment: '/payment',
  about: '/about-us',
  contact: '/contact-us',
  faqs: '/faqs',
  page403: '/error/403',
  page404: '/error/404',
  page500: '/error/500',
  components: '/components',
  docs: 'https://docs.minimals.cc',
  changelog: 'https://docs.minimals.cc/changelog',
  zoneUI: 'https://mui.com/store/items/zone-landing-page/',
  minimalUI: 'https://mui.com/store/items/minimal-dashboard/',
  freeUI: 'https://mui.com/store/items/minimal-dashboard-free/',
  figma:
    'https://www.figma.com/file/hjxMnGUJCjY7pX8lQbS7kn/%5BPreview%5D-Minimal-Web.v5.4.0?type=design&node-id=0-1&mode=design&t=2fxnS70DuiTLGzND-0',
  product: {
    root: `/product`,
    checkout: `/product/checkout`,
    details: (id: string) => `/product/${id}`,
    demo: {
      details: `/product/${MOCK_ID}`,
    },
  },
  post: {
    root: `/post`,
    details: (title: string) => `/post/${paramCase(title)}`,
    demo: {
      details: `/post/${paramCase(MOCK_TITLE)}`,
    },
  },
  // AUTH
  auth: {
    amplify: {
      login: `${ROOTS.AUTH}/amplify/login`,
      verify: `${ROOTS.AUTH}/amplify/verify`,
      register: `${ROOTS.AUTH}/amplify/register`,
      newPassword: `${ROOTS.AUTH}/amplify/new-password`,
      forgotPassword: `${ROOTS.AUTH}/amplify/forgot-password`,
    },
    jwt: {
      login: `${ROOTS.AUTH}/jwt/login`,
      register: `${ROOTS.AUTH}/jwt/register`,
      verifyOtp: `${ROOTS.AUTH}/jwt/verify-otp`,
    },
    firebase: {
      login: `${ROOTS.AUTH}/firebase/login`,
      verify: `${ROOTS.AUTH}/firebase/verify`,
      register: `${ROOTS.AUTH}/firebase/register`,
      forgotPassword: `${ROOTS.AUTH}/firebase/forgot-password`,
    },
    auth0: {
      login: `${ROOTS.AUTH}/auth0/login`,
    },
    supabase: {
      login: `${ROOTS.AUTH}/supabase/login`,
      verify: `${ROOTS.AUTH}/supabase/verify`,
      register: `${ROOTS.AUTH}/supabase/register`,
      newPassword: `${ROOTS.AUTH}/supabase/new-password`,
      forgotPassword: `${ROOTS.AUTH}/supabase/forgot-password`,
    },
  },
  authDemo: {
    classic: {
      login: `${ROOTS.AUTH_DEMO}/classic/login`,
      register: `${ROOTS.AUTH_DEMO}/classic/register`,
      forgotPassword: `${ROOTS.AUTH_DEMO}/classic/forgot-password`,
      newPassword: `${ROOTS.AUTH_DEMO}/classic/new-password`,
      verify: `${ROOTS.AUTH_DEMO}/classic/verify`,
    },
    modern: {
      login: `${ROOTS.AUTH_DEMO}/modern/login`,
      register: `${ROOTS.AUTH_DEMO}/modern/register`,
      forgotPassword: `${ROOTS.AUTH_DEMO}/modern/forgot-password`,
      newPassword: `${ROOTS.AUTH_DEMO}/modern/new-password`,
      verify: `${ROOTS.AUTH_DEMO}/modern/verify`,
    },
  },
  // DASHBOARD
  dashboard: {
    root: ROOTS.DASHBOARD,
    mail: `${ROOTS.DASHBOARD}/mail`,
    chat: `${ROOTS.DASHBOARD}/chat`,
    blank: `${ROOTS.DASHBOARD}/blank`,
    kanban: `${ROOTS.DASHBOARD}/kanban`,
    calendar: `${ROOTS.DASHBOARD}/calendar`,
    fileManager: `${ROOTS.DASHBOARD}/file-manager`,
    permission: `${ROOTS.DASHBOARD}/permission`,
    role: {
      root: `${ROOTS.DASHBOARD}/role`,
      list: `${ROOTS.DASHBOARD}/role/list`,
      new: `${ROOTS.DASHBOARD}/role/new`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/role/${id}/edit`,
    },
    shift: {
      root: `${ROOTS.DASHBOARD}/shift`,
      list: `${ROOTS.DASHBOARD}/shift/list`,
      new: `${ROOTS.DASHBOARD}/shift/new`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/shift/${id}/edit`,
      templates: {
        root: `${ROOTS.DASHBOARD}/shift/templates`,
        list: `${ROOTS.DASHBOARD}/shift/templates`,
        new: `${ROOTS.DASHBOARD}/shift/templates/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/shift/templates/${id}/edit`,
      },
      schedules: {
        root: `${ROOTS.DASHBOARD}/shift/schedules`,
        list: `${ROOTS.DASHBOARD}/shift/schedules`,
        new: `${ROOTS.DASHBOARD}/shift/schedules/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/shift/schedules/${id}/edit`,
        byTemplate: (templateId: string) => `${ROOTS.DASHBOARD}/shift/schedules/template/${templateId}`,
      },
    },
    attendance: {
      root: `${ROOTS.DASHBOARD}/attendance`,
      assignments: `${ROOTS.DASHBOARD}/attendance/assignments`,
      checkin: `${ROOTS.DASHBOARD}/attendance/checkin`,
      logs: `${ROOTS.DASHBOARD}/attendance/logs`,
      requests: `${ROOTS.DASHBOARD}/attendance/requests`,
      report: `${ROOTS.DASHBOARD}/attendance/report`,
      mySchedule: `${ROOTS.DASHBOARD}/attendance/my-schedule`,
      myLogs: `${ROOTS.DASHBOARD}/attendance/my-logs`,
      shiftRegistration: `${ROOTS.DASHBOARD}/attendance/shift-registration`,
      adjust: `${ROOTS.DASHBOARD}/attendance/adjust`,
    },
    salary: {
      root: `${ROOTS.DASHBOARD}/salary`,
      configuration: `${ROOTS.DASHBOARD}/salary/configuration`,
      history: `${ROOTS.DASHBOARD}/salary/history`,
    },
    payroll: {
      root: `${ROOTS.DASHBOARD}/payroll`,
      myPayroll: `${ROOTS.DASHBOARD}/payroll/my-payroll`,
      cycles: `${ROOTS.DASHBOARD}/payroll/cycles`,
      batch: `${ROOTS.DASHBOARD}/payroll/batch`,
    },
    holidayPolicy: {
      root: `${ROOTS.DASHBOARD}/holiday-policy`,
      list: `${ROOTS.DASHBOARD}/holiday-policy/list`,
    },
    penaltyPolicy: {
      root: `${ROOTS.DASHBOARD}/penalty-policy`,
      list: `${ROOTS.DASHBOARD}/penalty-policy/list`,
    },
    shiftSwap: {
      root: `${ROOTS.DASHBOARD}/shift-swap`,
      myRequests: `${ROOTS.DASHBOARD}/shift-swap/my-requests`,
      pending: `${ROOTS.DASHBOARD}/shift-swap/pending`,
    },
    shiftCash: {
      root: `${ROOTS.DASHBOARD}/shift-cash`,
      dashboard: `${ROOTS.DASHBOARD}/shift-cash`,
    },
    checkinFace: {
      root: `${ROOTS.DASHBOARD}/checkin-face`,
    },
    notificationConfig: {
      root: `${ROOTS.DASHBOARD}/notification-config`,
    },
    kiotVietSync: {
      root: `${ROOTS.DASHBOARD}/kiotviet-sync`,
    },
    // POS / Inventory
    pos: {
      root: `${ROOTS.DASHBOARD}/pos`,
      category: {
        root: `${ROOTS.DASHBOARD}/pos/category`,
        list: `${ROOTS.DASHBOARD}/pos/category/list`,
        new: `${ROOTS.DASHBOARD}/pos/category/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/category/${id}/edit`,
      },
      product: {
        root: `${ROOTS.DASHBOARD}/pos/product`,
        list: `${ROOTS.DASHBOARD}/pos/product/list`,
        new: `${ROOTS.DASHBOARD}/pos/product/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/product/${id}/edit`,
      },
      warehouse: {
        root: `${ROOTS.DASHBOARD}/pos/warehouse`,
        list: `${ROOTS.DASHBOARD}/pos/warehouse/list`,
        new: `${ROOTS.DASHBOARD}/pos/warehouse/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/warehouse/${id}/edit`,
      },
      unitOfMeasure: {
        root: `${ROOTS.DASHBOARD}/pos/unit-of-measure`,
        list: `${ROOTS.DASHBOARD}/pos/unit-of-measure/list`,
      },
      variantAttribute: {
        root: `${ROOTS.DASHBOARD}/pos/variant-attribute`,
        list: `${ROOTS.DASHBOARD}/pos/variant-attribute/list`,
      },
      inventory: {
        root: `${ROOTS.DASHBOARD}/pos/inventory`,
        list: `${ROOTS.DASHBOARD}/pos/inventory/list`,
        lowStock: `${ROOTS.DASHBOARD}/pos/inventory/low-stock`,
        transactions: `${ROOTS.DASHBOARD}/pos/inventory/transactions`,
      },
      supplier: {
        root: `${ROOTS.DASHBOARD}/pos/supplier`,
        list: `${ROOTS.DASHBOARD}/pos/supplier/list`,
        new: `${ROOTS.DASHBOARD}/pos/supplier/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/supplier/${id}/edit`,
      },
      purchaseOrder: {
        root: `${ROOTS.DASHBOARD}/pos/purchase-order`,
        list: `${ROOTS.DASHBOARD}/pos/purchase-order/list`,
        new: `${ROOTS.DASHBOARD}/pos/purchase-order/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/pos/purchase-order/${id}`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/purchase-order/${id}/edit`,
      },
      customer: {
        root: `${ROOTS.DASHBOARD}/pos/customer`,
        list: `${ROOTS.DASHBOARD}/pos/customer/list`,
        new: `${ROOTS.DASHBOARD}/pos/customer/new`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/customer/${id}/edit`,
      },
      sale: {
        root: `${ROOTS.DASHBOARD}/pos/sale`,
      },
      salesOrder: {
        root: `${ROOTS.DASHBOARD}/pos/sales-order`,
        list: `${ROOTS.DASHBOARD}/pos/sales-order/list`,
        new: `${ROOTS.DASHBOARD}/pos/sales-order/new`,
        details: (id: string) => `${ROOTS.DASHBOARD}/pos/sales-order/${id}`,
        edit: (id: string) => `${ROOTS.DASHBOARD}/pos/sales-order/${id}/edit`,
      },
      report: {
        root: `${ROOTS.DASHBOARD}/pos/report`,
        dashboard: `${ROOTS.DASHBOARD}/pos/report/dashboard`,
        revenue: `${ROOTS.DASHBOARD}/pos/report/revenue`,
        productSales: `${ROOTS.DASHBOARD}/pos/report/product-sales`,
        customers: `${ROOTS.DASHBOARD}/pos/report/customers`,
        inventory: `${ROOTS.DASHBOARD}/pos/report/inventory`,
        tax: `${ROOTS.DASHBOARD}/pos/report/tax`,
      },
    },
    general: {
      app: `${ROOTS.DASHBOARD}/app`,
      ecommerce: `${ROOTS.DASHBOARD}/ecommerce`,
      analytics: `${ROOTS.DASHBOARD}/analytics`,
      banking: `${ROOTS.DASHBOARD}/banking`,
      booking: `${ROOTS.DASHBOARD}/booking`,
      file: `${ROOTS.DASHBOARD}/file`,
    },
    user: {
      root: `${ROOTS.DASHBOARD}/user`,
      new: `${ROOTS.DASHBOARD}/user/new`,
      list: `${ROOTS.DASHBOARD}/user/list`,
      cards: `${ROOTS.DASHBOARD}/user/cards`,
      profile: `${ROOTS.DASHBOARD}/user/profile`,
      account: `${ROOTS.DASHBOARD}/user/account`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/user/${id}/edit`,
      demo: {
        edit: `${ROOTS.DASHBOARD}/user/${MOCK_ID}/edit`,
      },
    },
    product: {
      root: `${ROOTS.DASHBOARD}/product`,
      new: `${ROOTS.DASHBOARD}/product/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/product/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/product/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/product/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/product/${MOCK_ID}/edit`,
      },
    },
    invoice: {
      root: `${ROOTS.DASHBOARD}/invoice`,
      new: `${ROOTS.DASHBOARD}/invoice/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/invoice/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/invoice/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/invoice/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/invoice/${MOCK_ID}/edit`,
      },
    },
    post: {
      root: `${ROOTS.DASHBOARD}/post`,
      new: `${ROOTS.DASHBOARD}/post/new`,
      details: (title: string) => `${ROOTS.DASHBOARD}/post/${paramCase(title)}`,
      edit: (title: string) => `${ROOTS.DASHBOARD}/post/${paramCase(title)}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/post/${paramCase(MOCK_TITLE)}`,
        edit: `${ROOTS.DASHBOARD}/post/${paramCase(MOCK_TITLE)}/edit`,
      },
    },
    order: {
      root: `${ROOTS.DASHBOARD}/order`,
      details: (id: string) => `${ROOTS.DASHBOARD}/order/${id}`,
      demo: {
        details: `${ROOTS.DASHBOARD}/order/${MOCK_ID}`,
      },
    },
    job: {
      root: `${ROOTS.DASHBOARD}/job`,
      new: `${ROOTS.DASHBOARD}/job/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/job/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/job/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/job/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/job/${MOCK_ID}/edit`,
      },
    },
    tour: {
      root: `${ROOTS.DASHBOARD}/tour`,
      new: `${ROOTS.DASHBOARD}/tour/new`,
      details: (id: string) => `${ROOTS.DASHBOARD}/tour/${id}`,
      edit: (id: string) => `${ROOTS.DASHBOARD}/tour/${id}/edit`,
      demo: {
        details: `${ROOTS.DASHBOARD}/tour/${MOCK_ID}`,
        edit: `${ROOTS.DASHBOARD}/tour/${MOCK_ID}/edit`,
      },
    },
  },
};
