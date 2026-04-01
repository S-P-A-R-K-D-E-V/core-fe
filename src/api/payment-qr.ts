import axios, { endpoints } from 'src/utils/axios';
import {
  ICreateQrPaymentRequest,
  IQrPaymentResponse,
  IQrPaymentStatusResponse,
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
