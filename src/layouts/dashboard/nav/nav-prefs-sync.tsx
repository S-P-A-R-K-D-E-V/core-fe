'use client';

import { useRef, useEffect } from 'react';

import { usePathname } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { getUiPreference, putUiPreference } from 'src/api/nav-menu';

import { useNavPrefs } from 'src/store/nav-prefs-store';

import { findActivePage } from './nav-filter';
import { useNavTree } from '../config-navigation';

// ----------------------------------------------------------------------
// Chạy ngầm trong khung dashboard:
//  - ghi "gần đây" khi mở một trang có trong menu;
//  - đổi ghim cũ (lưu theo đường dẫn) sang khoá trang, một lần;
//  - đồng bộ ghim với Core-be (/users/me/ui-preferences/nav.pins): server có thì lấy server, chưa có thì đẩy bản trên
//    máy lên; sau đó mỗi lần đổi ghim thì gửi lên (gộp 800 ms). Core-be chưa có API / mất mạng → chỉ lưu trên máy.
// ----------------------------------------------------------------------

export default function NavPrefsSync() {
  const { user } = useAuthContext();
  const tree = useNavTree();
  const pathname = usePathname();

  const pins = useNavPrefs((s) => s.pins);
  const dirty = useNavPrefs((s) => s.dirty);
  const legacyPaths = useNavPrefs((s) => s.legacyPaths);

  // Gần đây. Đọc query thẳng từ location (useSearchParams buộc bọc Suspense cả khung dashboard).
  useEffect(() => {
    const page = findActivePage(tree.searchable, pathname, window.location.search);
    if (page) useNavPrefs.getState().pushRecent(page.key);
  }, [pathname, tree.searchable]);

  // Ghim cũ theo đường dẫn → khoá.
  useEffect(() => {
    if (!legacyPaths || tree.pages.length === 0 || !user?.roles?.length) return;
    const keys = legacyPaths
      .map((path) => findActivePage(tree.searchable, path)?.key)
      .filter((key): key is string => !!key);
    const { pins: current, setPins, clearLegacy } = useNavPrefs.getState();
    if (current.length === 0 && keys.length) setPins(keys);
    clearLegacy();
  }, [legacyPaths, tree.pages.length, tree.searchable, user?.roles?.length]);

  // Đồng bộ với server.
  const syncable = !!user?.id && !tree.counter;
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!syncable || loaded.current === user!.id) return;
    loaded.current = user!.id;
    let cancelled = false;
    (async () => {
      try {
        const server = await getUiPreference<string[]>('nav.pins');
        if (cancelled) return;
        const { pins: local, setPins } = useNavPrefs.getState();
        if (Array.isArray(server))
          setPins(
            server.filter((k) => typeof k === 'string'),
            { fromServer: true }
          );
        else if (local.length) await putUiPreference('nav.pins', local);
      } catch {
        // Core-be chưa có API hoặc mất mạng — ghim vẫn lưu trên máy.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncable, user]);

  useEffect(() => {
    if (!syncable || !dirty) return undefined;
    const timer = setTimeout(() => {
      putUiPreference('nav.pins', pins).catch(() => {
        // bỏ qua: lần đổi sau gửi lại
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [pins, dirty, syncable]);

  return null;
}
