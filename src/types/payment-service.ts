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
  | 'vietinbank'
  | 'mockbank'
  | 'apipay'
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

/** ok | warning (≥ 80%) | exceeded (vượt — ApiPay vẫn chạy, trừ phí vượt vào số dư trả trước). */
export type PaymentQuotaStatus = 'ok' | 'warning' | 'exceeded';

/**
 * GET payment/settings/connections/{id}/usage — hạn mức gói ApiPay trong chu kỳ hiện tại. Hạn mức tính theo TÀI KHOẢN
 * ApiPay (mọi ngân hàng / kết nối cùng access key dùng chung); số đã dùng là ước tính từ giao dịch đã ghi nhận.
 */
export type IPaymentQuotaUsage = {
  /** yyyy-MM-dd (giờ VN) — ApiPay tính từ ngày kích hoạt gói (quotaCycleDay) */
  cycleStart: string;
  /** yyyy-MM-dd — ngày bắt đầu chu kỳ sau (ApiPay hiện "15/10 → 15/11") */
  cycleEnd: string;
  used: number;
  quota: number;
  remaining: number;
  status: PaymentQuotaStatus;
  /** Số kết nối dùng chung tài khoản ApiPay này */
  connections: number;
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

// ---------------------------------------------------------------------- Liên kết ngân hàng qua ApiPay (Admin)

/** Loại tài khoản ApiPay: cá nhân / doanh nghiệp / hộ kinh doanh. */
export type ApiPayAccountType =
  | 'personal-account'
  | 'business-account'
  | 'business-household-account';

/** GET payment/settings/connections/{id}/apipay/banks/available — ngân hàng ApiPay cho liên kết. */
export type IApiPayAvailableBank = {
  bin: string;
  code: string;
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
};

/** Tài khoản đã liên kết vào tài khoản ApiPay của kết nối. */
export type IApiPayLinkedBank = {
  publicId: string;
  bin?: string | null;
  bankName?: string | null;
  bankShortName?: string | null;
  /** Số tài khoản gốc tại ngân hàng */
  accountNumber: string;
  accountName?: string | null;
  nickname?: string | null;
  /** Tài khoản ảo ApiPay cấp — QR phải in số này */
  vaNumber?: string | null;
  status: 'active' | 'inactive' | 'pending' | (string & {});
  /** ApiPay đang xử lý kích hoạt thủ công (tới 24 giờ) */
  manualActivationPending: boolean;
  createdAt?: string | null;
  /** Đang là tài khoản nhận của kết nối */
  inUse: boolean;
  /** Kết nối đang chờ tài khoản này kích hoạt để tự gắn */
  pending: boolean;
};

/** Tài khoản vừa thành tài khoản nhận của kết nối (spark-payment). */
export type IApiPayAppliedBank = {
  publicId: string;
  bin: string;
  bankName?: string | null;
  bankShortName?: string | null;
  /** Số in trên QR: số VA, hoặc số gốc khi ngân hàng không cấp VA */
  accountNumber: string;
  accountName?: string | null;
  originalAccountNumber: string;
  virtualAccount: boolean;
};

/** core-be thêm / bật lại tài khoản ngân hàng của cửa hàng mang số trên QR (POS chọn được). */
export type IApiPayCoreBankAccount = {
  id?: string;
  created?: boolean;
  isDefault?: boolean;
  /** Không thêm được (thêm tay ở Tài khoản ngân hàng) */
  error?: string;
};

/** GET payment/settings/connections/{id}/apipay/banks */
export type IApiPayBanksResponse = {
  banks: IApiPayLinkedBank[];
  connection: IPaymentConnection;
  /** Tài khoản đang chờ kích hoạt vừa xong → đã gắn vào kết nối */
  applied?: IApiPayAppliedBank | null;
  coreBankAccount?: IApiPayCoreBankAccount | null;
};

/** active = đã gắn vào kết nối; otp_required = nhập OTP; pending_activation = chờ ApiPay kích hoạt thủ công. */
export type ApiPayLinkStatus = 'active' | 'otp_required' | 'pending_activation';

export type IApiPayLinkResult = {
  status: ApiPayLinkStatus;
  message?: string | null;
  publicId?: string | null;
  vaNumber?: string | null;
  connection: IPaymentConnection;
  applied?: IApiPayAppliedBank | null;
  coreBankAccount?: IApiPayCoreBankAccount | null;
};

/**
 * POST payment/settings/connections/{id}/apipay/banks. SĐT, CCCD / mã số thuế chỉ chuyển thẳng sang ApiPay — máy chủ
 * không lưu.
 */
export type IApiPayLinkRequest = {
  bankBin: string;
  bankName: string;
  accountType: ApiPayAccountType;
  accountNumber: string;
  /** In hoa không dấu */
  accountName: string;
  mobile: string;
  /** CCCD hoặc mã số thuế — ACB cá nhân không cần */
  identity?: string;
  /** Tên đăng nhập ACB OneBiz — ACB doanh nghiệp / hộ kinh doanh */
  acbUserId?: string;
  nickname?: string;
};

export type IApiPayConfirmOtpRequest = {
  bankBin: string;
  accountNumber: string;
  otp: string;
};

// ---------------------------------------------------------------------- Đăng ký báo có (kiểu KiotViet, Admin)

export type BankLinkAccountType = 'individual' | 'household' | 'business';

/** otp_required = chờ OTP đăng ký; revoking = chờ OTP huỷ; revoked chỉ có ở response huỷ xong. */
export type BankLinkStatus = 'otp_required' | 'active' | 'revoking' | 'revoked';

/** GET payment/settings/bank-links/banks — ngân hàng S Payment đăng ký báo có được (hoặc lý do chưa). */
export type IBankLinkBank = {
  code: string;
  bin: string;
  name: string;
  available: boolean;
  unavailableReason?: string | null;
  accountTypes: BankLinkAccountType[];
  /** Câu đồng ý chủ tài khoản phải tick */
  consent: string;
};

export type IBankLink = {
  id: string;
  bank: string;
  bin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: BankLinkAccountType;
  status: BankLinkStatus;
  /** SĐT nhận OTP đã che, vd 037*****15 */
  maskedMobile?: string | null;
  otpSentAt?: string | null;
  activatedAt?: string | null;
  revokedAt?: string | null;
  lastError?: string | null;
  connectionId?: string | null;
  createdAt: string;
  /** Chỉ khi vừa active: tài khoản ngân hàng của cửa hàng core-be đã thêm / bật lại */
  coreBankAccount?: IApiPayCoreBankAccount | null;
};

/** POST payment/settings/bank-links. CCCD / MST và SĐT chỉ chuyển thẳng sang ngân hàng — máy chủ không lưu. */
export type IRegisterBankLinkRequest = {
  bank: string;
  accountNumber: string;
  accountName: string;
  accountType: BankLinkAccountType;
  identity: string;
  mobile: string;
  policyAgree: boolean;
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
  /** Khối lượng một đơn vị dùng tính cước (gram) */
  weightGrams?: number | null;
};

/** Khâu gói / giao sau khi đã thanh toán. */
export type OnlineShipmentStatus = 'to_pack' | 'packed' | 'shipped' | 'completed';

/**
 * Tiền của đơn: khách trả = tiền hàng + phí ship; cửa hàng chịu cước hãng (shippingCost) và phí đối soát (ApiPay tối đa
 * 350đ khi đã quá 60 giao dịch miễn phí trong tháng). shippingSubsidy = phần cước cửa hàng bù khi miễn phí ship.
 */
export type IOnlineOrderCosts = {
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingCost: number;
  shippingSubsidy: number;
  paymentFeeMax?: number | null;
  netAfterShipping: number;
};

export type IOnlineOrderShipping = {
  method?: 'ship' | 'pickup' | null;
  addressLine?: string | null;
  provinceName?: string | null;
  wardName?: string | null;
  carrier?: string | null;
  service?: string | null;
  connectionId?: string | null;
  weightGrams?: number | null;
  insuranceValue?: number | null;
  expectedDeliveryAt?: string | null;
  shipmentId?: string | null;
  trackingCode?: string | null;
  /** Trạng thái chuẩn của spark-shipping (created, picking, delivering, delivered...) */
  shippingStatus?: string | null;
  shipmentStatus: OnlineShipmentStatus;
  packedAt?: string | null;
  packedByName?: string | null;
  shippedAt?: string | null;
  completedAt?: string | null;
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
  fulfillmentError?: string | null;
  costs?: IOnlineOrderCosts | null;
  shipping?: IOnlineOrderShipping | null;
  /** Lựa chọn thanh toán khách chọn (vd "transfer:{kết nối ApiPay}") */
  paymentOptionKey?: string | null;
};

export type IOnlineOrderQuery = {
  status?: OnlineOrderStatus;
  /** Lọc khâu gói / giao */
  shipment?: OnlineShipmentStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};
