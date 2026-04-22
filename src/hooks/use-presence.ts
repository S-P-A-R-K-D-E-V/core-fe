// Thin selector over Zustand store — presence state is managed by MessengerProvider.
import { useMessengerStore } from 'src/store/messenger-store';

export function usePresence() {
  const users = useMessengerStore((s) => Object.values(s.userCache));
  const onlineIds = useMessengerStore((s) => s.onlineIds);
  const loading = users.length === 0;

  return {
    users: users.map((u) => ({ ...u, online: onlineIds.includes(u.id) })),
    loading,
    onlineCount: onlineIds.length,
    reload: () => {},
  };
}
