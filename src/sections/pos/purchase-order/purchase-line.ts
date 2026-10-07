// ----------------------------------------------------------------------
// Dòng phiếu nhập trên form (M7 bước 1). Khớp cách BE tính (PurchaseOrderLines.Price): thành tiền nhập tay thắng đơn giá.
// ----------------------------------------------------------------------

/** Thành tiền trước VAT của dòng: thành tiền nhập tay nếu có, không thì số lượng × đơn giá − chiết khấu. */
export function lineNetOf(item: any): number {
  if (item?.lineTotal !== null && item?.lineTotal !== undefined && item?.lineTotal !== '') {
    return Number(item.lineTotal) || 0;
  }
  const gross = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
  const discount =
    item?.discountType === 'percent' ? gross * ((Number(item?.discountAmount) || 0) / 100) : Number(item?.discountAmount) || 0;
  return gross - discount;
}

