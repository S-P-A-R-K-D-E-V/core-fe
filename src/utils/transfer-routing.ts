import type {
  IRoutingWhen,
  IRoutingRule,
  IBranchRouting,
  IRoutingAccount,
  ITransferRouting,
  TransferStrategy,
} from 'src/types/online-shop';

// ----------------------------------------------------------------------
// Tài khoản nhận theo kênh — bản TS của TransferAccountPlanner (core-be Application/Payment/Routing/TransferRouting.cs).
// Dùng cho ô "Thử" ở Thanh toán → Cài đặt, ô "Tự chọn" ở quầy và QR tĩnh lúc mất mạng. Sửa thì sửa cả hai bên + bộ ca chung
// (__tests__/transfer-routing-cases.json = core-be CoreCms.Tests/Payment/transfer-routing-cases.json).
// ----------------------------------------------------------------------

export const STRATEGY_LABELS: Record<TransferStrategy, string> = {
  priority: 'Ưu tiên theo thứ tự',
  round_robin: 'Luân phiên',
  weighted: 'Chia theo tỷ lệ',
  cashier: 'Thu ngân tự chọn',
};

export const STRATEGY_HELP: Record<TransferStrategy, string> = {
  priority:
    'Dùng tài khoản đầu tiên tự xác nhận được; hết lượt miễn phí / bị S Payment chặn / kênh báo có lỗi thì sang tài khoản kế tiếp.',
  round_robin: 'Lần lượt từng tài khoản: tài khoản lâu chưa nhận tiền lên trước.',
  weighted: 'Chia tiền nhận trong ngày theo tỷ lệ: tài khoản đang nhận ít hơn phần của mình được chọn trước.',
  cashier: 'Như trước: thu ngân chọn tài khoản ở quầy, mặc định tài khoản đầu danh sách.',
};

export const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export type RoutingStats = {
  /** Lần cuối mỗi tài khoản nhận tiền (ISO / ms) — luân phiên */
  lastUsed?: Record<string, string | number>;
  /** Tiền (hoặc số giao dịch) đã nhận hôm nay — chia tỷ lệ */
  received?: Record<string, number>;
};

export type RoutingContext = {
  amount: number;
  now: Date;
  previousAccountId?: string | null;
  previousRuleId?: string | null;
  stickAcrossRules?: boolean;
};

export type TransferPlan = {
  candidates: string[];
  strategy: TransferStrategy;
  ruleId: string | null;
  ruleName: string | null;
  fallbackId: string | null;
};

