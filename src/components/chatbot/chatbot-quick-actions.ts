import type { ChatbotTier, ChatbotAgent } from 'src/api/chatbot';

// ----------------------------------------------------------------------
// Đối tượng của khung chat (quản trị / nhân viên / khách) + danh mục câu hỏi nhanh theo đối tượng.
// Module thuần (không import React) để test được và để chatbot-commands dùng chung kiểu.
// ----------------------------------------------------------------------

export type ChatbotAudience = 'admin' | 'staff' | 'customer';

type AudienceInput = {
  agent?: ChatbotAgent | null;
  tier?: ChatbotTier | null;
  /** Vai trò đăng nhập — chỉ dùng khi CHƯA có phiên của server. */
  role?: string | null;
  roles?: string[] | null;
};

/**
 * Đối tượng theo PHIÊN của server (tier trước, rồi agent); chưa có phiên thì theo vai trò đăng nhập.
 * Quản lý cửa hàng SaaS (store_manager) hỏi số liệu cửa hàng như chủ cửa hàng → xếp vào "admin"
 * (giống OWNER_TIERS của app mobile), dù agent của phiên là Staff.
 */
export function resolveChatbotAudience(input: AudienceInput): ChatbotAudience {
  switch (input.tier) {
    case 'cici_admin':
    case 'store_admin':
    case 'store_manager':
      return 'admin';
    case 'cici_staff':
      return 'staff';
    case 'cici_customer':
      return 'customer';
    default:
      break; // 'none' / server cũ không trả tier → xét agent
  }

  if (input.agent === 'InternalAdmin') return 'admin';
  if (input.agent === 'Staff') return 'staff';
  if (input.agent === 'CustomerSupport') return 'customer';

  const roles = [input.role, ...(input.roles ?? [])].filter(Boolean) as string[];
  if (roles.includes('Admin')) return 'admin';
  if (roles.includes('Manager') || roles.includes('Staff')) return 'staff';
  return 'customer';
}

/** Tiêu đề + icon của header theo đối tượng. */
export function chatbotHeader(
  audience: ChatbotAudience,
  brandName: string
): { title: string; icon: string } {
  if (audience === 'admin') return { title: 'Trợ lý quản trị', icon: 'solar:crown-bold' };
  if (audience === 'staff') return { title: 'Trợ lý nhân viên', icon: 'solar:user-id-bold' };
  return { title: `${brandName} — Hỗ trợ khách hàng`, icon: 'solar:chat-round-dots-bold' };
}

/** Lời chào lúc chưa có tin nhắn nào. */
export function chatbotGreeting(
  audience: ChatbotAudience,
  brandName: string,
  name?: string | null
): { title: string; description: string } {
  const hello = name && name.trim() ? `Xin chào ${name.trim()}!` : 'Xin chào!';
  if (audience === 'admin') {
    return {
      title: hello,
      description: 'Hỏi nhanh về cửa hàng: doanh thu, tồn kho, nhân viên, ca làm, lương…',
    };
  }
  if (audience === 'staff') {
    return {
      title: hello,
      description: 'Hỏi về công việc của bạn: lịch làm, lương, đăng ký ca và đổi ca.',
    };
  }
  return {
    title: `Chào bạn! ${brandName} ở đây để hỗ trợ.`,
    description: 'Bạn có thể hỏi về sản phẩm, tình trạng còn hàng, địa chỉ và giờ mở cửa…',
  };
}

// ----------------------------------------------------------------------

export type ChatbotQuickAction = {
  id: string;
  label: string;
  /** Câu gửi đi khi bấm. */
  prompt: string;
  icon: string;
  /**
   * Cần số liệu chỉ chủ cửa hàng xem được (doanh thu, quầy tiền, quỹ lương). Quản lý cửa hàng SaaS
   * (tier store_manager) không có công cụ đó (StoreAssistantToolset.AdminOnly) → ẩn.
   */
  ownerOnly?: boolean;
};

