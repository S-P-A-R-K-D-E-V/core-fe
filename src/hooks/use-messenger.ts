// Thin facade — state lives in Zustand store (src/store/messenger-store.ts).
// Components import from store directly; this hook provides convenient actions.

import { useCallback } from 'react';

import { openPrivateConversation, createGroupConversation } from 'src/api/messenger';
import { useMessengerStore } from 'src/store/messenger-store';
import { useMessengerCtx } from 'src/components/messenger/messenger-provider';

// ----------------------------------------------------------------------

export function useMessenger() {
  const store = useMessengerStore();
  const { openConversation, sendTyping } = useMessengerCtx();

  const startPrivateChat = useCallback(async (otherUserId: string) => {
    const conv = await openPrivateConversation(otherUserId);
    store.openQuickChat(conv.id);
    return conv;
  }, [store]);

  const createGroup = useCallback(async (name: string | null, memberIds: string[]) => {
    const conv = await createGroupConversation(name, memberIds);
    return conv;
  }, []);

  return {
    conversations: store.conversations,
    userCache: store.userCache,
    onlineIds: store.onlineIds,
    openConversation,
    sendTyping,
    startPrivateChat,
    createGroup,
    openQuickChat: store.openQuickChat,
  };
}
