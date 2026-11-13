import type {
  IRoutingRule,
  IBranchRouting,
  IPaymentChannels,
  ITransferRouting,
  TransferStrategy,
} from 'src/types/online-shop';
import type { IKiotVietBankAccount, IPosAccountCapability } from 'src/types/corecms-api';

import { STRATEGY_LABELS, type RoutingCapability } from 'src/utils/transfer-routing';

// ----------------------------------------------------------------------
// Bản nháp của tab "Tài khoản nhận theo kênh" (thuần — test được). Phạm vi: "pos" (quầy, mọi chi nhánh), "branch:{id}"
// (chi nhánh có cấu hình riêng), "online".
// ----------------------------------------------------------------------

export type RoutingDraft = {
  pos: ITransferRouting | null;
  online: ITransferRouting | null;
  branches: Record<string, ITransferRouting>;
};

export const BRANCH_PREFIX = 'branch:';

export function routingDraft(data: IPaymentChannels): RoutingDraft {
  const branches: Record<string, ITransferRouting> = {};
  Object.entries(data.pos.branches ?? {}).forEach(([id, b]) => {
    if (b.transfer) branches[id] = b.transfer;
  });
  return { pos: data.pos.transfer ?? null, online: data.online.transfer ?? null, branches };
}

export function scopeConfig(draft: RoutingDraft, scope: string): ITransferRouting | null {
  if (scope === 'pos') return draft.pos;
  if (scope === 'online') return draft.online;
  return draft.branches[scope.slice(BRANCH_PREFIX.length)] ?? null;
}

export function setScope(draft: RoutingDraft, scope: string, cfg: ITransferRouting | null): RoutingDraft {
  if (scope === 'pos') return { ...draft, pos: cfg };
  if (scope === 'online') return { ...draft, online: cfg };
  const id = scope.slice(BRANCH_PREFIX.length);
  const branches = { ...draft.branches };
  if (cfg) branches[id] = cfg;
  else delete branches[id];
  return { ...draft, branches };
}

/** Cấu hình khởi đầu khi chủ cửa hàng chọn một cách chọn lần đầu: tài khoản tự xác nhận trước, dự phòng = tài khoản tay / cuối. */
export function initialConfig(
  strategy: TransferStrategy,
  accounts: IKiotVietBankAccount[],
  capabilities: Record<string, IPosAccountCapability>,
  online: boolean
): ITransferRouting {
  const auto = accounts.filter((a) => capabilities[a.id]?.confirmation === 'auto');
  const list = (auto.length ? auto : accounts).filter((a) => !online || capabilities[a.id]?.confirmation !== 'manual');
  const manual = accounts.find((a) => capabilities[a.id]?.confirmation === 'manual');
  const fallback = online ? null : (manual ?? list[list.length - 1] ?? accounts[0])?.id ?? null;
  return {
    strategy,
    accounts: list.filter((a) => a.id !== fallback || list.length === 1).map((a) => ({ id: a.id, weight: strategy === 'weighted' ? 50 : null })),
    rules: [],
    fallbackId: fallback,
    cashierOverride: online ? null : 'pool',
    weightBasis: 'amount',
  };
}

/** Đổi cách chọn (giữ danh sách); chọn "Thu ngân tự chọn" ở quầy chung = bỏ cấu hình (như trước). */
export function changeStrategy(cfg: ITransferRouting, strategy: TransferStrategy): ITransferRouting {
  return {
    ...cfg,
    strategy,
    accounts: cfg.accounts.map((a) => ({ ...a, weight: strategy === 'weighted' ? a.weight ?? 50 : a.weight })),
  };
}

/** Tích / bỏ tài khoản trong danh sách của phạm vi (thêm vào cuối). */
export function toggleAccount(cfg: ITransferRouting, id: string): ITransferRouting {
  const has = cfg.accounts.some((a) => a.id === id);
  return {
    ...cfg,
    accounts: has
      ? cfg.accounts.filter((a) => a.id !== id)
      : [...cfg.accounts, { id, weight: cfg.strategy === 'weighted' ? 50 : null }],
  };
}

export function moveAccount(cfg: ITransferRouting, from: number, to: number): ITransferRouting {
  if (to < 0 || to >= cfg.accounts.length || from === to) return cfg;
  const accounts = [...cfg.accounts];
  const [item] = accounts.splice(from, 1);
  accounts.splice(to, 0, item);
  return { ...cfg, accounts };
}

export function setWeight(cfg: ITransferRouting, id: string, weight: number): ITransferRouting {
  return { ...cfg, accounts: cfg.accounts.map((a) => (a.id === id ? { ...a, weight: Math.max(0, Math.round(weight)) } : a)) };
}

