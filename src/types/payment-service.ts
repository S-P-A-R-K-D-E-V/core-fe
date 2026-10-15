// Dịch vụ thanh toán (spark-payment) qua core-be — hợp đồng cố định ở _plans/payment-service-plan.md mục 7b.
// JSON camelCase, tiền là số nguyên VND, thời gian ISO.

// ---------------------------------------------------------------------- Chung

export type IPagedItems<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type IPaymentBankAccount = {
  bin: string;
  accountNumber: string;
  accountName: string;
};

// ---------------------------------------------------------------------- Realtime

/** SignalR `PaymentStatusChanged` trên /hubs/notifications — gửi tới người tạo QR. */
export type IPaymentStatusChangedEvent = {
  qrOrderId?: string;
  onlineOrderId?: string;
  intentId: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  amount: number;
  amountReceived: number;
  paymentCode?: string;
  salesOrderId?: string;
};

// ---------------------------------------------------------------------- Cài đặt (Admin)

export type PaymentProvider = 'sepay' | 'casso' | 'payos' | 'vnpay';

export type IPaymentSettings = {
  enabled: boolean;
  paymentCodePrefix: string;
  webhookBaseUrl: string;
};

export type IPaymentConnection = {
  id: string;
  provider: PaymentProvider;
  displayName: string;
  status: 'active' | 'disabled';
  /** URL dán vào trang nhà cung cấp (webhook / IPN) — chứa routing token riêng của kết nối */
  webhookUrl: string;
  bankAccount?: IPaymentBankAccount | null;
  lastWebhookAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
};

export type ICreatePaymentConnectionRequest = {
  provider: PaymentProvider;
  displayName: string;
  /** id dòng GET /bank-accounts */
  bankAccountId?: string;
  /** Khoá theo provider: sepay {apiToken, webhookAuth, webhookSecret}; casso {apiKey, checksumKey};
   * payos {clientId, apiKey, checksumKey}; vnpay {tmnCode, hashSecret, sandbox}. Máy chủ không bao giờ trả lại. */
  credentials: Record<string, string | boolean>;
};

export type IPaymentConnectionSyncResult = {
  fetched: number;
  inserted: number;
  matched: number;
};

// ---------------------------------------------------------------------- Đối soát (Admin, Manager)

export type BankTxnStatus = 'matched' | 'unmatched' | 'ignored';

export type IBankTxn = {
  id: string;
  provider: string;
  connectionId: string;
  accountNumber: string;
  amount: number;
  direction: 'in' | 'out';
  content: string;
  paymentCode?: string | null;
  referenceCode?: string | null;
  bookedAt: string;
  status: BankTxnStatus;
  matchedIntentId?: string | null;
  ignoreReason?: string | null;
  matchedIntent?: {
    id: string;
    orderRef: string;
    orderType: string;
    paymentCode: string;
    amount: number;
    status: PaymentIntentStatus;
  } | null;
};

export type PaymentIntentStatus = 'pending' | 'partially_paid' | 'paid' | 'expired' | 'cancelled' | 'failed';

export type IPaymentIntentSummary = {
  id: string;
  orderRef: string;
  orderType: string;
  channel: string;
  method: string;
  provider: string;
  amount: number;
  amountReceived: number;
  paymentCode: string;
  status: PaymentIntentStatus;
  /** late = tiền về sau khi hết hạn/huỷ; overpaid = nhận dư */
  flags: string[];
  createdAt: string;
  paidAt?: string | null;
  expiresAt?: string | null;
};

export type IReconciliationSummary = {
  transactions: {
    total: number;
    matched: number;
    unmatched: number;
    ignored: number;
    amountIn: number;
    amountMatched: number;
    amountUnmatched: number;
  };
  intents: {
    total: number;
    pending: number;
    paid: number;
    partiallyPaid: number;
    expired: number;
    cancelled: number;
    amountPaid: number;
  };
};

export type IBankTxnQuery = {
  from?: string;
  to?: string;
  status?: BankTxnStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type IPaymentIntentQuery = {
  status?: PaymentIntentStatus;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

// ---------------------------------------------------------------------- Đơn online (Admin, Manager)

export type OnlineOrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'expired';

export type IOnlineOrderLine = {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  price: number;
  amount: number;
};

export type IOnlineOrder = {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  total: number;
  status: OnlineOrderStatus;
  paymentMethod: string;
  paymentCode?: string | null;
  /** Hoá đơn sinh ra khi đơn đã thanh toán */
  salesOrderId?: string | null;
  salesOrderCode?: string | null;
  createdAt: string;
  paidAt?: string | null;
  /** Chỉ có ở GET online-orders/{id} */
  lines?: IOnlineOrderLine[];
};

export type IOnlineOrderQuery = {
  status?: OnlineOrderStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};