export type RoutingCapability = {
  confirmation: 'auto' | 'auto_paid' | 'manual' | string;
  blocked?: string | null;
  down?: boolean;
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Cấu hình áp cho chi nhánh: chi nhánh có cấu hình riêng thì dùng của chi nhánh. */
export function configFor(
  channel: ITransferRouting | null | undefined,
  branches: Record<string, IBranchRouting> | null | undefined,
  branchId: string | null | undefined
): { config: ITransferRouting | null; branchOverride: boolean } {
  const own = branchId ? branches?.[branchId.toLowerCase()]?.transfer ?? branches?.[branchId]?.transfer : null;
  if (own) return { config: own, branchOverride: true };
  return { config: channel ?? null, branchOverride: false };
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Giờ VN của thời điểm `now`: phút trong ngày + thứ (0 = CN). */
export function vnClock(now: Date): { minutes: number; day: number } {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return { minutes: vn.getUTCHours() * 60 + vn.getUTCMinutes(), day: vn.getUTCDay() };
}

export function matches(when: IRoutingWhen | null | undefined, amount: number, now: Date): boolean {
  if (!when) return true;
  if (when.amountMin != null && amount < when.amountMin) return false;
  if (when.amountMax != null && amount >= when.amountMax) return false;
  const { minutes, day } = vnClock(now);
  if (when.days?.length && !when.days.includes(day)) return false;
  if (when.from && when.to) {
    const f = toMinutes(when.from);
    const t = toMinutes(when.to);
    const inside = f <= t ? minutes >= f && minutes < t : minutes >= f || minutes < t;
    if (!inside) return false;
  }
  return true;
}

const time = (v: string | number | undefined) => (v == null ? -Infinity : typeof v === 'number' ? v : Date.parse(v));

/** Sắp ứng viên của một danh sách theo cách chọn (ổn định: bằng nhau giữ thứ tự cấu hình). */
export function orderAccounts(
  accounts: IRoutingAccount[],
  strategy: TransferStrategy | null | undefined,
  stats: RoutingStats = {}
): string[] {
  const indexed = accounts.map((a, i) => ({ a, i }));
  if (strategy === 'round_robin') {
    return indexed
      .sort((x, y) => time(stats.lastUsed?.[x.a.id]) - time(stats.lastUsed?.[y.a.id]) || x.i - y.i)
      .map((x) => x.a.id);
  }
  if (strategy === 'weighted') {
    const totalWeight = accounts.reduce((s, a) => s + Math.max(0, a.weight ?? 0), 0);
    const totalReceived = accounts.reduce((s, a) => s + (stats.received?.[a.id] ?? 0), 0);
    const deficit = (a: IRoutingAccount) => {
      const target = totalWeight > 0 ? Math.max(0, a.weight ?? 0) / totalWeight : 0;
      const actual = totalReceived > 0 ? (stats.received?.[a.id] ?? 0) / totalReceived : 0;
      return Math.round((target - actual) * 1e9) / 1e9;
    };
    return indexed
      .sort((x, y) => deficit(y.a) - deficit(x.a) || (y.a.weight ?? 0) - (x.a.weight ?? 0) || x.i - y.i)
      .map((x) => x.a.id);
  }
  return accounts.map((a) => a.id);
}

/** Quy tắc khớp đầu tiên (có tài khoản) cho hoá đơn — null = không quy tắc nào. */
export function matchingRule(cfg: ITransferRouting, amount: number, now: Date): IRoutingRule | null {
  return (cfg.rules ?? []).find((r) => r.accounts.length > 0 && matches(r.when, amount, now)) ?? null;
}

/** Ứng viên cho một hoá đơn. null = không tự chọn (chưa cấu hình / thu ngân chọn). */
export function planTransfer(
  cfg: ITransferRouting | null | undefined,
  ctx: RoutingContext,
  stats: RoutingStats = {}
): TransferPlan | null {
  if (!cfg || cfg.strategy === 'cashier') return null;
  const rule = matchingRule(cfg, ctx.amount, ctx.now);
  let list: string[] = [];
  let strategy: TransferStrategy;
  if (rule) {
    strategy = rule.strategy ?? 'priority';
    list = orderAccounts(rule.accounts, strategy, stats);
    if (rule.thenDefault) list = list.concat(orderAccounts(cfg.accounts, cfg.strategy, stats));
  } else {
    strategy = cfg.strategy;
    list = orderAccounts(cfg.accounts, cfg.strategy, stats);
  }
  if (cfg.fallbackId) list.push(cfg.fallbackId);
  list = Array.from(new Set(list));

  const prev = ctx.previousAccountId;
  if (prev && list.includes(prev) && (ctx.stickAcrossRules || (ctx.previousRuleId ?? '') === (rule?.id ?? ''))) {
    list = [prev, ...list.filter((id) => id !== prev)];
  }
  return { candidates: list, strategy, ruleId: rule?.id ?? null, ruleName: rule?.name ?? null, fallbackId: cfg.fallbackId ?? null };
}

/**
 * Xếp ứng viên theo khả năng S Payment: tự xác nhận (kênh khoẻ) → tự xác nhận (kênh lỗi) → tính phí → tay; bị chặn thì bỏ (quầy:
 * mọi tài khoản đều bị chặn thì giữ nguyên); online chỉ tài khoản tự xác nhận. capabilities null → giữ thứ tự (online: rỗng).
 */
export function rankCandidates(
  plan: TransferPlan,
  capabilities: Record<string, RoutingCapability> | null | undefined,
  onlineOnly = false
): string[] {
  if (!capabilities) return onlineOnly ? [] : plan.candidates;
  const rankOf = (id: string) => {
    const c = capabilities[id];
    if (!c) return 3;
    if (c.confirmation === 'auto') return c.down ? 1 : 0;
    if (c.confirmation === 'auto_paid') return 2;
    return 3;
  };
  let open = plan.candidates.filter((id) => !capabilities[id]?.blocked);
  if (open.length === 0 && !onlineOnly) open = plan.candidates;
  return open
    .map((id, i) => ({ id, i, rank: rankOf(id) }))
    .filter((x) => !onlineOnly || x.rank < 3)
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map((x) => x.id);
}

/** Tài khoản thu ngân được tự chọn ở quầy (null = mọi tài khoản). */
export function manualPool(cfg: ITransferRouting | null | undefined): Set<string> | null {
  if (!cfg) return null;
  if (cfg.strategy === 'cashier') return cfg.accounts.length ? new Set(cfg.accounts.map((a) => a.id)) : null;
  if (cfg.cashierOverride === 'any') return null;
  const pool = new Set<string>(cfg.accounts.map((a) => a.id));
  (cfg.rules ?? []).forEach((r) => r.accounts.forEach((a) => pool.add(a.id)));
  if (cfg.fallbackId) pool.add(cfg.fallbackId);
  return pool;
}

const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

/** "Hoá đơn ≥ 5.000.000đ · 18:00–22:00 · T7, CN" */
export function whenText(when: IRoutingWhen | null | undefined): string {
  if (!when) return 'Mọi hoá đơn';
  const parts: string[] = [];
  if (when.amountMin != null && when.amountMax != null) parts.push(`Hoá đơn ${money(when.amountMin)} – dưới ${money(when.amountMax)}`);
  else if (when.amountMin != null) parts.push(`Hoá đơn ≥ ${money(when.amountMin)}`);
  else if (when.amountMax != null) parts.push(`Hoá đơn < ${money(when.amountMax)}`);
  if (when.from && when.to) parts.push(`${when.from}–${when.to}`);
  if (when.days?.length) parts.push(when.days.map((d) => DAY_LABELS[d]).join(', '));
  return parts.length ? parts.join(' · ') : 'Mọi hoá đơn';
}

export function strategyShort(s: TransferStrategy | null | undefined): string {
  return s === 'round_robin' ? 'luân phiên' : s === 'weighted' ? 'chia tỷ lệ' : 'ưu tiên';
}

/** Ghi chú ngắn vì sao chọn tài khoản (giống TransferAccountPlanner.Note). */
export function routingNote(plan: TransferPlan, chosen: string, accountLabel: string): string {
  const how = strategyShort(plan.strategy);
  let note = plan.ruleName ? `${plan.ruleName} → ${accountLabel} · ${how}` : `Tự chọn ${accountLabel} · ${how}`;
  if (plan.fallbackId === chosen && plan.candidates.length > 0 && plan.candidates[0] !== chosen) note += ' · dự phòng';
  return note;
}

/** Mọi tài khoản cấu hình nhắc tới (danh sách, quy tắc, dự phòng). */
export function referencedAccounts(cfg: ITransferRouting | null | undefined): string[] {
  if (!cfg) return [];
  const ids = cfg.accounts.map((a) => a.id);
  (cfg.rules ?? []).forEach((r) => r.accounts.forEach((a) => ids.push(a.id)));
  if (cfg.fallbackId) ids.push(cfg.fallbackId);
  return Array.from(new Set(ids));
}
