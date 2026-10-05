import type { ChatbotAudience } from './chatbot-quick-actions';

// ----------------------------------------------------------------------
// Lệnh gõ nhanh "/…" của khung chat. Module thuần (không import React) để test được.
//
//   - Lệnh cục bộ (local): chạy ngay ở trình duyệt, không gửi gì cho trợ lý.
//   - Lệnh câu hỏi (prompt): nhận một tham số tự do tuỳ chọn; khi gửi thì ĐỔI THÀNH câu hỏi tiếng
//     Việt bình thường — trợ lý (và bong bóng của người dùng) chỉ thấy câu đã đổi, không thấy "/…".
//   - Chữ bắt đầu bằng "/" mà không khớp lệnh nào → gửi như tin nhắn thường (expandCommand trả null).
// ----------------------------------------------------------------------

export type ChatbotLocalCommandId = 'new-session' | 'toggle-expand' | 'copy-session' | 'help';

type CommandBase = {
  /** Tên lệnh, không có dấu "/". Chỉ chữ thường không dấu. */
  name: string;
  aliases?: string[];
  /** Tên hiển thị trong danh sách. */
  title: string;
  /** Mô tả ngắn — cũng được dùng để lọc. */
  description: string;
  /** Gợi ý tham số tự do, vd "[khoảng thời gian]". Không có = lệnh không cần tham số. */
  argHint?: string;
  icon: string;
};

export type ChatbotLocalCommand = CommandBase & { kind: 'local'; id: ChatbotLocalCommandId };

export type ChatbotPromptCommand = CommandBase & {
  kind: 'prompt';
  /** Dựng câu hỏi từ tham số (đã trim, có thể rỗng). */
  build: (arg: string) => string;
};

export type ChatbotCommand = ChatbotLocalCommand | ChatbotPromptCommand;

export type ChatbotCommandResult =
  | { kind: 'local'; id: ChatbotLocalCommandId }
  | { kind: 'prompt'; text: string };

// ---------------------------------------------------------------------- tiện ích chuỗi

/** Bỏ dấu tiếng Việt + đưa về chữ thường ("Đi Trễ" → "di tre"). */
export function foldDiacritics(input: string): string {
  return input.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}

/** Viết hoa chữ đầu — tham số đứng đầu câu ("ngày mai những ai…" → "Ngày mai những ai…"). */
function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase('vi') + text.slice(1) : text;
}

/** Lệnh không khai báo tham số mà người dùng vẫn gõ thêm chữ → nối vào sau câu hỏi, không vứt đi. */
function withNote(base: string, arg: string): string {
  return arg ? `${base} ${arg}` : base;
}

export type ParsedSlashInput = {
  /** Chữ ngay sau "/" tới khoảng trắng đầu tiên (có thể rỗng khi mới gõ "/"). */
  token: string;
  /** Phần còn lại sau tên lệnh, đã trim. */
  arg: string;
  /** Đã gõ khoảng trắng sau tên lệnh (đang ở phần tham số). */
  hasArg: boolean;
};

/** Tách "/tên tham số…". Không bắt đầu bằng "/" → null. */
export function parseSlashInput(input: string): ParsedSlashInput | null {
  const text = input.replace(/^\s+/, '');
  if (!text.startsWith('/')) return null;
  const match = /^(\S*)(\s+([\s\S]*))?$/.exec(text.slice(1));
  if (!match) return null;
  return { token: match[1], arg: (match[3] ?? '').trim(), hasArg: match[2] !== undefined };
}

// ---------------------------------------------------------------------- danh mục

