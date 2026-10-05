// Thin selector over Zustand store — presence state is managed by MessengerProvider.
import { useMessengerStore } from 'src/store/messenger-store';
import { isSystemUserId, excludeSystemUsers } from 'src/utils/messenger-system';

export function usePresence() {
  // IMPORTANT: selectors must return stable references.
  // Object.values() inside a selector creates a new array on every call,
  // which causes useSyncExternalStore to see perpetual "tearing" → infinite re-render.
  const userCache = useMessengerStore((s) => s.userCache);
  const onlineIds = useMessengerStore((s) => s.onlineIds);

  // Object.values() is computed in render, NOT inside the selector.
  const cached = Object.values(userCache);
  const loading = cached.length === 0;
  // Người gửi hệ thống ("Trợ lý hệ thống") nằm trong danh bạ chỉ để hiện tên ở tin cảnh báo — không phải người
  // để nhắn tin (core-be từ chối mở chat riêng với nó) nên không có trong danh sách người dùng / đang online.
  const users = excludeSystemUsers(cached);

  return {
    users: users.map((u) => ({ ...u, online: onlineIds.includes(u.id) })),
    loading,
    onlineCount: onlineIds.filter((id) => !isSystemUserId(id)).length,
    reload: () => {},
  };
}
