import type { ReceiptTemplatePaper } from '../receipt-template-settings';

// ----------------------------------------------------------------------
// Mẫu hoá đơn "soạn theo khối": danh sách khối (logo, đầu cửa hàng, bảng hàng, tổng tiền, QR…) lưu ở `settings.blocks`
// của mẫu. Khi lưu, khối được dịch ra HTML `{{ma}}` (receipt-blocks-compile.ts) và ghi vào `content` — bộ in POS / in khi
// mất mạng đọc `content` như mọi mẫu khác, không biết đến khối.
// Mọi giá trị đọc từ JSON đều được chuẩn hoá (receipt-blocks.ts → normalizeReceiptBlocks): mẫu hỏng vẫn mở được.
// ----------------------------------------------------------------------

export const RECEIPT_BLOCKS_VERSION = 1;

/** Tối đa số khối của một mẫu (Settings ≤ 64 000 ký tự ở core-be). */
export const MAX_RECEIPT_BLOCKS = 80;

/** Chữ tự do tối đa. */
export const MAX_BLOCK_TEXT = 500;

export type BlockAlign = 'left' | 'center' | 'right';

export type BlockRuleStyle = 'dashed' | 'solid' | 'dotted';

export type ItemsLayout = 'auto' | 'twoLine' | 'table4' | 'table5';

type BlockBase = {
  id: string;
  /** Tạm ẩn: giữ cấu hình nhưng không in. */
  hidden: boolean;
  /** Ẩn dòng khi mọi trường của nó rỗng (mặc định); tắt = luôn in dòng đó. */
  hideEmpty: boolean;
  align: BlockAlign;
  /** Cỡ chữ so với cỡ chữ của mẫu (pt): −2 … +8. */
  size: number;
  bold: boolean;
};

export const STORE_LINES = ['name', 'branch', 'address', 'phone', 'taxCode'] as const;
export type StoreLine = (typeof STORE_LINES)[number];

export const INFO_ROWS = [
  'code',
  'date',
  'cashier',
  'customer',
  'customerPhone',
  'channel',
  'note',
] as const;
export type InfoRow = (typeof INFO_ROWS)[number];

export const TOTAL_ROWS = [
  'subtotal',
  'discount',
  'otherCharges',
  'total',
  'inWords',
  'paid',
  'payments',
  'cashTendered',
  'changeDue',
  'remaining',
  'itemCount',
  'totalQuantity',
] as const;
export type TotalRow = (typeof TOTAL_ROWS)[number];

export const ITEM_COLUMNS = ['no', 'code', 'unit', 'discount', 'note'] as const;
export type ItemColumn = (typeof ITEM_COLUMNS)[number];

export const TRANSFER_LINES = ['bank', 'accountNumber', 'accountName', 'content'] as const;
export type TransferLine = (typeof TRANSFER_LINES)[number];

export const PURCHASE_INFO_ROWS = [
  'code',
  'date',
  'supplier',
  'supplierCode',
  'supplierPhone',
  'supplierAddress',
  'warehouse',
  'createdBy',
  'status',
  'note',
] as const;
export type PurchaseInfoRow = (typeof PURCHASE_INFO_ROWS)[number];

export const PURCHASE_TOTAL_ROWS = [
  'subtotal',
  'discount',
  'vat',
  'total',
  'inWords',
  'paid',
  'debt',
  'itemCount',
  'totalQuantity',
] as const;
export type PurchaseTotalRow = (typeof PURCHASE_TOTAL_ROWS)[number];

/** Loại chứng từ soạn được theo khối (tem mã có trình thiết kế riêng). */
export type BlockDocumentKind = 'receipt' | 'purchase';

