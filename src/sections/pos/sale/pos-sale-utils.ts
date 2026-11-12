import type { IProductChild, IProductListItem } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Tiện ích thuần của màn bán hàng (POS bán lẻ): quét mã vạch / gõ mã rồi Enter, ô số lượng.
// ----------------------------------------------------------------------

export type ScannedProduct = { product: IProductListItem; child?: IProductChild };

const same = (a: string | null | undefined, code: string) => !!a && a.trim().toLowerCase() === code;

/**
 * Mã quét / gõ + Enter khớp ĐÚNG mã hàng, SKU hoặc mã vạch của một sản phẩm (hoặc một phiên bản con — thêm thẳng phiên
 * bản đó). Không khớp đúng mà kết quả tìm chỉ có một sản phẩm → lấy sản phẩm đó. Còn lại: null (để thu ngân chọn).
 */
export function findScannedProduct(
  items: IProductListItem[],
  rawCode: string
): ScannedProduct | null {
  const code = rawCode.trim().toLowerCase();
  if (!code) return null;

  const matchesCode = (p: { code?: string; sku?: string; barCode?: string; barcode?: string }) =>
    same(p.code, code) || same(p.sku, code) || same(p.barCode, code) || same(p.barcode, code);

  const childMatches: ScannedProduct[] = [];
  for (const product of items) {
    for (const child of product.childProducts ?? []) {
      if (matchesCode(child)) childMatches.push({ product, child });
    }
  }
  // Mã của phiên bản con cụ thể hơn mã sản phẩm cha.
  if (childMatches.length === 1) return childMatches[0];

  const exact = items.filter(matchesCode);
  if (exact.length === 1) return { product: exact[0] };

  if (childMatches.length === 0 && exact.length === 0 && items.length === 1)
    return { product: items[0] };
  return null;
}

// ----------------------------------------------------------------------
// Khoản thu gửi lên khi tạo hoá đơn
// ----------------------------------------------------------------------

export const CASH_METHOD = 'Cash';

export type PaymentInput = { method: string; amount: number; transactionRef?: string };

export type SettledPayments = {
  /** Khoản thu gửi lên: tiền mặt chỉ còn đúng phần khách phải trả (phần thừa là tiền thối, không phải doanh thu). */
  payments: PaymentInput[];
  /** Tiền mặt khách đưa — chỉ có khi khách đưa nhiều hơn phần tiền mặt phải trả. */
  cashTendered?: number;
  /** Tiền thối trả khách. */
  change: number;
  /** Σ khoản thu gửi lên. */
  paid: number;
};

/**
 * Tách tiền khách đưa khỏi khoản thu: trước đây khách đưa 500.000 cho hoá đơn 320.000 thì khoản tiền mặt ghi 500.000 —
 * cửa hàng nối KiotViet lưu nguyên số đó, doanh thu tiền mặt / két bị phóng đại. Khoản không phải tiền mặt (chuyển
 * khoản, thẻ, ví) giữ nguyên số đã thu; tiền mặt = min(khách đưa, số còn phải trả sau các khoản kia).
 */
export function settlePayments(due: number, lines: PaymentInput[]): SettledPayments {
  const positive = lines.filter((l) => l.amount > 0);
  const isCash = (l: PaymentInput) => l.method === CASH_METHOD;
  const nonCashPaid = positive.filter((l) => !isCash(l)).reduce((s, l) => s + l.amount, 0);
  const cashLines = positive.filter(isCash);
  const cashGiven = cashLines.reduce((s, l) => s + l.amount, 0);
  const cashAmount = Math.min(cashGiven, Math.max(0, due - nonCashPaid));

  const payments: PaymentInput[] = [];
  positive.forEach((l) => {
    if (!isCash(l)) payments.push(l);
    // Gộp các dòng tiền mặt thành một, đặt ở vị trí dòng tiền mặt đầu tiên.
    else if (l === cashLines[0] && cashAmount > 0)
      payments.push({ method: CASH_METHOD, amount: cashAmount, transactionRef: l.transactionRef });
  });

  return {
    payments,
    cashTendered: cashAmount > 0 && cashGiven > cashAmount ? cashGiven : undefined,
    change: cashGiven - cashAmount,
    paid: nonCashPaid + cashAmount,
  };
}

