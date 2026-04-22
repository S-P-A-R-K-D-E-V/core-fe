// Thin selector over Zustand store — presence state is managed by MessengerProvider.
import { useMessengerStore } from 'src/store/messenger-store';

export function usePresence() {
  // IMPORTANT: selectors must return stable references.
  // Object.values() inside a selector creates a new array on every call,
  // which causes useSyncExternalStore to see perpetual "tearing" → infinite re-render.
  const userCache = useMessengerStore((s) => s.userCache);
  const onlineIds = useMessengerStore((s) => s.onlineIds);

  // Object.values() is computed in render, NOT inside the selector.
  const users = Object.values(userCache);
  const loading = users.length === 0;

  return {
    users: users.map((u) => ({ ...u, online: onlineIds.includes(u.id) })),
    loading,
    onlineCount: onlineIds.length,
    reload: () => {},
  };
}