export type ReceiptBlock = BlockBase &
  (
    | { type: 'logo'; widthPct: number }
    | { type: 'storeHeader'; lines: Record<StoreLine, boolean> }
    | { type: 'title'; text: string; showCancelled: boolean }
    | { type: 'invoiceInfo'; rows: Record<InfoRow, boolean> }
    | { type: 'items'; layout: ItemsLayout; cols: Record<ItemColumn, boolean>; header: boolean }
    | { type: 'totals'; rows: Record<TotalRow, boolean>; emphasizeTotal: boolean }
    | { type: 'payments'; showReference: boolean; showTime: boolean }
    | { type: 'transferQr'; caption: string; lines: Record<TransferLine, boolean> }
    | { type: 'code'; kind: 'barcode' | 'qr'; showCode: boolean }
    | { type: 'text'; text: string }
    | { type: 'divider'; style: BlockRuleStyle }
    | { type: 'spacer'; lines: number }
    | { type: 'image'; src: string; widthPct: number }
    | { type: 'footer'; showFooter: boolean; showPrintedAt: boolean }
    | { type: 'purchaseInfo'; rows: Record<PurchaseInfoRow, boolean> }
    | { type: 'purchaseTotals'; rows: Record<PurchaseTotalRow, boolean>; emphasizeTotal: boolean }
    | { type: 'signatures'; left: string; right: string; showNote: boolean; lines: number }
  );

export type ReceiptBlockType = ReceiptBlock['type'];

export type BlockOf<T extends ReceiptBlockType> = Extract<ReceiptBlock, { type: T }>;

export type ReceiptBlocks = { v: number; items: ReceiptBlock[] };

// ── Nhãn ─────────────────────────────────────────────────────────────────

export const STORE_LINE_LABELS: Record<StoreLine, string> = {
  name: 'Tên cửa hàng',
  branch: 'Tên chi nhánh',
  address: 'Địa chỉ',
  phone: 'Điện thoại',
  taxCode: 'Mã số thuế',
};

export const INFO_ROW_LABELS: Record<InfoRow, string> = {
  code: 'Mã hoá đơn',
  date: 'Ngày giờ bán',
  cashier: 'Thu ngân',
  customer: 'Khách hàng',
  customerPhone: 'SĐT khách',
  channel: 'Kênh bán',
  note: 'Ghi chú hoá đơn',
};

export const TOTAL_ROW_LABELS: Record<TotalRow, string> = {
  subtotal: 'Tổng tiền hàng',
  discount: 'Giảm giá',
  otherCharges: 'Thu khác',
  total: 'Khách cần trả',
  inWords: 'Bằng chữ',
  paid: 'Khách đã trả',
  payments: 'Từng khoản thu',
  cashTendered: 'Tiền khách đưa',
  changeDue: 'Tiền thừa trả khách',
  remaining: 'Còn phải trả',
  itemCount: 'Số mặt hàng',
  totalQuantity: 'Tổng số lượng',
};

export const PURCHASE_INFO_ROW_LABELS: Record<PurchaseInfoRow, string> = {
  code: 'Mã phiếu',
  date: 'Ngày nhập',
  supplier: 'Nhà cung cấp',
  supplierCode: 'Mã NCC',
  supplierPhone: 'SĐT NCC',
  supplierAddress: 'Địa chỉ NCC',
  warehouse: 'Kho nhập',
  createdBy: 'Người nhập',
  status: 'Trạng thái',
  note: 'Ghi chú phiếu',
};

export const PURCHASE_TOTAL_ROW_LABELS: Record<PurchaseTotalRow, string> = {
  subtotal: 'Tổng tiền hàng',
  discount: 'Giảm giá',
  vat: 'Thuế VAT',
  total: 'Cần trả NCC',
  inWords: 'Bằng chữ',
  paid: 'Đã trả NCC',
  debt: 'Còn nợ NCC',
  itemCount: 'Số mặt hàng',
  totalQuantity: 'Tổng số lượng',
};

export const ITEM_COLUMN_LABELS: Record<ItemColumn, string> = {
  no: 'STT',
  code: 'Mã hàng',
  unit: 'Đơn vị tính',
  discount: 'Giảm giá dòng',
  note: 'Ghi chú món',
};

export const TRANSFER_LINE_LABELS: Record<TransferLine, string> = {
  bank: 'Ngân hàng',
  accountNumber: 'Số tài khoản',
  accountName: 'Tên tài khoản',
  content: 'Nội dung chuyển khoản',
};