/**
 * Nút "số tiền nhanh" cho tiền mặt khách đưa: đúng tiền, rồi làm tròn lên các mệnh giá hay gặp (10k, 50k, 100k, 200k,
 * 500k) — chỉ số ≥ số phải trả, không trùng, tối đa `limit` nút.
 */
export function quickCashAmounts(due: number, limit = 5): number[] {
  if (!(due > 0)) return [];
  const roundUp = (step: number) => Math.ceil(due / step) * step;
  const candidates = [due, roundUp(10000), roundUp(50000), roundUp(100000), roundUp(200000), roundUp(500000)];
  return candidates.filter((v, i) => v >= due && candidates.indexOf(v) === i).slice(0, limit);
}

// ----------------------------------------------------------------------
// Mã chống trùng hoá đơn (clientRequestId)
// ----------------------------------------------------------------------

/** Lần gửi gần nhất của một giỏ: mã chống trùng + "dấu" nội dung giỏ lúc gửi. Lưu cùng đơn tạm (sống qua tải lại). */
export type PendingSaleRequest = { id: string; fingerprint: string };

export type SaleFingerprintInput = {
  customerId?: string;
  warehouseId?: string;
  discount: number;
  items: { productId: string; productVariantId?: string; quantity: number; price: number; discount: number }[];
};

/**
 * "Dấu" nội dung hoá đơn — KHÔNG gồm khoản thu: lần trước hết thời gian chờ mà máy chủ đã lưu, thu ngân đổi sang trả
 * tiền mặt rồi bấm lại thì vẫn là cùng một lần bán (máy chủ trả lại hoá đơn đã tạo, không tạo thêm).
 */
export function saleFingerprint(input: SaleFingerprintInput): string {
  return JSON.stringify([
    input.customerId ?? '',
    input.warehouseId ?? '',
    input.discount,
    input.items.map((i) => [i.productId, i.productVariantId ?? '', i.quantity, i.price, i.discount]),
  ]);
}

/** Dùng lại mã của lần gửi trước nếu giỏ không đổi (gửi lại sau lỗi mạng); giỏ đã đổi → mã mới. */
export function saleRequestFor(
  pending: PendingSaleRequest | undefined,
  fingerprint: string,
  makeId: () => string
): PendingSaleRequest {
  return pending && pending.fingerprint === fingerprint ? pending : { id: makeId(), fingerprint };
}

/**
 * Máy chủ đã trả lời từ chối (4xx, lỗi có `status`) → chắc chắn chưa có hoá đơn, bỏ mã. Mất mạng / hết thời gian chờ /
 * 5xx / cổng trả HTML → không biết máy chủ đã lưu chưa → giữ mã để lần bấm lại không tạo hoá đơn thứ hai.
 */
export function isDefinitiveRejection(error: unknown): boolean {
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500;
}

// ----------------------------------------------------------------------
// Giảm giá hoá đơn
// ----------------------------------------------------------------------

/** Giảm giá hoá đơn theo tiền: số nguyên, 0 … tổng tiền hàng (máy chủ từ chối giảm vượt tổng). */
export function clampOrderDiscount(amount: number, subTotal: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(Math.min(amount, Math.max(0, subTotal)));
}

/** Giảm giá hoá đơn theo %: 0 … 100, tiền giảm làm tròn tới đồng. */
export function percentDiscount(percent: number, subTotal: number): { percent: number; amount: number } {
  const p = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return { percent: p, amount: clampOrderDiscount((Math.max(0, subTotal) * p) / 100, subTotal) };
}

/** Ô số lượng: chỉ nhận số nguyên ≥ 1; ô trống / 0 trong lúc gõ không xoá dòng hàng (xoá bằng nút thùng rác). */
export function parseQuantityInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 1 ? n : null;
}
