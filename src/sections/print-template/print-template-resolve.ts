import { PRINT_ANY } from 'src/types/print-template';

import type {
  PrintChannel,
  IPrintTemplate,
  PrintTemplateKind,
  PrintPaymentMethod,
  IPrintTemplateList,
} from 'src/types/print-template';

// ----------------------------------------------------------------------
// Chọn mẫu đang áp dụng cho một lần in: ô (kênh, phương thức) → (kênh, *) → (*, phương thức) → (*, *). Không ô nào khớp
// (hoặc mẫu của ô đã bị xoá) → null = in bằng mẫu hệ thống. Kênh / phương thức lạ coi như không rõ.
// ----------------------------------------------------------------------

export const PRINT_CHANNELS: { value: PrintChannel; label: string }[] = [
  { value: 'pos', label: 'Bán tại quầy' },
  { value: 'fnb', label: 'F&B (nhà hàng, quán)' },
  { value: 'online', label: 'Đơn online' },
];

export const PRINT_PAYMENT_METHODS: { value: PrintPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Tiền mặt' },
  { value: 'transfer', label: 'Chuyển khoản' },
  { value: 'card', label: 'Thẻ' },
  { value: 'wallet', label: 'Ví điện tử' },
  { value: 'voucher', label: 'Voucher' },
];

export const PRINT_KIND_LABEL: Record<PrintTemplateKind, string> = {
  receipt: 'Hoá đơn',
  label: 'Tem mã',
};

export function asPrintChannel(value: string | null | undefined): PrintChannel | null {
  return PRINT_CHANNELS.some((channel) => channel.value === value) ? (value as PrintChannel) : null;
}

export function asPrintPaymentMethod(value: string | null | undefined): PrintPaymentMethod | null {
  return PRINT_PAYMENT_METHODS.some((method) => method.value === value)
    ? (value as PrintPaymentMethod)
    : null;
}

export function resolveAppliedTemplate(
  list: IPrintTemplateList | null | undefined,
  kind: PrintTemplateKind,
  channel?: string | null,
  paymentMethod?: string | null
): IPrintTemplate | null {
  if (!list) return null;
  const knownChannel = kind === 'receipt' ? asPrintChannel(channel) : null;
  const knownMethod = kind === 'receipt' ? asPrintPaymentMethod(paymentMethod) : null;

  const candidates: Array<[string, string]> = [];
  if (knownChannel && knownMethod) candidates.push([knownChannel, knownMethod]);
  if (knownChannel) candidates.push([knownChannel, PRINT_ANY]);
  if (knownMethod) candidates.push([PRINT_ANY, knownMethod]);
  candidates.push([PRINT_ANY, PRINT_ANY]);

  const byId = new Map(list.templates.filter((t) => t.kind === kind).map((t) => [t.id, t]));
  for (let i = 0; i < candidates.length; i += 1) {
    const [c, m] = candidates[i];
    const cell = list.assignments.find(
      (a) => a.kind === kind && a.channel === c && a.paymentMethod === m
    );
    const template = cell ? byId.get(cell.templateId) : undefined;
    if (template) return template;
  }
  return null;
}