export const ITEMS_LAYOUT_LABELS: Record<ItemsLayout, string> = {
  auto: 'Tự động theo khổ giấy',
  twoLine: 'Mỗi món 2 dòng (giấy cuộn)',
  table4: 'Bảng 4 cột',
  table5: 'Bảng nhiều cột (A5 / A4)',
};

export const RULE_STYLE_LABELS: Record<BlockRuleStyle, string> = {
  dashed: 'Nét đứt',
  solid: 'Nét liền',
  dotted: 'Chấm',
};

export type BlockTypeInfo = { label: string; icon: string; hint: string };

export const BLOCK_TYPES: Record<ReceiptBlockType, BlockTypeInfo> = {
  logo: { label: 'Logo cửa hàng', icon: 'solar:gallery-bold', hint: 'Khi in lấy logo hiện tại' },
  storeHeader: { label: 'Đầu cửa hàng', icon: 'solar:shop-bold', hint: 'Tên, chi nhánh, địa chỉ, ĐT, MST' },
  title: { label: 'Tiêu đề phiếu', icon: 'solar:text-bold', hint: 'PHIẾU THANH TOÁN, dấu ĐÃ HUỶ' },
  invoiceInfo: { label: 'Thông tin hoá đơn', icon: 'solar:document-text-bold', hint: 'Mã, ngày, thu ngân, khách' },
  items: { label: 'Bảng hàng', icon: 'solar:box-bold', hint: 'Tự lặp cho từng món' },
  totals: { label: 'Tổng tiền', icon: 'solar:calculator-bold-duotone', hint: 'Tổng, giảm giá, cần trả, đã trả' },
  payments: { label: 'Các khoản thu', icon: 'solar:card-bold', hint: 'Mỗi khoản thu một dòng' },
  transferQr: { label: 'QR chuyển khoản', icon: 'solar:qr-code-bold', hint: 'VietQR số tiền còn phải trả' },
  code: { label: 'Mã vạch / QR hoá đơn', icon: 'solar:barcode-bold', hint: 'Quét để tra hoá đơn' },
  text: { label: 'Chữ tự do', icon: 'solar:pen-bold', hint: 'Chèn được trường {…}' },
  divider: { label: 'Kẻ ngang', icon: 'eva:minus-fill', hint: 'Nét đứt / liền / chấm' },
  spacer: { label: 'Khoảng trống', icon: 'mingcute:minimize-line', hint: '1–4 dòng trống' },
  image: { label: 'Ảnh', icon: 'solar:gallery-add-bold', hint: 'Ảnh tải lên (PNG, JPEG, WebP)' },
  footer: { label: 'Lời chào cuối phiếu', icon: 'solar:heart-bold', hint: 'Lời chào + thời điểm in' },
  purchaseInfo: { label: 'Thông tin phiếu nhập', icon: 'solar:document-text-bold', hint: 'Mã, ngày, NCC, kho, người nhập' },
  purchaseTotals: { label: 'Tổng tiền phiếu nhập', icon: 'solar:calculator-bold-duotone', hint: 'Tổng, VAT, cần trả, còn nợ NCC' },
  signatures: { label: 'Chữ ký', icon: 'solar:pen-new-square-bold', hint: 'Người giao / người nhận' },
};

/** Khối của từng loại chứng từ, theo thứ tự ở cột "Khối". */
export const BLOCK_TYPE_ORDERS: Record<BlockDocumentKind, ReceiptBlockType[]> = {
  receipt: [
    'logo',
    'storeHeader',
    'title',
    'invoiceInfo',
    'items',
    'totals',
    'payments',
    'transferQr',
    'code',
    'text',
    'divider',
    'spacer',
    'image',
    'footer',
  ],
  purchase: [
    'logo',
    'storeHeader',
    'title',
    'purchaseInfo',
    'items',
    'purchaseTotals',
    'signatures',
    'code',
    'text',
    'divider',
    'spacer',
    'image',
  ],
};

export const BLOCK_TYPE_ORDER = BLOCK_TYPE_ORDERS.receipt;

