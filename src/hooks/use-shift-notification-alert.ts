import { useEffect, useCallback } from 'react';
import { useSnackbar } from 'src/components/snackbar';
import type { INotification } from 'src/types/notification';

// ----------------------------------------------------------------------

function playShiftPing() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Hai tone ngắn liên tiếp — "ding ding"
    const tones = [880, 1100];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (_) {
    // AudioContext blocked nếu chưa có user gesture — không crash
  }
}

// ----------------------------------------------------------------------

/**
 * Gọi hook này 1 lần trong DashboardLayout.
 * Khi có SignalR NewNotification với category === 'Shift',
 * sẽ tự hiện snackbar + phát âm ping.
 */
export function useShiftNotificationAlert() {
  const { enqueueSnackbar } = useSnackbar();

  const handleEvent = useCallback(
    (ev: Event) => {
      const notification = (ev as CustomEvent<INotification>).detail;

      // Chỉ hiện toast cho Shift notifications
      if (notification.category !== 'Shift') return;

      playShiftPing();

      enqueueSnackbar(`${notification.title}\n${notification.message}`, {
        variant: 'info',
        autoHideDuration: 7000,
        anchorOrigin: { vertical: 'top', horizontal: 'right' },
      });
    },
    [enqueueSnackbar]
  );

  useEffect(() => {
    window.addEventListener('shift-notification', handleEvent);
    return () => window.removeEventListener('shift-notification', handleEvent);
  }, [handleEvent]);
}
