// ----------------------------------------------------------------------
// Sự kiện trong trang cho lần nhập từ ảnh — thẻ hoá đơn trong chat, drawer duyệt nhanh và cột "Phiên nhập" không trỏ
// tới nhau, chỉ nghe chung các sự kiện này.
// - CHANGED: một nơi vừa sửa lần nhập → nơi khác đang hiện cùng lần nhập tải lại (bỏ qua tin của chính mình).
// - OPEN: mở drawer duyệt nhanh của một lần nhập (PurchaseImportDrawerHost nghe).
// ----------------------------------------------------------------------

export const PURCHASE_IMPORT_CHANGED_EVENT = 'purchase-import:changed';
export const PURCHASE_IMPORT_OPEN_EVENT = 'purchase-import:open';

export type PurchaseImportChangedDetail = { importId: string; source: string };
export type PurchaseImportOpenDetail = { importId: string };

export function announcePurchaseImportChange(importId: string, source: string) {
  window.dispatchEvent(
    new CustomEvent<PurchaseImportChangedDetail>(PURCHASE_IMPORT_CHANGED_EVENT, {
      detail: { importId, source },
    })
  );
}

export function openPurchaseImportDrawer(importId: string) {
  window.dispatchEvent(
    new CustomEvent<PurchaseImportOpenDetail>(PURCHASE_IMPORT_OPEN_EVENT, { detail: { importId } })
  );
}
