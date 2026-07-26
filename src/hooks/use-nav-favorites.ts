import { useMemo, useState, useEffect, useCallback } from 'react';

import { getStorage, setStorage } from './use-local-storage';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'core-fe:nav-favorites';
export const MAX_NAV_FAVORITES = 8;

export function useNavFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    const restored = getStorage(STORAGE_KEY);
    return Array.isArray(restored) ? restored : [];
  });

  useEffect(() => {
    setStorage(STORAGE_KEY, favorites);
  }, [favorites]);

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  const isFull = useMemo(() => favorites.length >= MAX_NAV_FAVORITES, [favorites]);

  const addFavorite = useCallback((path: string) => {
    setFavorites((prev) => (prev.includes(path) || prev.length >= MAX_NAV_FAVORITES ? prev : [...prev, path]));
  }, []);

  const removeFavorite = useCallback((path: string) => {
    setFavorites((prev) => prev.filter((p) => p !== path));
  }, []);

  const toggleFavorite = useCallback(
    (path: string) => {
      if (isFavorite(path)) removeFavorite(path);
      else addFavorite(path);
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return { favorites, isFavorite, isFull, addFavorite, removeFavorite, toggleFavorite };
}
