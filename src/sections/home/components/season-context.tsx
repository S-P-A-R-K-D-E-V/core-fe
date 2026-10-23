'use client';

import { useContext, createContext } from 'react';

import { SEASONS, type SeasonKey, type SeasonPreset } from 'src/lib/store-season';

// ----------------------------------------------------------------------

// Mùa lễ đang hiện trên trang chủ (app/page.tsx tính phía server — src/lib/store-season.ts activeSeason).
const SeasonContext = createContext<SeasonKey | null>(null);

export const SeasonProvider = SeasonContext.Provider;

export function useSeason(): SeasonPreset | null {
  const key = useContext(SeasonContext);
  return key ? SEASONS[key] : null;
}
