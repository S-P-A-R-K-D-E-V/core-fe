// ----------------------------------------------------------------------
// Bán online: phương thức thanh toán theo kênh (POS / Online), chính sách bán online & giao hàng, kết nối hãng vận
// chuyển (spark-shipping), trang đặt hàng công khai, đơn online quản trị. Khớp DTO của Core-be (camelCase).
// ----------------------------------------------------------------------

export type PaymentChannel = 'pos' | 'online';

/** Một lựa chọn thanh toán (PaymentOptionView) — khoá: "cash", "card", "transfer:account", "transfer:{kết nối}", "payos"… */
export type IPaymentOption = {
  key: string;
  kind: 'cash' | 'card' | 'wallet' | 'transfer' | 'gateway';
  label: string;
  detail?: string | null;
  provider?: string | null;
  environment?: string | null;
  channels: PaymentChannel[];
  /** Tiền về là đơn tự xác nhận */
  autoConfirm: boolean;
  /** Chi phí của lựa chọn — null = không phát sinh phí */
  feeNote?: string | null;
};

export type IPaymentChannelView = {
  /** false = chưa lưu (POS dùng mọi lựa chọn như trước; Online chưa nhận thanh toán) */
  configured: boolean;
  enabled: string[];
  defaultTransfer?: string | null;
};

export type IPaymentChannels = {
  paymentServiceEnabled: boolean;
  options: IPaymentOption[];
  pos: IPaymentChannelView;
  online: IPaymentChannelView;
};

export type IUpdatePaymentChannels = {
  pos?: { enabled: string[]; defaultTransfer?: string | null } | null;
  online?: { enabled: string[] } | null;
};

export type CarrierSelection = 'cheapest' | 'choose';
export type InspectionPolicy = 'no_view' | 'view_no_try' | 'try';

export type IShippingConnectionInfo = {
  id: string;
  carrier: string;
  displayName: string;
  environment: string;
  status: 'active' | 'disabled';
};

export type IOnlineShopSettingsInput = {
  allowPickup: boolean;
  pickupNote?: string | null;
  shippingEnabled: boolean;
  shippingConnectionIds: string[];
  carrierSelection: CarrierSelection;
  defaultItemWeightGrams: number;
  packagingWeightGrams: number;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  declareInsurance: boolean;
  freeShippingThreshold?: number | null;
  inspectionPolicy: InspectionPolicy;
};

export type IOnlineShopSettings = IOnlineShopSettingsInput & {
  /** spark-shipping bật cho hệ thống */
  shippingServiceEnabled: boolean;
  connections: IShippingConnectionInfo[];
  connectionsError?: string | null;
};

// ---- Kết nối hãng vận chuyển (spark-shipping) ----

export type IShippingCredentialField = { key: string; label: string; secret: boolean; required: boolean; help?: string | null };
export type IShippingSettingField = { key: string; label: string; required: boolean; help?: string | null };

/** Trang của hãng: tạo tài khoản, lấy token, cấu hình webhook, tài liệu. environment null = mọi môi trường. */
export type IShippingCarrierLink = {
  kind: 'signup' | 'token' | 'webhook' | 'docs' | string;
  label: string;
  url: string;
  environment?: string | null;
};

export type IShippingCarrier = {
  code: string;
  label: string;
  credentials: IShippingCredentialField[];
  settings: IShippingSettingField[];
  environments: string[];
  help: string;
  webhookHelp: string;
  links?: IShippingCarrierLink[] | null;
  /** "form" = điền các ô; "otp" = liên kết shop của hãng bằng SĐT chủ shop + OTP (khoá do nền tảng giữ) */
  connect?: 'form' | 'otp' | string;
  /** Hãng gửi trạng thái về URL chung của nền tảng — cửa hàng không cấu hình webhook */
  platformWebhook?: boolean;
};

