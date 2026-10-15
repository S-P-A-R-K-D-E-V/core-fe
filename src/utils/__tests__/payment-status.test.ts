import { describe, expect, it } from 'vitest';

import {
  qrOutcome,
  statusChip,
  isEventForQr,
  secondsUntil,
  formatCountdown,
  BANK_TXN_STATUS,
  qrTransactionRef,
  paymentProviderLabel,
  normalizePaymentStatusEvent,
} from '../payment-status';

// ----------------------------------------------------------------------

describe('qrOutcome', () => {
  it('COMPLETED → thanh toán xong', () => {
    expect(qrOutcome('COMPLETED')).toBe('completed');
    expect(qrOutcome('completed')).toBe('completed');
  });

  it('CANCELLED / ERRORCORRECTED → huỷ (như luồng cũ)', () => {
    expect(qrOutcome('CANCELLED')).toBe('cancelled');
    expect(qrOutcome('ERRORCORRECTED')).toBe('cancelled');
  });

  it('EXPIRED → hết hạn', () => {
    expect(qrOutcome('EXPIRED')).toBe('expired');
  });

  it('INIT / PENDING / rỗng → còn chờ', () => {
    expect(qrOutcome('INIT')).toBe('pending');
    expect(qrOutcome('PENDING')).toBe('pending');
    expect(qrOutcome(undefined)).toBe('pending');
    expect(qrOutcome('')).toBe('pending');
  });
});

describe('secondsUntil', () => {
  const now = Date.parse('2026-10-15T10:00:00Z');

  it('không có expiresAt (dịch vụ tắt) → null', () => {
    expect(secondsUntil(undefined, now)).toBeNull();
    expect(secondsUntil(null, now)).toBeNull();
    expect(secondsUntil('không phải ngày', now)).toBeNull();
  });

  it('làm tròn lên, không âm', () => {
    expect(secondsUntil('2026-10-15T10:15:00Z', now)).toBe(900);
    expect(secondsUntil('2026-10-15T10:00:00.400Z', now)).toBe(1);
    expect(secondsUntil('2026-10-15T09:59:00Z', now)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('phút:giây', () => {
    expect(formatCountdown(900)).toBe('15:00');
    expect(formatCountdown(75)).toBe('1:15');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('có giờ khi ≥ 1 giờ; âm coi như 0', () => {
    expect(formatCountdown(3725)).toBe('1:02:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('normalizePaymentStatusEvent', () => {
  it('camelCase giữ nguyên, status viết hoa', () => {
    expect(
      normalizePaymentStatusEvent({
        qrOrderId: 'abc',
        intentId: 'i1',
        status: 'completed',
        amount: 125000,
        amountReceived: 125000,
        paymentCode: 'SPK7Q2M9X',
      })
    ).toEqual({
      qrOrderId: 'abc',
      onlineOrderId: undefined,
      intentId: 'i1',
      status: 'COMPLETED',
      amount: 125000,
      amountReceived: 125000,
      paymentCode: 'SPK7Q2M9X',
      salesOrderId: undefined,
    });
  });

  it('PascalCase của .NET', () => {
    const event = normalizePaymentStatusEvent({
      QrOrderId: 'ABC',
      IntentId: 'i1',
      Status: 'EXPIRED',
      Amount: 50000,
      AmountReceived: 0,
    });
    expect(event?.qrOrderId).toBe('ABC');
    expect(event?.status).toBe('EXPIRED');
    expect(event?.amount).toBe(50000);
  });

  it('không phải object / thiếu intentId → null', () => {
    expect(normalizePaymentStatusEvent(null)).toBeNull();
    expect(normalizePaymentStatusEvent('x')).toBeNull();
    expect(normalizePaymentStatusEvent({ qrOrderId: 'abc' })).toBeNull();
  });
});

describe('isEventForQr', () => {
  const event = normalizePaymentStatusEvent({ qrOrderId: 'AbC-1', intentId: 'i1', status: 'COMPLETED' })!;

  it('so Guid không phân biệt hoa thường', () => {
    expect(isEventForQr(event, 'abc-1')).toBe(true);
    expect(isEventForQr(event, 'abc-2')).toBe(false);
    expect(isEventForQr(event, null)).toBe(false);
  });

  it('sự kiện của đơn online (không có qrOrderId) → không phải của QR', () => {
    const online = normalizePaymentStatusEvent({ onlineOrderId: 'o1', intentId: 'i2', status: 'COMPLETED' })!;
    expect(isEventForQr(online, 'abc-1')).toBe(false);
  });
});

describe('statusChip', () => {
  it('trạng thái lạ vẫn hiện nguyên bản', () => {
    expect(statusChip(BANK_TXN_STATUS, 'unmatched').label).toBe('Chưa khớp');
    expect(statusChip(BANK_TXN_STATUS, 'reversed')).toEqual({ label: 'reversed', color: 'default' });
    expect(statusChip(BANK_TXN_STATUS, undefined).label).toBe('—');
  });
});

describe('qrTransactionRef', () => {
  it('có mã thanh toán → ghi mã thanh toán vào hoá đơn (core-be gắn QR với hoá đơn)', () => {
    expect(qrTransactionRef({ id: 'f3a9c1d2-0000', paymentCode: 'SPK7Q2M9X', traceNumber: 'FT123' })).toBe('SPK7Q2M9X');
  });

  it('dịch vụ thanh toán tắt (không có mã) → như cũ: số trace, rồi 8 ký tự đầu id QR', () => {
    expect(qrTransactionRef({ id: 'f3a9c1d2-0000', paymentCode: undefined, traceNumber: 'FT123' })).toBe('FT123');
    expect(qrTransactionRef({ id: 'f3a9c1d2-0000', paymentCode: '', traceNumber: null })).toBe('f3a9c1d2');
  });
});

describe('paymentProviderLabel', () => {
  it('khoá đã biết → tên ngắn; khoá lạ hiện nguyên', () => {
    expect(paymentProviderLabel('payos')).toBe('payOS');
    expect(paymentProviderLabel('mbbank')).toBe('MB Bank');
    expect(paymentProviderLabel('newpay')).toBe('newpay');
    expect(paymentProviderLabel(undefined)).toBe('—');
  });
});
