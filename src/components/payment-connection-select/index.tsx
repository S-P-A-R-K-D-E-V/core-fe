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
  /** Chủ cửa hàng cho tạo VietQR theo tài khoản ngân hàng ở quầy (cấu hình kênh POS; chưa cấu hình = có). */
  allowBankAccount: boolean;
  /** Phương thức hiện ở quầy ('Cash' | 'BankTransfer' | 'Card' | 'EWallet'); null = chưa cấu hình → mọi phương thức. */
  methods: string[] | null;
};

export function usePosPaymentConnections(): PosPaymentConnectionsState {
  const [connections, setConnections] = useState<IPosPaymentConnection[]>([]);
  const [selectionKey, setSelectionKeyState] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [allowBankAccount, setAllowBankAccount] = useState(true);
  const [methods, setMethods] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    getPosPaymentConnections()
      .then((res) => {
        if (!alive) return;
        const list = res.enabled ? (res.connections ?? []) : [];
        const allowAccount = res.configured ? res.allowBankAccount !== false : true;
        setConnections(list);
        setAllowBankAccount(allowAccount);
        setMethods(res.configured && res.methods?.length ? res.methods : null);
        setSelectionKeyState(initialSelection(res.configured ? res.defaultKey : null, readSavedConnectionId(), list, allowAccount));
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
    allowBankAccount,
    methods,
  };
}

/**
 * Phương thức chủ cửa hàng bật cho quầy (Thanh toán → Cài đặt → Phương thức theo kênh). null = chưa tải / chưa cấu hình /
 * lỗi → quầy hiện mọi phương thức như trước (bán hàng không được kẹt vì không đọc được cấu hình).
 */
export function usePosPaymentMethods(): string[] | null {
  const [methods, setMethods] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    getPosPaymentConnections()
      .then((res) => {
        if (alive) setMethods(res.configured && res.methods?.length ? res.methods : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return methods;
}

/** Lọc danh sách phương thức của màn hình theo cấu hình; F&B gọi chuyển khoản là 'Transfer' (= 'BankTransfer'). */
export function allowedPosMethods<T extends { value: string }>(list: T[], methods: string[] | null | undefined): T[] {
  if (!methods?.length) return list;
  const allowed = new Set(methods.map((m) => (m === 'BankTransfer' ? 'Transfer' : m)).concat(methods));
  const filtered = list.filter((m) => allowed.has(m.value));
  return filtered.length ? filtered : list;
}

/**
 * Nguồn chọn sẵn khi mở quầy: mặc định chủ cửa hàng đặt (còn dùng được) → lựa chọn máy này nhớ → theo tài khoản; chủ cửa
 * hàng tắt "theo tài khoản" thì lấy kết nối đầu tiên.
 */
export function initialSelection(
  defaultKey: string | null | undefined,
  saved: string | null | undefined,
  connections: Pick<IPosPaymentConnection, 'id' | 'key'>[],
  allowBankAccount: boolean
): string {
  const usable = (key: string) => (key === '' ? allowBankAccount : connections.some((c) => posConnectionKey(c) === key));
  if (defaultKey != null && usable(defaultKey)) return defaultKey;
  const remembered = resolveSavedConnectionId(saved, connections);
  if (usable(remembered)) return remembered;
  return allowBankAccount || connections.length === 0 ? '' : posConnectionKey(connections[0]);
}

type Props = {
  connections: IPosPaymentConnection[];
  /** Khoá lựa chọn ('' = theo tài khoản) */
  value: string;
  onChange: (selectionKey: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  /** false = chủ cửa hàng tắt VietQR theo tài khoản cho quầy — bỏ lựa chọn "theo tài khoản". */
  allowBankAccount?: boolean;
};

/** Không có kết nối dùng được → không hiện gì (POS giữ nguyên như cũ). */
export default function PaymentConnectionSelect({
  connections,
  value,
  onChange,
  disabled,
  size = 'small',
  allowBankAccount = true,
}: Props) {
  if (connections.length === 0) return null;
  // Chỉ còn một nguồn (kết nối duy nhất, không theo tài khoản): không có gì để chọn.
  if (!allowBankAccount && connections.length === 1) return null;

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
      {allowBankAccount && <MenuItem value="">Theo tài khoản ngân hàng</MenuItem>}
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
