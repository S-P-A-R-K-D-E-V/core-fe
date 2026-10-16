import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trình duyệt chưa là máy quầy hiện mã 6 số + QR; QR chỉ chứa mã (PairingId là bí mật để lấy key). Được duyệt → lưu
// máy quầy (key nhận đúng một lần).
// ----------------------------------------------------------------------

const qrPayloads: string[] = [];
vi.mock('qrcode', () => ({
  default: { toDataURL: (payload: string) => (qrPayloads.push(payload), Promise.resolve('data:image/png;base64,AA')) },
}));

const requestKioskPairing = vi.fn();
const getKioskPairingStatus = vi.fn();
vi.mock('src/api/kiosk', () => ({
  requestKioskPairing: (...a: any[]) => requestKioskPairing(...a),
  getKioskPairingStatus: (...a: any[]) => getKioskPairingStatus(...a),
}));

const saveCounterDevice = vi.fn();
vi.mock('../counter-device', () => ({ saveCounterDevice: (...a: any[]) => saveCounterDevice(...a) }));

import CounterPairPanel from '../counter-pair-panel';

describe('CounterPairPanel', () => {
  beforeEach(() => {
    qrPayloads.length = 0;
    requestKioskPairing.mockReset().mockResolvedValue({ pairingId: 'secret-pairing-id', code: '482913', expiresAt: '' });
    getKioskPairingStatus.mockReset();
    saveCounterDevice.mockReset();
  });

  it('asks for a counter code, shows it, and keeps the pairing id out of the QR', async () => {
    getKioskPairingStatus.mockResolvedValue({ status: 'pending' });
    render(
      <ThemeProvider theme={createTheme()}>
        <CounterPairPanel onLogin={() => {}} />
      </ThemeProvider>
    );

    await waitFor(() => expect(screen.getByText('482913')).toBeTruthy());
    expect(requestKioskPairing).toHaveBeenCalledWith({ deviceType: 'counter', platform: 'web' });
    expect(JSON.parse(qrPayloads[0])).toEqual({ type: 'corecms-kiosk-pair', code: '482913' });
  });

  it('becomes a counter once approved', async () => {
    getKioskPairingStatus.mockResolvedValue({
      status: 'claimed',
      kioskKey: 'k-1',
      deviceId: 'dev-1',
      deviceName: 'Quầy web',
      branchId: 'b1',
      branchName: 'Chi nhánh 1',
      deviceType: 'counter',
    });
    render(
      <ThemeProvider theme={createTheme()}>
        <CounterPairPanel onLogin={() => {}} />
      </ThemeProvider>
    );

    await waitFor(() => expect(saveCounterDevice).toHaveBeenCalled(), { timeout: 4000 });
    expect(saveCounterDevice).toHaveBeenCalledWith({
      deviceId: 'dev-1',
      deviceName: 'Quầy web',
      branchId: 'b1',
      branchName: 'Chi nhánh 1',
      deviceKey: 'k-1',
    });
  });
});
