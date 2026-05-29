'use client';

import { useState, useEffect, useCallback } from 'react';

const LS_KEY = 'core_mobile_view_pref';

export type MobileViewPref = 'mobile' | 'desktop' | null;

export function useMobileView() {
  const [pref, setPref] = useState<MobileViewPref>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem(LS_KEY) ||
      sessionStorage.getItem(LS_KEY)) as MobileViewPref;
    setPref(stored);
    setLoaded(true);
  }, []);

  const savePref = useCallback((value: 'mobile' | 'desktop', persistent = true) => {
    setPref(value);
    if (persistent) {
      localStorage.setItem(LS_KEY, value);
    } else {
      sessionStorage.setItem(LS_KEY, value);
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  const clearPref = useCallback(() => {
    setPref(null);
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(LS_KEY);
  }, []);

  return { pref, loaded, savePref, clearPref };
}
