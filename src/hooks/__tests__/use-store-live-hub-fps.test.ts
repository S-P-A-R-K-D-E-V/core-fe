import { describe, expect, it } from 'vitest';

import { receivedFps } from '../use-store-live-hub';

// Số hình/giây hiện trên ô camera tính từ thời điểm trình duyệt nhận các hình gần nhất.
describe('receivedFps', () => {
  it('needs at least 3 frames and averages over the window', () => {
    expect(receivedFps([0, 125])).toBeNull();
    expect(receivedFps([0, 125, 250, 375, 500])).toBe(8);
    expect(receivedFps([1000, 1500, 2000])).toBe(2);
    expect(receivedFps([5, 5, 5])).toBeNull();
  });
});
