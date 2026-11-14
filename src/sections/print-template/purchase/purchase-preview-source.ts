import { getAllPurchaseOrders, getPurchaseOrderPrint } from 'src/api/purchase-orders';

import { purchaseDocument } from './purchase-template-fields';

import type { PreviewOption, PreviewDataSource } from '../receipt/receipt-template-preview';

// ----------------------------------------------------------------------
// Xem trước mẫu phiếu nhập với phiếu nhập thật (danh sách gần đây / tìm theo mã, NCC, ghi chú).
// ----------------------------------------------------------------------

const purchaseOptions = (params: { keyword?: string; pageSize: number }): Promise<PreviewOption[]> =>
  getAllPurchaseOrders({ ...params, pageNumber: 1 }).then((page) =>
    (page.items ?? []).map((order) => ({
      id: order.id,
      code: order.orderNumber ?? '',
      label: `${order.orderNumber}${order.supplierName ? ` · ${order.supplierName}` : ''}`,
    }))
  );

export const PURCHASE_PREVIEW_SOURCE: PreviewDataSource = {
  sampleLabel: 'Phiếu nhập mẫu',
  recentLoadingLabel: 'Đang tải phiếu nhập gần đây…',
  searchLabel: 'Tìm phiếu nhập theo mã',
  searchPlaceholder: 'VD: PN000123',
  searchButtonLabel: 'Tìm phiếu nhập',
  frameTitle: 'Xem trước mẫu phiếu nhập',
  notFound: (keyword) => `Không tìm thấy phiếu nhập "${keyword}"`,
  loadErrorLabel: 'Không tải được phiếu nhập',
  searchErrorLabel: 'Không tìm được phiếu nhập',
  recent: () => purchaseOptions({ pageSize: 10 }),
  search: (keyword) => purchaseOptions({ keyword, pageSize: 5 }),
  load: (id) => getPurchaseOrderPrint(id).then(purchaseDocument),
};