export function upsertRule(cfg: ITransferRouting, rule: IRoutingRule): ITransferRouting {
  const rules = cfg.rules ?? [];
  const i = rules.findIndex((r) => r.id === rule.id);
  return { ...cfg, rules: i >= 0 ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule] };
}

export function removeRule(cfg: ITransferRouting, id: string): ITransferRouting {
  return { ...cfg, rules: (cfg.rules ?? []).filter((r) => r.id !== id) };
}

export function newRuleId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Lỗi chặn lưu (máy chủ cũng kiểm) — null = được. */
export function draftProblem(cfg: ITransferRouting | null, online: boolean): string | null {
  if (!cfg || cfg.strategy === 'cashier') return null;
  if (cfg.accounts.length === 0) return 'Chọn ít nhất một tài khoản nhận.';
  if (!online && !cfg.fallbackId) return 'Quầy cần một tài khoản dự phòng.';
  if (cfg.strategy === 'weighted' && cfg.accounts.reduce((s, a) => s + (a.weight ?? 0), 0) <= 0)
    return 'Nhập tỷ lệ cho các tài khoản.';
  return null;
}

/** Gửi lên máy chủ: quầy "thu ngân chọn" không danh sách = bỏ cấu hình. */
export function payloadOf(cfg: ITransferRouting | null): ITransferRouting | null {
  if (!cfg) return null;
  if (cfg.strategy === 'cashier' && cfg.accounts.length === 0) return null;
  return cfg;
}

export function branchesPayload(draft: RoutingDraft): Record<string, IBranchRouting> | null {
  const entries = Object.entries(draft.branches);
  return entries.length ? Object.fromEntries(entries.map(([id, transfer]) => [id, { transfer }])) : null;
}

/** Khả năng tài khoản (nhãn ở quầy) → dạng hàm xếp hạng dùng. */
export function routingCapabilities(capabilities: Record<string, IPosAccountCapability>): Record<string, RoutingCapability> | null {
  const entries = Object.entries(capabilities);
  if (entries.length === 0) return null;
  return Object.fromEntries(
    entries.map(([id, c]) => [id, { confirmation: c.confirmation }])
  );
}

export function accountLabel(a: IKiotVietBankAccount | undefined): string {
  if (!a) return 'Tài khoản đã tắt';
  const n = (a.accountNumber ?? '').trim();
  return `${a.shortName || a.bankName || a.code || 'TK'} …${n.length > 4 ? n.slice(-4) : n}`;
}

/** Chủ tài khoản "chính" (tài khoản mặc định, không thì chủ xuất hiện nhiều nhất) — để cảnh báo tài khoản đứng tên người khác. */
export function primaryHolder(accounts: IKiotVietBankAccount[]): string | null {
  const def = accounts.find((a) => a.isDefault && a.accountHolder)?.accountHolder;
  if (def) return def.trim().toUpperCase();
  const counts = new Map<string, number>();
  accounts.forEach((a) => {
    const h = a.accountHolder?.trim().toUpperCase();
    if (h) counts.set(h, (counts.get(h) ?? 0) + 1);
  });
  let best: string | null = null;
  counts.forEach((n, h) => {
    if (!best || n > (counts.get(best) ?? 0)) best = h;
  });
  return best;
}

export function isOtherHolder(a: IKiotVietBankAccount | undefined, primary: string | null): boolean {
  const h = a?.accountHolder?.trim().toUpperCase();
  return !!primary && !!h && h !== primary;
}

/** "Quầy: ưu tiên · 3 TK + dự phòng · Online: luân phiên · 2 TK" — tóm tắt dòng chuyển khoản theo tài khoản. */
export function routingSummary(data: IPaymentChannels): string {
  const one = (label: string, view: IPaymentChannels['pos'], online: boolean) => {
    const t = view.transfer;
    const branches = Object.keys(view.branches ?? {}).length;
    const extra = branches ? ` (+${branches} chi nhánh riêng)` : '';
    if (!t || t.strategy === 'cashier')
      return `${label}: ${online ? 'mọi tài khoản tự xác nhận' : 'thu ngân chọn'}${extra}`;
    const rules = t.rules?.length ? ` · ${t.rules.length} quy tắc` : '';
    return `${label}: ${STRATEGY_LABELS[t.strategy].toLowerCase()} · ${t.accounts.length} TK${t.fallbackId ? ' + dự phòng' : ''}${rules}${extra}`;
  };
  const parts = [one('Quầy', data.pos, false)];
  if (data.paymentServiceEnabled) parts.push(one('Online', data.online, true));
  return parts.join(' · ');
}
