import { describe, expect, it, vi } from 'vitest';

import {
  acquireFreshFix,
  locationFields,
  sendWithFreshLocation,
  type LocationFix,
} from '../fresh-location';

vi.mock('src/api/attendance', () => ({ locationPing: vi.fn() }));

// Lúc gửi chấm công: ping máy chủ rồi mới lấy điểm GPS — điểm cũ trong bộ đệm không được gửi đi.

function fakeClock(start = 100_000) {
  let t = start;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      t += ms;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

const HERE = { latitude: 10.77, longitude: 106.7, accuracy: 12 };

describe('acquireFreshFix', () => {
  it('skips a cached fix older than the ping and returns the next fresh one', async () => {
    const clock = fakeClock();
    const fixes = [
      { coords: HERE, timestamp: 40_000 },
      { coords: { ...HERE, accuracy: 8 }, timestamp: 100_500 },
    ];
    let i = 0;
    const fix = await acquireFreshFix(
      async () => 'ping',
      async () => {
        clock.advance(300);
        const f = fixes[i];
        i += 1;
        return f;
      },
      5000,
      clock.now,
      clock.sleep
    );
    expect(fix).toEqual({ coords: { ...HERE, accuracy: 8 }, unavailable: false, token: 'ping', fixAt: 100_500 });
  });

  it('gives up after the window and reports the GPS as unavailable', async () => {
    const clock = fakeClock();
    const fix = await acquireFreshFix(
      async () => null,
      async () => {
        clock.advance(1000);
        throw new Error('denied');
      },
      5000,
      clock.now,
      clock.sleep
    );
    expect(fix).toEqual({ coords: null, unavailable: true, token: null, fixAt: null });
  });
});

describe('locationFields', () => {
  it('sends the ping token and the fix age measured at send time', () => {
    const fix: LocationFix = { coords: HERE, unavailable: false, token: 't', fixAt: 10_000 };
    expect(locationFields(fix, 13_000)).toEqual({
      latitude: 10.77,
      longitude: 106.7,
      accuracy: 12,
      locationUnavailable: false,
      locationToken: 't',
      locationAgeMs: 3000,
    });
  });
});

describe('sendWithFreshLocation', () => {
  it('locates again and resends once when the server says the location is stale', async () => {
    let n = 0;
    const locate = vi.fn(async (): Promise<LocationFix> => {
      n += 1;
      return { coords: HERE, unavailable: false, token: `t${n}`, fixAt: 1 };
    });
    const send = vi
      .fn()
      .mockRejectedValueOnce({ errorCodes: ['Attendance.LocationStale'] })
      .mockResolvedValueOnce('ok');
    const { result, fix } = await sendWithFreshLocation(locate, send);
    expect(result).toBe('ok');
    expect(fix.token).toBe('t2');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const send = vi.fn().mockRejectedValue({ errors: { 'Attendance.OutsideGeofence': ['x'] } });
    await expect(
      sendWithFreshLocation(async () => ({ coords: HERE, unavailable: false, token: 't', fixAt: 1 }), send)
    ).rejects.toEqual({ errors: { 'Attendance.OutsideGeofence': ['x'] } });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
