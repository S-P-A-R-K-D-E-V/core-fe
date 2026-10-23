import type {
  IAdminUnit,
  IPaymentChannels,
  IShippingCarrier,
  IStorefrontOrder,
  IShippingConnection,
  IOnlineShopSettings,
  IShippingTestResult,
  IUpdatePaymentChannels,
  IStorefrontShippingQuote,
  ISaveShippingConnection,
  IStorefrontCheckoutConfig,
  IStorefrontCheckoutResult,
  IOnlineShopSettingsInput,
  IStorefrontCheckoutRequest,
  IStorefrontAddress,
  ILinkedCarrierAccount,
  IPickupBranch,
  ISaveBranchPickupAddress,
} from 'src/types/online-shop';

import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Thanh toán → Cài đặt (chủ cửa hàng): phương thức theo kênh, chính sách bán online, kết nối hãng vận chuyển.
// ----------------------------------------------------------------------

export async function getPaymentChannels(): Promise<IPaymentChannels> {
  const res = await axios.get<IPaymentChannels>(endpoints.paymentChannels.channels);
  return res.data;
}

/** Kênh không gửi (undefined) = giữ nguyên cấu hình đã lưu của kênh đó. */
export async function updatePaymentChannels(data: IUpdatePaymentChannels): Promise<IPaymentChannels> {
  const res = await axios.put<IPaymentChannels>(endpoints.paymentChannels.channels, data);
  return res.data;
}

export async function getOnlineShopSettings(): Promise<IOnlineShopSettings> {
  const res = await axios.get<IOnlineShopSettings>(endpoints.paymentChannels.onlineShop);
  return res.data;
}

export async function updateOnlineShopSettings(data: IOnlineShopSettingsInput): Promise<IOnlineShopSettings> {
  const res = await axios.put<IOnlineShopSettings>(endpoints.paymentChannels.onlineShop, data);
  return res.data;
}

/** Địa chỉ gửi hàng của chi nhánh (điểm lấy của hãng). Tỉnh, phường, số nhà đều trống = xoá. */
export async function updateBranchPickupAddress(branchId: string, data: ISaveBranchPickupAddress): Promise<IPickupBranch> {
  const res = await axios.put<IPickupBranch>(endpoints.paymentChannels.branchPickupAddress(branchId), data);
  return res.data;
}

export async function getShippingCarriers(): Promise<IShippingCarrier[]> {
  const res = await axios.get<IShippingCarrier[]>(endpoints.shippingSettings.carriers);
  return res.data;
}

export async function getShippingConnections(): Promise<IShippingConnection[]> {
  const res = await axios.get<IShippingConnection[]>(endpoints.shippingSettings.connections);
  return res.data;
}

/** Tạo kết nối: spark-shipping thử khoá với hãng trước — khoá sai trả lỗi, không lưu. */
export async function createShippingConnection(data: ISaveShippingConnection): Promise<IShippingConnection> {
  const res = await axios.post<IShippingConnection>(endpoints.shippingSettings.connections, data);
  return res.data;
}

/** Ô khoá để trống = giữ nguyên. */
export async function updateShippingConnection(id: string, data: ISaveShippingConnection): Promise<IShippingConnection> {
  const res = await axios.put<IShippingConnection>(endpoints.shippingSettings.connection(id), data);
  return res.data;
}

export async function disableShippingConnection(id: string): Promise<void> {
  await axios.delete(endpoints.shippingSettings.connection(id));
}

export async function testShippingConnection(id: string): Promise<IShippingTestResult> {
  const res = await axios.post<IShippingTestResult>(endpoints.shippingSettings.test(id));
  return res.data;
}

/** Shop của hãng cửa hàng đã liên kết bằng OTP / được nền tảng gán (GHN). */
export async function getCarrierAccounts(carrier: string, environment: string): Promise<ILinkedCarrierAccount[]> {
  const res = await axios.get<ILinkedCarrierAccount[]>(endpoints.shippingSettings.accounts(carrier), { params: { environment } });
  return res.data;
}

/** Hãng gửi OTP tới SĐT chủ shop; trả số giây OTP còn hiệu lực. */
export async function sendCarrierOtp(carrier: string, data: { environment: string; phone: string }): Promise<{ ttlSeconds: number }> {
  const res = await axios.post<{ ttlSeconds: number }>(endpoints.shippingSettings.otp(carrier), data);
  return res.data;
}

/** OTP + mã shop → nền tảng được thêm vào shop, shop thuộc cửa hàng này. */
export async function linkCarrierAccount(
  carrier: string,
  data: { environment: string; phone: string; otp: string; accountRef: string }
): Promise<ILinkedCarrierAccount> {
  const res = await axios.post<ILinkedCarrierAccount>(endpoints.shippingSettings.link(carrier), data);
  return res.data;
}

// ----------------------------------------------------------------------
// Trang đặt hàng công khai (không đăng nhập) — giá, phí ship, tổng tiền luôn do máy chủ tính.
// ----------------------------------------------------------------------

export async function getCheckoutConfig(): Promise<IStorefrontCheckoutConfig> {
  const res = await axios.get<IStorefrontCheckoutConfig>(endpoints.storefront.checkoutConfig);
  return res.data;
}

export async function getProvinces(): Promise<IAdminUnit[]> {
  const res = await axios.get<IAdminUnit[]>(endpoints.storefront.provinces);
  return res.data;
}

export async function getWards(provinceCode: string): Promise<IAdminUnit[]> {
  const res = await axios.get<IAdminUnit[]>(endpoints.storefront.wards, { params: { province: provinceCode } });
  return res.data;
}

export async function getShippingQuote(
  items: { productId: string; quantity: number }[],
  address: IStorefrontAddress
): Promise<IStorefrontShippingQuote> {
  const res = await axios.post<IStorefrontShippingQuote>(endpoints.storefront.shippingQuote, { items, address });
  return res.data;
}

export async function placeOnlineOrder(data: IStorefrontCheckoutRequest): Promise<IStorefrontCheckoutResult> {
  const res = await axios.post<IStorefrontCheckoutResult>(endpoints.storefront.checkout, data);
  return res.data;
}

export async function getOnlineOrderPublic(code: string, token: string): Promise<IStorefrontOrder> {
  const res = await axios.get<IStorefrontOrder>(endpoints.storefront.order(code), { params: { token } });
  return res.data;
}

/** Tạo lại mã thanh toán (hết hạn / đổi phương thức). */
export async function retryOnlineOrderPayment(code: string, token: string, paymentMethod?: string | null) {
  const res = await axios.post<IStorefrontCheckoutResult>(endpoints.storefront.pay(code), { paymentMethod }, { params: { token } });
  return res.data;
}