export const CHATBOT_QUICK_ACTIONS: Record<ChatbotAudience, ChatbotQuickAction[]> = {
  admin: [
    {
      id: 'revenue-today',
      label: 'Doanh thu hôm nay',
      prompt: 'Doanh thu hôm nay của cửa hàng là bao nhiêu, so với hôm qua thế nào?',
      icon: 'solar:wallet-money-bold-duotone',
      ownerOnly: true,
    },
    {
      id: 'on-shift',
      label: 'Ai đang trong ca',
      prompt: 'Hôm nay những ai làm ca nào?',
      icon: 'solar:users-group-rounded-bold-duotone',
    },
    {
      id: 'cash-counter',
      label: 'Kiểm quầy',
      prompt: 'Tình hình quầy tiền hôm nay: tiền bán hàng, thu chi, số dư dự kiến và chênh lệch?',
      icon: 'solar:calculator-bold-duotone',
      ownerOnly: true,
    },
    {
      id: 'best-sellers',
      label: 'Bán chạy tuần này',
      prompt: 'Top sản phẩm bán chạy 7 ngày qua?',
      icon: 'solar:fire-bold-duotone',
    },
    {
      id: 'late-this-month',
      label: 'Đi trễ tháng này',
      prompt: 'Tháng này ai đi trễ nhiều nhất?',
      icon: 'solar:alarm-bold-duotone',
    },
    {
      id: 'payroll-cycle',
      label: 'Kỳ lương',
      prompt: 'Kỳ lương tháng này đã chốt chưa, tổng quỹ lương bao nhiêu?',
      icon: 'solar:money-bag-bold-duotone',
      ownerOnly: true,
    },
    {
      id: 'shift-registration',
      label: 'Đăng ký ca tuần tới',
      prompt: 'Tình hình đăng ký ca tuần tới thế nào, còn ca nào thiếu người?',
      icon: 'solar:calendar-add-bold-duotone',
    },
  ],
  staff: [
    {
      id: 'my-schedule',
      label: 'Lịch làm của tôi',
      prompt: 'Lịch làm của tôi tuần này?',
      icon: 'solar:calendar-bold-duotone',
    },
    {
      id: 'my-payroll',
      label: 'Lương của tôi',
      prompt: 'Lương tháng này của tôi tạm tính bao nhiêu?',
      icon: 'solar:wallet-money-bold-duotone',
    },
    {
      id: 'open-shifts',
      label: 'Ca còn trống',
      prompt: 'Có ca nào đang cần người nhận không?',
      icon: 'solar:user-hand-up-bold-duotone',
    },
    {
      id: 'register-shift',
      label: 'Đăng ký ca',
      prompt: 'Tôi muốn đăng ký ca tuần sau, còn những ca nào?',
      icon: 'solar:calendar-add-bold-duotone',
    },
    {
      id: 'swap-shift',
      label: 'Đổi ca',
      prompt: 'Tôi muốn đổi ca, cần làm thế nào?',
      icon: 'solar:transfer-horizontal-bold-duotone',
    },
  ],
  customer: [
    {
      id: 'featured-products',
      label: 'Sản phẩm nổi bật',
      prompt: 'Cửa hàng có những sản phẩm nào nổi bật?',
      icon: 'solar:star-bold-duotone',
    },
    {
      id: 'in-stock',
      label: 'Kiểm tra còn hàng',
      prompt: 'Tôi muốn hỏi một sản phẩm còn hàng không',
      icon: 'solar:box-bold-duotone',
    },
    {
      id: 'address-hours',
      label: 'Địa chỉ & giờ mở cửa',
      prompt: 'Địa chỉ và giờ mở cửa của cửa hàng?',
      icon: 'solar:map-point-bold-duotone',
    },
  ],
};

/**
 * "Gọi lại đặt hàng" — chỉ cho khách chưa đăng nhập đã để lại SĐT. Bấm không chỉ gửi câu này: widget
 * gọi thêm POST /chatbot/callback-order để cửa hàng nhận thông báo (xem chatbot-widget).
 */
export const CHATBOT_CALLBACK_ACTION: ChatbotQuickAction = {
  id: 'callback-order',
  label: 'Gọi lại đặt hàng',
  prompt: 'Tôi muốn được gọi lại để đặt hàng',
  icon: 'solar:phone-calling-bold-duotone',
};

/** Câu hỏi nhanh mặc định của đối tượng (đã bỏ câu người hỏi không có công cụ để trả lời). */
export function quickActionsFor(
  audience: ChatbotAudience,
  tier?: ChatbotTier | null
): ChatbotQuickAction[] {
  const actions = CHATBOT_QUICK_ACTIONS[audience];
  return tier === 'store_manager' ? actions.filter((a) => !a.ownerOnly) : actions;
}