/** Nhãn / gợi ý riêng của phiếu nhập cho khối dùng chung. */
const PURCHASE_BLOCK_INFO: Partial<Record<ReceiptBlockType, Partial<BlockTypeInfo>>> = {
  title: { hint: 'PHIẾU NHẬP HÀNG, dấu ĐÃ HUỶ' },
  storeHeader: { hint: 'Tên, chi nhánh nhập, địa chỉ, ĐT, MST' },
  items: { hint: 'Tự lặp cho từng dòng hàng' },
  code: { label: 'Mã vạch / QR mã phiếu', hint: 'Quét để tra phiếu nhập' },
};

export function blockTypeInfo(type: ReceiptBlockType, kind: BlockDocumentKind = 'receipt'): BlockTypeInfo {
  return kind === 'purchase' ? { ...BLOCK_TYPES[type], ...PURCHASE_BLOCK_INFO[type] } : BLOCK_TYPES[type];
}

// ── Tạo khối ─────────────────────────────────────────────────────────────

let seq = 0;

export function newBlockId(): string {
  seq += 1;
  return `b${Date.now().toString(36)}${seq.toString(36)}`;
}

const all = <K extends string>(keys: readonly K[], on: boolean, except: K[] = []) =>
  Object.fromEntries(keys.map((key) => [key, except.includes(key) ? !on : on])) as Record<
    K,
    boolean
  >;

const BASE = { hidden: false, hideEmpty: true, align: 'left', size: 0, bold: false } as const;