const LOCAL_COMMANDS: ChatbotLocalCommand[] = [
  {
    kind: 'local',
    id: 'new-session',
    name: 'moi',
    aliases: ['new'],
    title: 'Trò chuyện mới',
    description: 'Bắt đầu một cuộc trò chuyện mới',
    icon: 'solar:pen-new-square-bold',
  },
  {
    kind: 'local',
    id: 'toggle-expand',
    name: 'morong',
    aliases: ['expand'],
    title: 'Mở rộng / thu nhỏ khung chat',
    description: 'Đổi kích thước khung chat',
    icon: 'eva:expand-fill',
  },
  {
    kind: 'local',
    id: 'copy-session',
    name: 'phien',
    title: 'Sao chép mã phiên',
    description: 'Chép mã phiên trò chuyện để gửi khi cần hỗ trợ',
    icon: 'solar:copy-bold',
  },
  {
    kind: 'local',
    id: 'help',
    name: 'trogiup',
    aliases: ['help'],
    title: 'Xem danh sách lệnh',
    description: 'Hiện tất cả lệnh gõ nhanh',
    icon: 'solar:question-circle-bold',
  },
];

const PROMPT_COMMANDS: Record<ChatbotAudience, ChatbotPromptCommand[]> = {
  admin: [
    {
      kind: 'prompt',
      name: 'doanhthu',
      title: 'Doanh thu',
      description: 'Doanh thu của cửa hàng (mặc định hôm nay)',
      argHint: '[khoảng thời gian]',
      icon: 'solar:wallet-money-bold-duotone',
      build: (arg) => `Doanh thu ${arg || 'hôm nay'} của cửa hàng là bao nhiêu?`,
    },
    {
      kind: 'prompt',
      name: 'banchay',
      title: 'Sản phẩm bán chạy',
      description: 'Top sản phẩm bán chạy (mặc định 7 ngày qua)',
      argHint: '[kỳ]',
      icon: 'solar:fire-bold-duotone',
      build: (arg) => `Top sản phẩm bán chạy ${arg || '7 ngày qua'}?`,
    },
    {
      kind: 'prompt',
      name: 'tonkho',
      title: 'Tồn kho',
      description: 'Tồn kho của một mặt hàng, hoặc những mặt hàng sắp hết',
      argHint: '[tên hoặc mã hàng]',
      icon: 'solar:box-bold-duotone',
      build: (arg) => (arg ? `Tồn kho của ${arg}?` : 'Những sản phẩm nào sắp hết hàng?'),
    },
    {
      kind: 'prompt',
      name: 'kiemquay',
      title: 'Kiểm quầy',
      description: 'Tiền bán hàng, thu chi, số dư dự kiến và chênh lệch của quầy',
      argHint: '[ngày]',
      icon: 'solar:calculator-bold-duotone',
      build: (arg) =>
        `Tình hình quầy tiền ${arg || 'hôm nay'}: tiền bán hàng, thu chi, số dư dự kiến và chênh lệch?`,
    },
    {
      kind: 'prompt',
      name: 'calam',
      title: 'Ca làm',
      description: 'Những ai làm ca nào (mặc định hôm nay)',
      argHint: '[ngày]',
      icon: 'solar:users-group-rounded-bold-duotone',
      build: (arg) => `${capitalize(arg) || 'Hôm nay'} những ai làm ca nào?`,
    },
    {
      kind: 'prompt',
      name: 'ditre',
      title: 'Đi trễ',
      description: 'Ai đi trễ nhiều nhất (mặc định tháng này)',
      argHint: '[kỳ]',
      icon: 'solar:alarm-bold-duotone',
      build: (arg) => `Ai đi trễ nhiều nhất ${arg || 'tháng này'}?`,
    },
    {
      kind: 'prompt',
      name: 'luong',
      title: 'Kỳ lương',
      description: 'Kỳ lương đã chốt chưa, tổng quỹ lương (mặc định tháng này)',
      argHint: '[kỳ]',
      icon: 'solar:money-bag-bold-duotone',
      build: (arg) => `Kỳ lương ${arg || 'tháng này'} đã chốt chưa, tổng quỹ lương bao nhiêu?`,
    },
    {
      kind: 'prompt',
      name: 'dangkyca',
      title: 'Đăng ký ca',
      description: 'Tình hình đăng ký ca tuần tới, ca nào còn thiếu người',
      icon: 'solar:calendar-add-bold-duotone',
      build: (arg) =>
        withNote('Tình hình đăng ký ca tuần tới thế nào, còn ca nào thiếu người?', arg),
    },
    {
      kind: 'prompt',
      name: 'congno',
      title: 'Công nợ',
      description: 'Khách nào đang nợ nhiều nhất',
      icon: 'solar:bill-list-bold-duotone',
      build: (arg) => withNote('Khách nào đang nợ nhiều nhất?', arg),
    },
    {
      kind: 'prompt',
      name: 'chiphi',
      title: 'Chi phí',
      description: 'Các khoản chi phí (mặc định tháng này)',
      argHint: '[kỳ]',
      icon: 'solar:cash-out-bold-duotone',
      build: (arg) => `Chi phí ${arg || 'tháng này'} gồm những khoản nào?`,
    },
  ],
  staff: [
    {
      kind: 'prompt',
      name: 'lichlam',
      title: 'Lịch làm của tôi',
      description: 'Lịch làm của bạn (mặc định tuần này)',
      argHint: '[tuần]',
      icon: 'solar:calendar-bold-duotone',
      build: (arg) => `Lịch làm của tôi ${arg || 'tuần này'}?`,
    },
    {
      kind: 'prompt',
      name: 'luong',
      title: 'Lương của tôi',
      description: 'Lương tạm tính của bạn (mặc định tháng này)',
      argHint: '[tháng]',
      icon: 'solar:wallet-money-bold-duotone',
      build: (arg) => `Lương ${arg || 'tháng này'} của tôi tạm tính bao nhiêu?`,
    },
    {
      kind: 'prompt',
      name: 'dangkyca',
      title: 'Đăng ký ca',
      description: 'Xem những ca còn đăng ký được tuần sau',
      icon: 'solar:calendar-add-bold-duotone',
      build: (arg) => withNote('Tôi muốn đăng ký ca tuần sau, còn những ca nào?', arg),
    },
    {
      kind: 'prompt',
      name: 'doica',
      title: 'Đổi ca',
      description: 'Hỏi cách đổi ca',
      icon: 'solar:transfer-horizontal-bold-duotone',
      build: (arg) => withNote('Tôi muốn đổi ca, cần làm thế nào?', arg),
    },
    {
      kind: 'prompt',
      name: 'catrong',
      title: 'Ca còn trống',
      description: 'Những ca đang cần người nhận',
      icon: 'solar:user-hand-up-bold-duotone',
      build: (arg) => withNote('Có ca nào đang cần người nhận không?', arg),
    },
  ],
  customer: [
    {
      kind: 'prompt',
      name: 'sanpham',
      title: 'Sản phẩm',
      description: 'Tìm sản phẩm theo từ khoá, hoặc xem sản phẩm nổi bật',
      argHint: '[từ khoá]',
      icon: 'solar:star-bold-duotone',
      build: (arg) =>
        arg
          ? `Cửa hàng có những sản phẩm nào về ${arg}?`
          : 'Cửa hàng có những sản phẩm nào nổi bật?',
    },
    {
      kind: 'prompt',
      name: 'conhang',
      title: 'Kiểm tra còn hàng',
      description: 'Hỏi một sản phẩm còn hàng không',
      argHint: '[tên sản phẩm]',
      icon: 'solar:box-bold-duotone',
      build: (arg) =>
        arg ? `Sản phẩm ${arg} còn hàng không?` : 'Tôi muốn hỏi một sản phẩm còn hàng không',
    },
    {
      kind: 'prompt',
      name: 'diachi',
      title: 'Địa chỉ & giờ mở cửa',
      description: 'Địa chỉ và giờ mở cửa của cửa hàng',
      icon: 'solar:map-point-bold-duotone',
      build: (arg) => withNote('Địa chỉ và giờ mở cửa của cửa hàng?', arg),
    },
  ],
};