/** Shop của hãng mà cửa hàng đã liên kết bằng OTP ("otp") hoặc được nền tảng gán ("assigned"). */
export type ILinkedCarrierAccount = {
  accountRef: string;
  name: string;
  address?: string | null;
  source: 'otp' | 'assigned' | string;
  /** false = tài khoản nền tảng không còn thấy shop (chủ shop gỡ liên kết) */
  available: boolean;
  /** Kết nối của cửa hàng đang dùng shop này */
  connectionIds: string[];
};

export type IShippingConnection = {
  id: string;
  carrier: string;
  displayName: string;
  environment: string;
  status: 'active' | 'disabled';
  settings: Record<string, string>;
  /** Tên các khoá đã lưu (không có giá trị) */
  credentialKeys: string[];
  /** Dán vào trang cấu hình webhook của hãng; null = hãng gửi về URL chung của nền tảng */
  webhookUrl?: string | null;
  lastError?: string | null;
  lastWebhookAt?: string | null;
  createdAt: string;
};

export type ISaveShippingConnection = {
  carrier?: string;
  displayName?: string;
  environment?: string;
  credentials?: Record<string, string>;
  settings?: Record<string, string>;
  active?: boolean;
};

export type IShippingTestResult = { ok: boolean; message: string; details?: Record<string, string> | null };

// ---- Trang đặt hàng công khai ----

export type IStorefrontPaymentMethod = {
  method: 'bank_transfer' | 'payos' | 'vnpay';
  label: string;
  /** Gửi lại khi đặt hàng */
  key?: string | null;
  detail?: string | null;
};

export type IStorefrontCheckoutConfig = {
  payments: IStorefrontPaymentMethod[];
  delivery: {
    pickup: boolean;
    pickupNote?: string | null;
    ship: boolean;
    carrierSelection: CarrierSelection;
    freeShippingThreshold?: number | null;
  };
};

export type IAdminUnit = { code: string; name: string; type?: string | null };

export type IStorefrontShippingOption = {
  connectionId: string;
  carrier: string;
  carrierLabel: string;
  service?: string | null;
  serviceLabel?: string | null;
  /** Phí ship khách trả (0 = miễn phí ship) */
  fee: number;
  freeShipping: boolean;
  expectedDeliveryAt?: string | null;
};

export type IStorefrontShippingQuote = {
  subtotal: number;
  weightGrams: number;
  options: IStorefrontShippingOption[];
  selected?: IStorefrontShippingOption | null;
  carrierSelection: CarrierSelection;
  freeShippingThreshold?: number | null;
};

export type IStorefrontAddress = { provinceCode: string; wardCode: string; street: string };

export type IStorefrontCheckoutRequest = {
  customerName: string;
  phone: string;
  email?: string | null;
  note?: string | null;
  items: { productId: string; quantity: number }[];
  paymentMethod?: string | null;
  returnUrl?: string | null;
  delivery: {
    method: 'ship' | 'pickup';
    address?: IStorefrontAddress | null;
    connectionId?: string | null;
    service?: string | null;
    quotedFee?: number | null;
  };
};

export type IStorefrontPayment = {
  method: string;
  status?: string | null;
  paymentCode?: string | null;
  qrImageUrl?: string | null;
  qrPayload?: string | null;
  checkoutUrl?: string | null;
  expiresAt?: string | null;
  bankAccount?: { bankName?: string | null; accountNumber: string; accountName?: string | null } | null;
  amount: number;
  amountReceived: number;
};

export type IStorefrontCheckoutResult = {
  orderCode: string;
  token: string;
  total: number;
  status: string;
  payment: IStorefrontPayment;
};

export type OnlineOrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'expired';
export type ShipmentStatus = 'to_pack' | 'packed' | 'shipped' | 'completed';

export type IStorefrontOrder = {
  orderCode: string;
  status: OnlineOrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  customerName: string;
  items: { name: string; quantity: number; price: number; amount: number; imageUrl?: string | null }[];
  payment: IStorefrontPayment;
  delivery: {
    method?: 'ship' | 'pickup' | null;
    address?: string | null;
    carrierLabel?: string | null;
    expectedDeliveryAt?: string | null;
    trackingCode?: string | null;
    shipmentStatus: ShipmentStatus;
    shippingStatus?: string | null;
  };
};
