'use client';

import type { IPosPaymentConnection } from 'src/types/corecms-api';

import { useState, useEffect, useCallback } from 'react';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

import {
  saveConnectionId,
  posConnectionLabel,
  readSavedConnectionId,
  resolveSavedConnectionId,
} from 'src/utils/payment-connection';

import { getPosPaymentConnections } from 'src/api/payment-qr';

// ----------------------------------------------------------------------
// Chọn nguồn xác nhận chuyển khoản khi tạo QR (Bán hàng, F&B): mặc định theo tài khoản ngân hàng như cũ; chọn một kết nối
// (vd ApiPay — VA) thì QR vào tài khoản của kết nối và kết nối đó báo tiền về. Lựa chọn nhớ theo máy.
// ----------------------------------------------------------------------

export type PosPaymentConnectionsState = {
  connections: IPosPaymentConnection[];
  /** '' = theo tài khoản ngân hàng */
  connectionId: string;
  connection: IPosPaymentConnection | null;
  setConnectionId: (id: string) => void;
  /** Đã tải xong (kể cả lỗi) — POS chờ cờ này rồi mới tự tạo QR, tránh tạo mã theo tài khoản rồi lại đổi sang kết nối. */
  loaded: boolean;
};

export function usePosPaymentConnections(): PosPaymentConnectionsState {
  const [connections, setConnections] = useState<IPosPaymentConnection[]>([]);
  const [connectionId, setConnectionIdState] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    getPosPaymentConnections()
      .then((res) => {
        if (!alive) return;
        const list = res.enabled ? (res.connections ?? []) : [];
        setConnections(list);
        setConnectionIdState(resolveSavedConnectionId(readSavedConnectionId(), list));
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

  const setConnectionId = useCallback((id: string) => {
    setConnectionIdState(id);
    saveConnectionId(id);
  }, []);

  return {
    connections,
    connectionId,
    connection: connections.find((c) => c.id === connectionId) ?? null,
    setConnectionId,
    loaded,
  };
}

type Props = {
  connections: IPosPaymentConnection[];
  value: string;
  onChange: (connectionId: string) => void;
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
        <MenuItem key={c.id} value={c.id}>
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
