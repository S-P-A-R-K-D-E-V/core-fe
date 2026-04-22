import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type { ConversationSummary, DirectMessage, InternalUser } from 'src/api/messenger';

// ----------------------------------------------------------------------

export type QuickChatNotif = {
  id: string;
  convId: string;
  senderName: string;
  preview: string;
  at: number; // Date.now()
};

type State = {
  conversations: ConversationSummary[];
  messagesByConv: Record<string, DirectMessage[]>;
  /** convId → Set of userIds currently typing */
  typingByConv: Record<string, string[]>;
  /** userId → InternalUser (name/avatar cache) */
  userCache: Record<string, InternalUser>;
  onlineIds: string[];
  /** Open quick-chat windows (max 3, bottom-right stack) */
  openQuickChats: string[];
  /** Floating notification toasts */
  notifQueue: QuickChatNotif[];
};

type Actions = {
  setConversations: (list: ConversationSummary[]) => void;
  touchConversation: (ev: {
    conversationId: string;
    lastMessagePreview: string | null;
    lastMessageSenderId: string | null;
    lastMessageAt: string | null;
    incrementsUnreadForSelf: boolean;
  }) => void;
  updateConversation: (patch: Partial<ConversationSummary> & { id: string }) => void;

  setMessages: (convId: string, msgs: DirectMessage[]) => void;
  prependMessages: (convId: string, msgs: DirectMessage[]) => void;
  addMessage: (msg: DirectMessage) => void;
  applyReadReceipt: (convId: string, userId: string, readAt: string) => void;
  clearUnread: (convId: string) => void;

  setTyping: (convId: string, userId: string, active: boolean) => void;

  setUserCache: (users: InternalUser[]) => void;
  setOnline: (userId: string, online: boolean) => void;

  openQuickChat: (convId: string) => void;
  closeQuickChat: (convId: string) => void;

  pushNotif: (n: Omit<QuickChatNotif, 'id' | 'at'>) => void;
  dismissNotif: (id: string) => void;
};

export const useMessengerStore = create<State & Actions>()(
  immer((set) => ({
    conversations: [],
    messagesByConv: {},
    typingByConv: {},
    userCache: {},
    onlineIds: [],
    openQuickChats: [],
    notifQueue: [],

    setConversations: (list) =>
      set((s) => {
        s.conversations = list;
      }),

    touchConversation: (ev) =>
      set((s) => {
        const idx = s.conversations.findIndex((c) => c.id === ev.conversationId);
        if (idx >= 0) {
          s.conversations[idx].lastMessagePreview = ev.lastMessagePreview;
          s.conversations[idx].lastMessageSenderId = ev.lastMessageSenderId;
          s.conversations[idx].lastMessageAt = ev.lastMessageAt;
          if (ev.incrementsUnreadForSelf) s.conversations[idx].unreadCount += 1;
          // Bubble to top
          const [conv] = s.conversations.splice(idx, 1);
          s.conversations.unshift(conv);
        }
      }),

    updateConversation: (patch) =>
      set((s) => {
        const idx = s.conversations.findIndex((c) => c.id === patch.id);
        if (idx >= 0) Object.assign(s.conversations[idx], patch);
      }),

    setMessages: (convId, msgs) =>
      set((s) => {
        s.messagesByConv[convId] = msgs;
      }),

    prependMessages: (convId, msgs) =>
      set((s) => {
        const existing = s.messagesByConv[convId] ?? [];
        s.messagesByConv[convId] = [...msgs, ...existing];
      }),

    addMessage: (msg) =>
      set((s) => {
        const list = s.messagesByConv[msg.conversationId] ?? [];
        if (!list.find((m) => m.id === msg.id)) {
          s.messagesByConv[msg.conversationId] = [...list, msg];
        }
      }),

    applyReadReceipt: (convId, userId, readAt) =>
      set((s) => {
        const msgs = s.messagesByConv[convId];
        if (!msgs) return;
        for (const m of msgs) {
          if (!m.readBy) m.readBy = [];
          if (!m.readBy.find((r) => r.userId === userId)) {
            m.readBy.push({ userId, readAt });
          }
        }
      }),

    clearUnread: (convId) =>
      set((s) => {
        const conv = s.conversations.find((c) => c.id === convId);
        if (conv) conv.unreadCount = 0;
      }),

    setTyping: (convId, userId, active) =>
      set((s) => {
        const current = s.typingByConv[convId] ?? [];
        if (active) {
          if (!current.includes(userId)) {
            s.typingByConv[convId] = [...current, userId];
          }
        } else {
          s.typingByConv[convId] = current.filter((id) => id !== userId);
        }
      }),

    setUserCache: (users) =>
      set((s) => {
        for (const u of users) {
          s.userCache[u.id] = u;
        }
      }),

    setOnline: (userId, online) =>
      set((s) => {
        if (online) {
          if (!s.onlineIds.includes(userId)) s.onlineIds.push(userId);
          if (s.userCache[userId]) s.userCache[userId].online = true;
        } else {
          s.onlineIds = s.onlineIds.filter((id) => id !== userId);
          if (s.userCache[userId]) s.userCache[userId].online = false;
        }
      }),

    openQuickChat: (convId) =>
      set((s) => {
        if (s.openQuickChats.includes(convId)) return;
        // max 3 windows — drop oldest if needed
        if (s.openQuickChats.length >= 3) s.openQuickChats.shift();
        s.openQuickChats.push(convId);
      }),

    closeQuickChat: (convId) =>
      set((s) => {
        s.openQuickChats = s.openQuickChats.filter((id) => id !== convId);
      }),

    pushNotif: (n) =>
      set((s) => {
        const notif: QuickChatNotif = { ...n, id: Math.random().toString(36).slice(2), at: Date.now() };
        // dedup per conv — one notif per conv at a time
        s.notifQueue = s.notifQueue.filter((x) => x.convId !== n.convId);
        s.notifQueue.push(notif);
      }),

    dismissNotif: (id) =>
      set((s) => {
        s.notifQueue = s.notifQueue.filter((n) => n.id !== id);
      }),
  }))
);

// Selectors
export const selectUser = (userId: string) => (s: State & Actions) => s.userCache[userId];
export const selectTyping = (convId: string) => (s: State & Actions) => s.typingByConv[convId] ?? [];
export const selectMessages = (convId: string) => (s: State & Actions) =>
  s.messagesByConv[convId] ?? [];
