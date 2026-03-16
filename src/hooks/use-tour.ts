import { useState, useEffect, useCallback, useRef } from 'react';
import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import 'src/theme/css/tour-driver.css';

import { getBatchTourStatus, completeTour, resetTour } from 'src/api/userTours';

// ----------------------------------------------------------------------

export interface TourDefinition {
  /** Unique key cho tour (lưu vào DB) */
  tourKey: string;
  /** Tên hiển thị */
  label: string;
  /** Các bước tour */
  steps: DriveStep[];
}

interface UsePageToursOptions {
  tours: TourDefinition[];
  /** driver.js config overrides (áp dụng cho tất cả tours) */
  driverConfig?: Partial<Config>;
  /** Auto-start tour đầu tiên chưa hoàn thành khi vào page. Default: true */
  autoStart?: boolean;
  /** Delay (ms) trước khi start tour (chờ DOM render). Default: 600 */
  startDelay?: number;
}

interface UsePageToursReturn {
  /** Start 1 tour cụ thể theo tourKey */
  startTour: (tourKey: string) => void;
  /** Start tour đầu tiên chưa hoàn thành, nếu tất cả đã xong thì start tour đầu */
  startNextPending: () => void;
  /** Reset tất cả tours rồi start lại từ đầu */
  resetAndRestartAll: () => Promise<void>;
  /** Map trạng thái { tourKey: boolean } */
  completedMap: Record<string, boolean>;
  /** Tất cả đã hoàn thành */
  allCompleted: boolean;
  /** Đang loading trạng thái */
  isLoading: boolean;
  /** Danh sách tours definitions */
  tours: TourDefinition[];
}

export function usePageTours({
  tours,
  driverConfig,
  autoStart = true,
  startDelay = 600,
}: UsePageToursOptions): UsePageToursReturn {
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    tours.forEach((t) => { map[t.tourKey] = true; }); // default true to prevent flash
    return map;
  });
  const [isLoading, setIsLoading] = useState(true);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasAutoStarted = useRef(false);
  const toursRef = useRef(tours);
  toursRef.current = tours;
  const completedMapRef = useRef(completedMap);
  completedMapRef.current = completedMap;

  // Fetch all tour statuses in 1 API call
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    hasAutoStarted.current = false;

    const keys = tours.map((t) => t.tourKey);
    getBatchTourStatus(keys)
      .then((statuses) => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        statuses.forEach((s) => { map[s.tourKey] = s.isCompleted; });
        // Fill missing keys as not completed
        keys.forEach((k) => { if (!(k in map)) map[k] = false; });
        setCompletedMap(map);
      })
      .catch(() => {
        if (cancelled) return;
        // API fail → assume all not completed
        const map: Record<string, boolean> = {};
        keys.forEach((k) => { map[k] = false; });
        setCompletedMap(map);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours.map((t) => t.tourKey).join(',')]);

  const startTour = useCallback((tourKey: string) => {
    const tourDef = toursRef.current.find((t) => t.tourKey === tourKey);
    if (!tourDef) return;

    if (driverRef.current) {
      driverRef.current.destroy();
    }

    // Find next uncompleted tour after this one
    const currentIdx = toursRef.current.findIndex((t) => t.tourKey === tourKey);
    const nextPendingTour = toursRef.current
      .slice(currentIdx + 1)
      .find((t) => !completedMapRef.current[t.tourKey]);

    const driverObj = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Tiếp',
      prevBtnText: 'Quay lại',
      doneBtnText: nextPendingTour ? 'Tiếp tục →' : 'Hoàn thành',
      progressText: `${tourDef.label} — {{current}} / {{total}}`,
      ...driverConfig,
      steps: tourDef.steps,
      onDestroyStarted: () => {
        // Capture state BEFORE destroy() wipes driver internals
        const wasLastStep = driverObj.isLastStep();
        driverObj.destroy();

        // Mark current tour as completed
        completeTour(tourKey)
          .then(() => {
            setCompletedMap((prev) => ({ ...prev, [tourKey]: true }));

            // Chain to next uncompleted tour only if user finished all steps
            if (wasLastStep) {
              const nextUncompleted = toursRef.current
                .slice(currentIdx + 1)
                .find((t) => !completedMapRef.current[t.tourKey] && t.tourKey !== tourKey);
              if (nextUncompleted) {
                setTimeout(() => {
                  startTour(nextUncompleted.tourKey);
                }, 400);
              }
            }
          })
          .catch(() => {});
      },
    });

    driverRef.current = driverObj;
    driverObj.drive();
  }, [driverConfig]);

  const startNextPending = useCallback(() => {
    const pending = toursRef.current.find((t) => !completedMap[t.tourKey]);
    if (pending) {
      startTour(pending.tourKey);
    } else if (toursRef.current.length > 0) {
      // All completed → start from first
      startTour(toursRef.current[0].tourKey);
    }
  }, [completedMap, startTour]);

  // Auto-start first pending tour
  useEffect(() => {
    if (!autoStart || isLoading || hasAutoStarted.current) return;

    const hasPending = toursRef.current.some((t) => !completedMap[t.tourKey]);
    if (!hasPending) return;

    hasAutoStarted.current = true;
    const timer = setTimeout(() => {
      const pending = toursRef.current.find((t) => !completedMap[t.tourKey]);
      if (pending) startTour(pending.tourKey);
    }, startDelay);

    return () => clearTimeout(timer);
  }, [autoStart, isLoading, completedMap, startTour, startDelay]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    },
    []
  );

  const resetAndRestartAll = useCallback(async () => {
    const keys = toursRef.current.map((t) => t.tourKey);
    await Promise.all(keys.map((k) => resetTour(k)));
    const map: Record<string, boolean> = {};
    keys.forEach((k) => { map[k] = false; });
    setCompletedMap(map);
    hasAutoStarted.current = false;

    // Start first tour after short delay
    if (toursRef.current.length > 0) {
      setTimeout(() => startTour(toursRef.current[0].tourKey), 300);
    }
  }, [startTour]);

  const allCompleted = tours.every((t) => completedMap[t.tourKey]);

  return {
    startTour,
    startNextPending,
    resetAndRestartAll,
    completedMap,
    allCompleted,
    isLoading,
    tours,
  };
}