/** Toàn bộ lệnh của một đối tượng: lệnh câu hỏi trước, lệnh cục bộ sau. */
export function commandsFor(audience: ChatbotAudience): ChatbotCommand[] {
  return [...PROMPT_COMMANDS[audience], ...LOCAL_COMMANDS];
}

/** Cách gõ lệnh: "/doanhthu [khoảng thời gian]". */
export function commandUsage(command: ChatbotCommand): string {
  return command.argHint ? `/${command.name} ${command.argHint}` : `/${command.name}`;
}

// ---------------------------------------------------------------------- lọc + đổi lệnh

function isExactMatch(command: ChatbotCommand, foldedToken: string): boolean {
  return command.name === foldedToken || (command.aliases ?? []).includes(foldedToken);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
    if (haystack[j] === needle[i]) i += 1;
  }
  return i === needle.length;
}

/** Điểm khớp (nhỏ = khớp hơn); null = không khớp. */
function matchScore(command: ChatbotCommand, query: string): number | null {
  const aliases = command.aliases ?? [];
  if (command.name === query) return 0;
  if (aliases.includes(query)) return 1;
  if (command.name.startsWith(query)) return 2;
  if (aliases.some((a) => a.startsWith(query))) return 3;
  if (command.name.includes(query)) return 4;
  if (aliases.some((a) => a.includes(query))) return 5;

  const text = foldDiacritics(`${command.title} ${command.description}`);
  if (text.includes(query) || text.replace(/\s+/g, '').includes(query)) return 6;

  // Bộ gõ Telex nuốt một số phím khi gõ tên lệnh không dấu ("/ditre" thành "/dỉte", "/morong" thành
  // "/mỏong") → bỏ dấu xong vẫn thiếu chữ. Cho khớp lỏng: cùng chữ đầu + các chữ còn lại đúng thứ tự.
  if (query.length >= 3 && command.name[0] === query[0] && isSubsequence(query, command.name)) {
    return 7;
  }
  return null;
}

