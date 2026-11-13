'use client';

import { useMemo } from 'react';

import { usePathname } from 'src/routes/hooks';

import { MAX_NAV_PINS, useNavPrefs } from 'src/store/nav-prefs-store';

import { findActivePage } from './nav-filter';

import type { NavTree, NavFlatPage } from './nav-types';

// ----------------------------------------------------------------------

/** Trang đang mở (khoá) — khớp đường dẫn dài nhất trong cây đã lọc. */
export function useActiveNavPage(tree: NavTree): NavFlatPage | null {
  const pathname = usePathname();
  return useMemo(
    () =>
      findActivePage(
        tree.searchable,
        pathname,
        typeof window === 'undefined' ? '' : window.location.search
      ),
    [tree.searchable, pathname]
  );
}

/** Ghim (của mình trước, rồi ghim mặc định của vai trò) + gần đây, chỉ gồm trang người đó đang thấy. */
export function useNavPins(tree: NavTree) {
  const pins = useNavPrefs((s) => s.pins);
  const recent = useNavPrefs((s) => s.recent);
  const togglePin = useNavPrefs((s) => s.togglePin);

  return useMemo(() => {
    const byKey = new Map(tree.searchable.map((p) => [p.key, p]));
    const pick = (keys: readonly string[]) =>
      keys.map((k) => byKey.get(k)).filter((p): p is NavFlatPage => !!p);
    const mine = pick(pins);
    const role = pick(tree.rolePins).filter((p) => !pins.includes(p.key));
    return {
      pinned: [...mine, ...role],
      recent: pick(recent),
      isPinned: (key: string) => pins.includes(key) || tree.rolePins.includes(key),
      /** Ghim của vai trò: bỏ được khỏi danh sách của mình nhưng vẫn hiện (chủ cửa hàng chọn). */
      isRolePin: (key: string) => tree.rolePins.includes(key) && !pins.includes(key),
      isFull: pins.length >= MAX_NAV_PINS,
      togglePin,
    };
  }, [pins, recent, togglePin, tree.searchable, tree.rolePins]);
}

export type NavPinsState = ReturnType<typeof useNavPins>;
