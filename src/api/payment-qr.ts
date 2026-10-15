import axios, { endpoints } from 'src/utils/axios';
import {
  ICreateQrPaymentRequest,
  IQrPaymentResponse,
  IQrPaymentStatusResponse,
  IPosPaymentConnectionsResponse,
} from 'src/types/corecms-api';

export async function createQrPayment(data: ICreateQrPaymentRequest): Promise<IQrPaymentResponse> {
  const response = await axios.post<IQrPaymentResponse>(endpoints.paymentQr.create, data);
  return response.data;
}

export async function getQrPaymentStatus(id: string): Promise<IQrPaymentStatusResponse> {
  const response = await axios.get<IQrPaymentStatusResponse>(endpoints.paymentQr.status(id));
  return response.data;
}

export async function cancelQrPayment(id: string): Promise<void> {
  await axios.delete(endpoints.paymentQr.cancel(id));
}

/** Kết nối thu ngân chọn làm nguồn xác nhận chuyển khoản (ApiPay, SePay, ngân hàng trực tiếp...). */
export async function getPosPaymentConnections(): Promise<IPosPaymentConnectionsResponse> {
  const response = await axios.get<IPosPaymentConnectionsResponse>(endpoints.paymentQr.connections);
  return response.data;
}
