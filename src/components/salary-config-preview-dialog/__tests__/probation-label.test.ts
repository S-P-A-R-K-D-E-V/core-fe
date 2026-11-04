import { describe, expect, it } from 'vitest';

import { probationLabel } from '../probation-label';

const regime = { probationHourlyFloor: 25_500, probationHourlyFloorFrom: '2026-11-01' };

describe('probationLabel', () => {
  it('kỳ từ ngày có mức sàn: hiện mức sàn, không hiện hệ số', () => {
    expect(probationLabel(0.85, regime, '2026-11-01')).toMatch(/^Sàn 25.500đ\/giờ$/);
    expect(probationLabel(null, regime, '2026-11-16')).toMatch(/^Sàn 25.500đ\/giờ$/);
  });

  it('kỳ trước ngày có mức sàn, hoặc cửa hàng chưa đặt mức sàn: hiện hệ số như cũ', () => {
    expect(probationLabel(0.85, regime, '2026-10-01')).toBe('85%');
    expect(probationLabel(0.85, null, '2026-11-01')).toBe('85%');
    expect(probationLabel(undefined, { probationHourlyFloor: null, probationHourlyFloorFrom: null }, '2026-11-01')).toBe('100%');
  });
});