/**
 * Danh sách lệnh gợi ý cho chữ đang gõ.
 *   - Không bắt đầu bằng "/" → [].
 *   - "/": tất cả lệnh của đối tượng.
 *   - "/abc" (chưa có khoảng trắng): lọc theo tên, tên tắt, tên hiển thị và mô tả — không phân biệt
 *     hoa thường, có dấu hay không dấu.
 *   - "/abc xyz" (đang gõ tham số): chỉ lệnh có tên / tên tắt đúng bằng "abc" (để hiện gợi ý tham số).
 */
export function filterCommands(input: string, audience: ChatbotAudience): ChatbotCommand[] {
  const parsed = parseSlashInput(input);
  if (!parsed) return [];

  const all = commandsFor(audience);
  const query = foldDiacritics(parsed.token);
  if (parsed.hasArg) return query ? all.filter((c) => isExactMatch(c, query)) : [];
  if (!query) return all;

  return all
    .map((command, index) => ({ command, index, score: matchScore(command, query) }))
    .filter((x): x is { command: ChatbotCommand; index: number; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((x) => x.command);
}

/** Lệnh có tên / tên tắt đúng bằng chữ sau "/" (không phân biệt hoa thường / dấu). */
export function findCommand(input: string, audience: ChatbotAudience): ChatbotCommand | null {
  const parsed = parseSlashInput(input);
  if (!parsed || !parsed.token) return null;
  const query = foldDiacritics(parsed.token);
  return commandsFor(audience).find((c) => isExactMatch(c, query)) ?? null;
}

/**
 * Đổi chữ người dùng gửi thành việc cần làm:
 *   - lệnh cục bộ → { kind: 'local', id } (chạy ở trình duyệt);
 *   - lệnh câu hỏi → { kind: 'prompt', text } với text là câu hỏi tiếng Việt đầy đủ;
 *   - không phải lệnh (kể cả "/…" lạ, hoặc lệnh của đối tượng khác) → null: gửi nguyên văn.
 */
export function expandCommand(
  input: string,
  audience: ChatbotAudience
): ChatbotCommandResult | null {
  const command = findCommand(input, audience);
  if (!command) return null;
  if (command.kind === 'local') return { kind: 'local', id: command.id };
  const arg = parseSlashInput(input)?.arg ?? '';
  return { kind: 'prompt', text: command.build(arg) };
}
