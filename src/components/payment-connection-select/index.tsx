'use client';

import type { IPosPaymentConnection } from 'src/types/corecms-api';

import { useState, useEffect, useCallback } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

import {
  posConnectionKey,
  saveConnectionId,
  posConnectionLabel,
  readSavedConnectionId,
  resolveSavedConnectionId,
} from 'src/utils/payment-connection';

import { getPosPaymentConnections } from 'src/api/payment-qr';

// ----------------------------------------------------------------------
// Chọn nguồn xác nhận chuyển khoản khi tạo QR (Bán hàng, F&B): mặc định theo tài khoản ngân hàng như cũ; chọn một lựa
// chọn "tài khoản · dịch vụ S Payment" (vd ApiPay — VA, VietinBank VietQR Pay — tài khoản VietinBank) thì QR vào tài khoản
// đó và dịch vụ đó báo tiền về. Lựa chọn (khoá) nhớ theo máy.
// ----------------------------------------------------------------------

export type PosPaymentConnectionsState = {
  connections: IPosPaymentConnection[];
  /** Khoá lựa chọn đang chọn — '' = theo tài khoản ngân hàng */
  selectionKey: string;
  /** Id kết nối của lựa chọn (gửi khi tạo QR) — '' = theo tài khoản ngân hàng */
  connectionId: string;
  connection: IPosPaymentConnection | null;
  setSelectionKey: (key: string) => void;
  /** Đã tải xong (kể cả lỗi) — POS chờ cờ này rồi mới tự tạo QR, tránh tạo mã theo tài khoản rồi lại đổi sang kết nối. */
  loaded: boolean;
};

export function usePosPaymentConnections(): PosPaymentConnectionsState {
  const [connections, setConnections] = useState<IPosPaymentConnection[]>([]);
  const [selectionKey, setSelectionKeyState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getPosPaymentConnections()
      .then((res) => {
        if (!alive) return;
        const list = res.enabled ? (res.connections ?? []) : [];
        setConnections(list);
        setSelectionKeyState(resolveSavedConnectionId(readSavedConnectionId(), list));
      })
      .catch(() => {
        // Không lấy được kết nối → theo tài khoản như cũ.
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setSelectionKey = useCallback((key: string) => {
    setSelectionKeyState(key);
    saveConnectionId(key);
  }, []);

  const connection = connections.find((c) => posConnectionKey(c) === selectionKey) ?? null;
  return {
    connections,
    selectionKey,
    connectionId: connection?.id ?? '',
    connection,
    setSelectionKey,
    loaded,
  };
}

type Props = {
  connections: IPosPaymentConnection[];
  /** Khoá lựa chọn ('' = theo tài khoản) */
  value: string;
  onChange: (selectionKey: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
};

/** Không có kết nối dùng được → không hiện gì (POS giữ nguyên như cũ). */
export default function PaymentConnectionSelect({
  connections,
  value,
  onChange,
  disabled,
  size = 'small',
}: Props) {
  if (connections.length === 0) return null;

  return (
    <TextField
      select
      fullWidth
      size={size}
      label="Xác nhận chuyển khoản"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <MenuItem value="">Theo tài khoản ngân hàng (mặc định)</MenuItem>
      {connections.map((c) => (
        <MenuItem key={posConnectionKey(c)} value={posConnectionKey(c)}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <span>{posConnectionLabel(c)}</span>
            {c.environment === 'test' && (
              <Chip size="small" color="warning" variant="outlined" label="Thử nghiệm" />
            )}
          </Stack>
        </MenuItem>
      ))}
    </TextField>
  );
}
