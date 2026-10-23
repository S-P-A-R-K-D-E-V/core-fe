// Cho phép các section khác (vd CTA "Chat ngay với CiCi AI" ở trang chủ) mở widget từ xa —
// widget là component global độc lập, không có context/store dùng chung nên dùng custom event.
// Tách riêng khỏi chatbot-widget.tsx để trang chủ dùng hằng này mà không kéo cả widget vào bundle đầu.
export const OPEN_CHATBOT_EVENT = 'cici:open-chat';
