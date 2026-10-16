import axios from 'src/utils/axios';

// ----------------------------------------------------------------------
// Trả hàng từ hoá đơn (core-be SalesReturnsController). Ở máy quầy server đặt giá theo hoá đơn, chặn trả quá phần đã
// bán và tiền hoàn vượt phiếu — giá client gửi chỉ là ước tính.
// ----------------------------------------------------------------------

export type CreateSalesReturnInput = {
  /** 1 = theo hoá đơn. */
  returnType: 1;
  salesOrderId: string;
  customerId: string | null;
  warehouseId: string;
  note: string | null;
  lines: { productId: string; quantity: number; price: number }[];
};

/** Tạo phiếu trả (nháp) rồi đọc lại tổng phiếu do server tính. */
export async function createSalesReturn(input: CreateSalesReturnInput): Promise<{ id: string; returnTotal: number | null }> {
  const created = await axios.post<{ id: string }>('/sales-returns', input);
  const { id } = created.data;
  try {
    const detail = await axios.get<{ returnTotal: number }>(`/sales-returns/${id}`);
    return { id, returnTotal: detail.data.returnTotal };
  } catch {
    return { id, returnTotal: null };
  }
}

/** Hoàn tất: nhập lại kho + ghi tiền hoàn cho khách. */
export async function completeSalesReturn(id: string, refundAmount: number): Promise<void> {
  await axios.post(`/sales-returns/${id}/complete`, { refundAmount });
}