/** Khối mới với thiết lập mặc định (ghi đè được bằng `patch`). */
export function createBlock<T extends ReceiptBlockType>(
  type: T,
  patch: Partial<Omit<BlockOf<T>, 'type'>> = {}
): BlockOf<T> {
  const defaults: { [K in ReceiptBlockType]: Omit<BlockOf<K>, keyof BlockBase> } = {
    logo: { type: 'logo', widthPct: 40 },
    storeHeader: { type: 'storeHeader', lines: all(STORE_LINES, true) },
    title: { type: 'title', text: '{{invoice_title}}', showCancelled: true },
    invoiceInfo: {
      type: 'invoiceInfo',
      rows: all(INFO_ROWS, true, ['channel']),
    },
    items: {
      type: 'items',
      layout: 'auto',
      cols: { no: false, code: false, unit: true, discount: true, note: true },
      header: true,
    },
    totals: {
      type: 'totals',
      rows: all(TOTAL_ROWS, true, ['inWords', 'itemCount', 'totalQuantity']),
      emphasizeTotal: true,
    },
    payments: { type: 'payments', showReference: false, showTime: false },
    transferQr: {
      type: 'transferQr',
      caption: 'Quét mã để chuyển khoản',
      lines: all(TRANSFER_LINES, true),
    },
    code: { type: 'code', kind: 'barcode', showCode: true },
    text: { type: 'text', text: 'Đổi hàng trong 3 ngày kèm hoá đơn' },
    divider: { type: 'divider', style: 'dashed' },
    spacer: { type: 'spacer', lines: 1 },
    image: { type: 'image', src: '', widthPct: 60 },
    footer: { type: 'footer', showFooter: true, showPrintedAt: true },
    purchaseInfo: {
      type: 'purchaseInfo',
      rows: all(PURCHASE_INFO_ROWS, true, ['supplierCode', 'supplierAddress', 'status']),
    },
    purchaseTotals: {
      type: 'purchaseTotals',
      rows: all(PURCHASE_TOTAL_ROWS, true, ['inWords', 'itemCount', 'totalQuantity']),
      emphasizeTotal: true,
    },
    signatures: {
      type: 'signatures',
      left: 'Người giao hàng',
      right: 'Người nhận hàng',
      showNote: true,
      lines: 4,
    },
  };
  const centered: ReceiptBlockType[] = ['logo', 'storeHeader', 'title', 'transferQr', 'code', 'text', 'image', 'footer', 'signatures'];
  const sizes: Partial<Record<ReceiptBlockType, number>> = { storeHeader: 0, title: 2 };
  return {
    ...BASE,
    id: newBlockId(),
    align: centered.includes(type) ? 'center' : 'left',
    size: sizes[type] ?? 0,
    bold: type === 'title',
    ...structuredCloneSafe(defaults[type]),
    ...patch,
  } as unknown as BlockOf<T>;
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Bản sao của khối (mã mới). */
export function duplicateBlock(block: ReceiptBlock): ReceiptBlock {
  return { ...structuredCloneSafe(block), id: newBlockId() };
}

// ── Mẫu khởi đầu ─────────────────────────────────────────────────────────

export type ReceiptBlockStarter = {
  key: string;
  label: string;
  paper: ReceiptTemplatePaper;
  build: () => ReceiptBlock[];
};

export const RECEIPT_BLOCK_STARTERS: ReceiptBlockStarter[] = [
  {
    key: 'roll80',
    label: 'Giấy cuộn 80 mm đầy đủ',
    paper: '80',
    build: () => [
      createBlock('logo'),
      createBlock('storeHeader'),
      createBlock('title'),
      createBlock('divider'),
      createBlock('invoiceInfo'),
      createBlock('divider'),
      createBlock('items'),
      createBlock('divider'),
      createBlock('totals'),
      createBlock('transferQr'),
      createBlock('divider'),
      createBlock('footer'),
    ],
  },
  {
    key: 'roll58',
    label: 'Giấy cuộn 58 mm gọn',
    paper: '58',
    build: () => [
      createBlock('storeHeader', {
        lines: { name: true, branch: false, address: true, phone: true, taxCode: false },
      }),
      createBlock('title', { size: 1 }),
      createBlock('invoiceInfo', {
        rows: {
          code: true,
          date: true,
          cashier: false,
          customer: true,
          customerPhone: false,
          channel: false,
          note: false,
        },
      }),
      createBlock('divider'),
      createBlock('items', {
        cols: { no: false, code: false, unit: false, discount: true, note: false },
      }),
      createBlock('divider'),
      createBlock('totals', {
        rows: {
          subtotal: true,
          discount: true,
          otherCharges: false,
          total: true,
          inWords: false,
          paid: true,
          payments: false,
          cashTendered: false,
          changeDue: true,
          remaining: true,
          itemCount: false,
          totalQuantity: false,
        },
      }),
      createBlock('transferQr', {
        lines: { bank: false, accountNumber: true, accountName: false, content: false },
      }),
      createBlock('footer', { showPrintedAt: false }),
    ],
  },
  {
    key: 'a5',
    label: 'A5 có bảng hàng',
    paper: 'A5',
    build: () => [
      createBlock('logo', { widthPct: 20, align: 'left' }),
      createBlock('storeHeader', { align: 'left' }),
      createBlock('title', { size: 4, align: 'center' }),
      createBlock('invoiceInfo'),
      createBlock('items', {
        layout: 'table5',
        cols: { no: true, code: true, unit: true, discount: true, note: true },
      }),
      createBlock('totals', {
        rows: {
          subtotal: true,
          discount: true,
          otherCharges: true,
          total: true,
          inWords: true,
          paid: true,
          payments: true,
          cashTendered: false,
          changeDue: false,
          remaining: true,
          itemCount: true,
          totalQuantity: true,
        },
      }),
      createBlock('code'),
      createBlock('spacer'),
      createBlock('text', { text: 'Người mua hàng                    Người bán hàng', hideEmpty: false }),
      createBlock('spacer', { lines: 3 }),
      createBlock('footer'),
    ],
  },
];

export const PURCHASE_BLOCK_STARTERS: ReceiptBlockStarter[] = [
  {
    key: 'purchaseA4',
    label: 'A4 có bảng hàng + chữ ký',
    paper: 'A4',
    build: () => [
      createBlock('logo', { widthPct: 15, align: 'left' }),
      createBlock('storeHeader', { align: 'left' }),
      createBlock('title', { size: 4, align: 'center' }),
      createBlock('purchaseInfo', {
        rows: {
          code: true,
          date: true,
          supplier: true,
          supplierCode: false,
          supplierPhone: true,
          supplierAddress: true,
          warehouse: true,
          createdBy: true,
          status: false,
          note: true,
        },
      }),
      createBlock('items', {
        layout: 'table5',
        cols: { no: true, code: true, unit: true, discount: true, note: true },
      }),
      createBlock('purchaseTotals', {
        rows: {
          subtotal: true,
          discount: true,
          vat: true,
          total: true,
          inWords: true,
          paid: true,
          debt: true,
          itemCount: false,
          totalQuantity: true,
        },
      }),
      createBlock('spacer'),
      createBlock('signatures'),
    ],
  },
  {
    key: 'purchase80',
    label: 'Giấy cuộn 80 mm',
    paper: '80',
    build: () => [
      createBlock('storeHeader', {
        lines: { name: true, branch: true, address: false, phone: false, taxCode: false },
      }),
      createBlock('title', { size: 1 }),
      createBlock('divider'),
      createBlock('purchaseInfo', {
        rows: {
          code: true,
          date: true,
          supplier: true,
          supplierCode: false,
          supplierPhone: false,
          supplierAddress: false,
          warehouse: false,
          createdBy: true,
          status: false,
          note: true,
        },
      }),
      createBlock('divider'),
      createBlock('items', {
        cols: { no: false, code: false, unit: true, discount: true, note: false },
      }),
      createBlock('divider'),
      createBlock('purchaseTotals', {
        rows: {
          subtotal: true,
          discount: true,
          vat: true,
          total: true,
          inWords: false,
          paid: true,
          debt: true,
          itemCount: false,
          totalQuantity: false,
        },
      }),
      createBlock('signatures', { lines: 3 }),
    ],
  },
];

export const BLOCK_STARTERS: Record<BlockDocumentKind, ReceiptBlockStarter[]> = {
  receipt: RECEIPT_BLOCK_STARTERS,
  purchase: PURCHASE_BLOCK_STARTERS,
};

/** Bố cục của mẫu khởi đầu `key` (tìm ở mọi loại); không có → mẫu khởi đầu đầu tiên của `kind`. */
export function starterBlocks(
  key: string,
  kind: BlockDocumentKind = 'receipt'
): { paper: ReceiptTemplatePaper; items: ReceiptBlock[] } {
  const starter =
    [...RECEIPT_BLOCK_STARTERS, ...PURCHASE_BLOCK_STARTERS].find((s) => s.key === key) ??
    BLOCK_STARTERS[kind][0];
  return { paper: starter.paper, items: starter.build() };
}

// ── Đọc từ JSON ──────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const num = (value: unknown, min: number, max: number, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const text = (value: unknown, fallback: string) =>
  typeof value === 'string' ? value.slice(0, MAX_BLOCK_TEXT) : fallback;

const flags = <K extends string>(value: unknown, keys: readonly K[], fallback: Record<K, boolean>) => {
  const raw = isObject(value) ? value : {};
  return Object.fromEntries(keys.map((key) => [key, bool(raw[key], fallback[key])])) as Record<
    K,
    boolean
  >;
};

/** Một khối từ JSON; loại lạ → null (bỏ qua). */
export function normalizeBlock(input: unknown): ReceiptBlock | null {
  if (!isObject(input)) return null;
  const type = input.type as ReceiptBlockType;
  if (!(type in BLOCK_TYPES)) return null;
  const d = createBlock(type) as ReceiptBlock;
  const base: BlockBase = {
    id: typeof input.id === 'string' && input.id.length <= 40 && input.id ? input.id : d.id,
    hidden: bool(input.hidden, false),
    hideEmpty: bool(input.hideEmpty, true),
    align: oneOf(input.align, ['left', 'center', 'right'] as const, d.align),
    size: num(input.size, -2, 8, d.size),
    bold: bool(input.bold, d.bold),
  };
  switch (d.type) {
    case 'logo':
      return { ...base, type: d.type, widthPct: num(input.widthPct, 10, 100, d.widthPct) };
    case 'storeHeader':
      return { ...base, type: d.type, lines: flags(input.lines, STORE_LINES, d.lines) };
    case 'title':
      return {
        ...base,
        type: d.type,
        text: text(input.text, d.text),
        showCancelled: bool(input.showCancelled, d.showCancelled),
      };
    case 'invoiceInfo':
      return { ...base, type: d.type, rows: flags(input.rows, INFO_ROWS, d.rows) };
    case 'items':
      return {
        ...base,
        type: d.type,
        layout: oneOf(input.layout, ['auto', 'twoLine', 'table4', 'table5'] as const, d.layout),
        cols: flags(input.cols, ITEM_COLUMNS, d.cols),
        header: bool(input.header, d.header),
      };
    case 'totals':
      return {
        ...base,
        type: d.type,
        rows: flags(input.rows, TOTAL_ROWS, d.rows),
        emphasizeTotal: bool(input.emphasizeTotal, d.emphasizeTotal),
      };
    case 'payments':
      return {
        ...base,
        type: d.type,
        showReference: bool(input.showReference, d.showReference),
        showTime: bool(input.showTime, d.showTime),
      };
    case 'transferQr':
      return {
        ...base,
        type: d.type,
        caption: text(input.caption, d.caption),
        lines: flags(input.lines, TRANSFER_LINES, d.lines),
      };
    case 'code':
      return {
        ...base,
        type: d.type,
        kind: oneOf(input.kind, ['barcode', 'qr'] as const, d.kind),
        showCode: bool(input.showCode, d.showCode),
      };
    case 'text':
      return { ...base, type: d.type, text: text(input.text, '') };
    case 'divider':
      return { ...base, type: d.type, style: oneOf(input.style, ['dashed', 'solid', 'dotted'] as const, d.style) };
    case 'spacer':
      return { ...base, type: d.type, lines: num(input.lines, 1, 4, d.lines) };
    case 'image':
      return {
        ...base,
        type: d.type,
        src: typeof input.src === 'string' ? input.src.slice(0, 500) : '',
        widthPct: num(input.widthPct, 10, 100, d.widthPct),
      };
    case 'footer':
      return {
        ...base,
        type: d.type,
        showFooter: bool(input.showFooter, d.showFooter),
        showPrintedAt: bool(input.showPrintedAt, d.showPrintedAt),
      };
    case 'purchaseInfo':
      return { ...base, type: d.type, rows: flags(input.rows, PURCHASE_INFO_ROWS, d.rows) };
    case 'purchaseTotals':
      return {
        ...base,
        type: d.type,
        rows: flags(input.rows, PURCHASE_TOTAL_ROWS, d.rows),
        emphasizeTotal: bool(input.emphasizeTotal, d.emphasizeTotal),
      };
    case 'signatures':
      return {
        ...base,
        type: d.type,
        left: text(input.left, d.left).slice(0, 60),
        right: text(input.right, d.right).slice(0, 60),
        showNote: bool(input.showNote, d.showNote),
        lines: num(input.lines, 1, 8, d.lines),
      };
    default:
      return null;
  }
}

/**
 * `settings` của mẫu (chuỗi JSON hoặc đối tượng) → bố cục khối, hoặc null khi mẫu không soạn theo khối (soạn tự do / mẫu
 * cũ). Khối lạ bị bỏ; mã khối trùng được đặt lại.
 */
export function readReceiptBlocks(settings: unknown): ReceiptBlocks | null {
  let raw: unknown = settings;
  if (typeof settings === 'string') {
    try {
      raw = JSON.parse(settings || '{}');
    } catch {
      return null;
    }
  }
  if (!isObject(raw) || !isObject(raw.blocks) || !Array.isArray(raw.blocks.items)) return null;
  const seen = new Set<string>();
  const items = raw.blocks.items
    .slice(0, MAX_RECEIPT_BLOCKS)
    .map(normalizeBlock)
    .filter((block): block is ReceiptBlock => !!block)
    .map((block) => {
      if (!seen.has(block.id)) {
        seen.add(block.id);
        return block;
      }
      const id = newBlockId();
      seen.add(id);
      return { ...block, id };
    });
  return { v: RECEIPT_BLOCKS_VERSION, items };
}
