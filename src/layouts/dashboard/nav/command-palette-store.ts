import { create } from 'zustand';

// Mở / đóng ô tìm nhanh (Ctrl K / ⌘K) từ bất kỳ đâu: header, thanh bên, ngăn kéo mobile.
type State = { open: boolean; setOpen: (open: boolean) => void; toggle: () => void };

export const useCommandPalette = create<State>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
