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

/**
 * Khoá nhà cung cấp (GET payment/settings/providers → key). Ngân hàng trực tiếp: acb / bidv / mbbank / mockbank (giả
 * lập — core-fe không cho chọn). Danh mục có thể thêm nhà mới nên vẫn nhận chuỗi bất kỳ.
 */
export type PaymentProvider =
  | 'sepay'
  | 'casso'
  | 'payos'
  | 'vnpay'
  | 'acb'
  | 'bidv'
  | 'mbbank'
  | 'mockbank'
  | (string & {});

/** bank_direct = API ngân hàng trực tiếp; bank_feed = SePay/Casso đọc biến động số dư; gateway = payOS/VNPay. */
export type PaymentConnectionKind = 'bank_direct' | 'bank_feed' | 'gateway' | (string & {});

export type IPaymentSettings = {
  enabled: boolean;
  paymentCodePrefix: string;
  webhookBaseUrl: string;
};

/** ConnectionDto của spark-payment (mục 7c). Máy chủ không bao giờ trả lại khoá đã lưu. */
export type IPaymentConnection = {
  id: string;
  provider: PaymentProvider;
  kind: PaymentConnectionKind;
  displayName: string;
  status: 'active' | 'disabled';
  /** URL chính dán vào trang nhà cung cấp (webhook / IPN) — chứa routing token riêng của kết nối */
  webhookUrl: string;
  /** Mọi URL webhook theo nhánh (ngân hàng trực tiếp có nhiều nhánh: status, qr-transaction, token, notify…) */
  webhookUrls?: Record<string, string> | null;
  bankAccount?: IPaymentBankAccount | null;
  lastWebhookAt?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  /** Chỉ có khi tạo / tạo lại khoá webhook: khoá hệ thống tự sinh — hiện MỘT lần, không xem lại được */
  generatedSecrets?: Record<string, string> | null;
  /** Thông tin không bí mật đã lưu (merchantId, terminalId, baseUrl, webhookAuth, sandbox… — giá trị dạng chuỗi) */
  publicSettings?: Record<string, string> | null;
  /** Khoá credentials còn thiếu để chạy đủ nghiệp vụ — bổ sung bằng Cập nhật */
  missingSettings?: string[] | null;
};

export type ICreatePaymentConnectionRequest = {
  provider: PaymentProvider;
  displayName: string;
  /** id dòng GET /bank-accounts */
  bankAccountId?: string;
  /** Khoá theo `fields` của nhà cung cấp (GET payment/settings/providers). Máy chủ không bao giờ trả lại. */
  credentials: Record<string, string | boolean>;
};

/** PUT payment/settings/connections/{id} — mọi trường không bắt buộc. */
export type IUpdatePaymentConnectionRequest = {
  displayName?: string;
  /** Chỉ gửi ô có nhập / đã đổi — ô trống = giữ nguyên giá trị đang lưu */
  credentials?: Record<string, string | boolean>;
  bankAccountId?: string;
  /** true = bật lại kết nối đã tắt */
  active?: boolean;
};

export type PaymentProviderFieldType = 'text' | 'password' | 'select' | 'boolean' | 'textarea';

export type IPaymentProviderField = {
  key: string;
  label: string;
  required: boolean;
  /** Khoá bí mật: nhập dạng mật khẩu, không bao giờ hiển thị lại */
  secret: boolean;
  type: PaymentProviderFieldType;
  options?: string[] | null;
  placeholder?: string | null;
  help?: string | null;
};

/** Một nhà cung cấp trong danh mục GET payment/settings/providers. */
export type IPaymentProviderInfo = {
  key: PaymentProvider;
  kind: PaymentConnectionKind;
  displayName: string;
  summary: string;
  /** Miễn phí / có gói miễn phí */
  free: boolean;
  portalUrl?: string | null;
  fields: IPaymentProviderField[];
  setupSteps: string[];
  hasCertificationSuite: boolean;
};

/** POST payment/settings/connections/{id}/test — chỉ kết nối bank_direct (lấy token ngân hàng). */
export type IPaymentConnectionTestResult = {
  success: boolean;
  httpStatus?: number | null;
  code?: string | null;
  message?: string | null;
  bankTraceId?: string | null;
  logId?: string | null;
  outcome?: string | null;
};

// ---------------------------------------------------------------------- Tài khoản ngân hàng (mục 7c)

/** bank_direct = QR động của ngân hàng (có kết nối ngân hàng trực tiếp đang bật); vietqr = VietQR dựng tại chỗ. */
export type BankAccountQrMode = 'bank_direct' | 'vietqr';

export type IBankAccountWithConnections = {
  id: string;
  kiotVietId?: number | null;
  bankName?: string | null;
  shortName?: string | null;
  code?: string | null;
  bin?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
  /** Dòng đồng bộ từ KiotViet — chỉ đọc */
  isManagedByKiotViet: boolean;
  qrMode: BankAccountQrMode;
  /** Kết nối đối soát gắn đúng tài khoản này */
  connections: IPaymentConnection[];
};

/** GET payment/bank-accounts (Admin). */
export type IPaymentBankAccountsResponse = {
  enabled: boolean;
  accounts: IBankAccountWithConnections[];
  /** Kết nối chưa gắn tài khoản nhận nào */
  unassignedConnections: IPaymentConnection[];
};

/** GET bank-accounts/{id}/vietqr?amount=&content= (mọi nhân viên). amount trống = QR tĩnh (in dán quầy). */
export type IBankAccountVietQr = {
  bankAccountId: string;
  bin: string;
  bankName?: string | null;
  accountNumber: string;
  accountName?: string | null;
  amount?: number | null;
  content?: string | null;
  /** Chuỗi EMVCo để tự vẽ QR */
  payload?: string | null;
  /** Ảnh dự phòng (img.vietqr.io) */
  imageUrl?: string | null;
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
