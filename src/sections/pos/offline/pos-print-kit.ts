import type { IPrintTemplateList } from 'src/types/print-template';
import type {
  ISalesOrderReceipt,
  IKiotVietBankAccount,
  ISalesOrderReceiptStore,
  ISalesOrderReceiptBranch,
} from 'src/types/corecms-api';

import { openPosStore, type PosKvStore } from './pos-store';

// ----------------------------------------------------------------------
// "Bộ in" lưu trên máy — đủ để in phiếu khi mất mạng (docs/cici/plans/pos-offline-plan.md mục 3.6):
// - thông tin cửa hàng + lời chào cuối phiếu: lấy từ phiếu gần nhất máy chủ trả về (đúng thứ máy chủ sẽ in);
// - mẫu in hoá đơn của cửa hàng (Mẫu in);
// - tài khoản nhận chuyển khoản dựng được VietQR (QR tĩnh khi mất mạng).
// ----------------------------------------------------------------------

export type PrintKit = {
  store: ISalesOrderReceiptStore | null;
  branch: ISalesOrderReceiptBranch | null;
  footer: string | null;
  templates: IPrintTemplateList | null;
  bankAccounts: IKiotVietBankAccount[];
  savedAt: string | null;
};

const KIT_ID = 'printKit';
type KitRecord = PrintKit & { id: string };

export const EMPTY_PRINT_KIT: PrintKit = {
  store: null,
  branch: null,
  footer: null,
  templates: null,
  bankAccounts: [],
  savedAt: null,
};

let metaStore: Promise<PosKvStore<KitRecord>> | null = null;
const store = () => {
  if (!metaStore) metaStore = openPosStore<KitRecord>('meta');
  return metaStore;
};

export async function loadPrintKit(): Promise<PrintKit> {
  try {
    const found = (await (await store()).getAll()).find((r) => r.id === KIT_ID);
    if (!found) return { ...EMPTY_PRINT_KIT };
    const { id, ...kit } = found;
    return { ...EMPTY_PRINT_KIT, ...kit };
  } catch {
    return { ...EMPTY_PRINT_KIT };
  }
}

/** Ghi đè các phần có trong `patch`, giữ phần còn lại. */
export async function savePrintKit(patch: Partial<PrintKit>): Promise<PrintKit> {
  const next = { ...(await loadPrintKit()), ...patch, savedAt: new Date().toISOString() };
  try {
    await (await store()).put({ id: KIT_ID, ...next });
  } catch (err) {
    console.warn('Không lưu được bộ in trên máy', err);
  }
  return next;
}

/** Phiếu máy chủ vừa trả về → nhớ thông tin cửa hàng / lời chào cho lần in khi mất mạng. */
export function rememberReceiptForKit(receipt: ISalesOrderReceipt): Promise<PrintKit> {
  return savePrintKit({ store: receipt.store, branch: receipt.branch, footer: receipt.footer });
}

type KitApi = {
  getPrintTemplates: () => Promise<IPrintTemplateList>;
  latestReceipt: () => Promise<ISalesOrderReceipt | null>;
  bankAccounts: () => Promise<IKiotVietBankAccount[]>;
};

/** Tải lại bộ in khi có mạng; phần nào lỗi thì giữ bản đã lưu của phần đó. */
export async function refreshPrintKit(api: KitApi): Promise<PrintKit> {
  const [templates, receipt, bankAccounts] = await Promise.allSettled([
    api.getPrintTemplates(),
    api.latestReceipt(),
    api.bankAccounts(),
  ]);
  const patch: Partial<PrintKit> = {};
  if (templates.status === 'fulfilled') patch.templates = templates.value;
  if (receipt.status === 'fulfilled' && receipt.value) {
    patch.store = receipt.value.store;
    patch.branch = receipt.value.branch;
    patch.footer = receipt.value.footer;
  }
  if (bankAccounts.status === 'fulfilled') patch.bankAccounts = bankAccounts.value;
  return Object.keys(patch).length > 0 ? savePrintKit(patch) : loadPrintKit();
}
