import { create } from 'zustand';

// ----------------------------------------------------------------------
// Ghim + gần đây của menu quản trị, lưu theo KHOÁ trang (layouts/dashboard/nav/nav-config.ts), không theo đường dẫn.
// Ghim: tối đa MAX_NAV_PINS, đồng bộ lên Core-be (/users/me/ui-preferences/nav.pins — NavPrefsSync) để đổi máy không
// mất; localStorage là bản trên máy. Gần đây: chỉ trên máy này.
// Khoá cũ "core-fe:nav-favorites" lưu đường dẫn — NavPrefsSync đổi sang khoá một lần rồi xoá.
// ----------------------------------------------------------------------

export const MAX_NAV_PINS = 10;
export const MAX_NAV_RECENT = 6;

export const NAV_PINS_KEY = 'core-fe:nav-pins';
export const NAV_RECENT_KEY = 'core-fe:nav-recent';
export const LEGACY_NAV_FAVORITES_KEY = 'core-fe:nav-favorites';

function read(key: string): string[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string[] | null) {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Chế độ ẩn danh / bị chặn lưu: vẫn dùng được trong phiên.
  }
}

type NavPrefsState = {
  pins: string[];
  recent: string[];
  /** Ghim cũ theo đường dẫn, chờ đổi sang khoá (null = không có). */
  legacyPaths: string[] | null;
  /** Lần đổi ghim gần nhất do người dùng (không phải nạp từ server) — để NavPrefsSync biết cần gửi lên. */
  dirty: boolean;
  togglePin: (key: string) => void;
  setPins: (keys: string[], options?: { fromServer?: boolean }) => void;
  pushRecent: (key: string) => void;
  clearLegacy: () => void;
};

const initialPins = read(NAV_PINS_KEY);

export const useNavPrefs = create<NavPrefsState>((set, get) => ({
  pins: initialPins ?? [],
  recent: read(NAV_RECENT_KEY) ?? [],
  legacyPaths: initialPins ? null : read(LEGACY_NAV_FAVORITES_KEY),
  dirty: false,

  togglePin: (key) => {
    const { pins } = get();
    let next: string[];
    if (pins.includes(key)) next = pins.filter((k) => k !== key);
    else if (pins.length >= MAX_NAV_PINS) return;
    else next = [...pins, key];
    write(NAV_PINS_KEY, next);
    set({ pins: next, dirty: true });
  },

  setPins: (keys, options) => {
    const next = Array.from(new Set(keys)).slice(0, MAX_NAV_PINS);
    write(NAV_PINS_KEY, next);
    set({ pins: next, dirty: !options?.fromServer });
  },

  pushRecent: (key) => {
    const { recent } = get();
    if (recent[0] === key) return;
    const next = [key, ...recent.filter((k) => k !== key)].slice(0, MAX_NAV_RECENT);
    write(NAV_RECENT_KEY, next);
    set({ recent: next });
  },

  clearLegacy: () => {
    write(LEGACY_NAV_FAVORITES_KEY, null);
    set({ legacyPaths: null });
  },
}));
