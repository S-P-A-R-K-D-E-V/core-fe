'use client';

import type { IShippingCarrier, IShippingConnection } from 'src/types/online-shop';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { apiErrorMessage } from 'src/utils/api-error';

import { createShippingConnection, updateShippingConnection } from 'src/api/online-shop';

import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Thêm / sửa kết nối hãng vận chuyển. Ô khoá (token) không bao giờ hiện lại giá trị cũ: sửa mà để trống = giữ nguyên.
// spark-shipping thử khoá với hãng trước khi lưu — khoá sai báo lỗi ngay.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  /** null = thêm mới */
  connection: IShippingConnection | null;
  carriers: IShippingCarrier[];
  onClose: () => void;
  onSaved: () => void;
};

export default function ShippingConnectionDialog({ open, connection, carriers, onClose, onSaved }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [carrierCode, setCarrierCode] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCarrierCode(connection?.carrier ?? carriers[0]?.code ?? '');
    setEnvironment(connection?.environment ?? 'production');
    setDisplayName(connection?.displayName ?? '');
    setCredentials({});
    setSettings({ ...(connection?.settings ?? {}) });
    setError(null);
  }, [open, connection, carriers]);

  const carrier = carriers.find((c) => c.code === carrierCode);
  const editing = !!connection;

  const missing = !editing && carrier
    ? carrier.credentials.filter((f) => f.required && !credentials[f.key]?.trim()).map((f) => f.label)
    : [];

  const save = async () => {
    if (!carrier) return;
    setSaving(true);
    setError(null);
    const creds = Object.fromEntries(Object.entries(credentials).filter(([, v]) => v.trim()));
    try {
      if (editing && connection) {
        await updateShippingConnection(connection.id, {
          displayName: displayName.trim() || undefined,
          credentials: Object.keys(creds).length ? creds : undefined,
          settings,
        });
        enqueueSnackbar('Đã lưu kết nối');
      } else {
        await createShippingConnection({
          carrier: carrier.code,
          environment,
          displayName: displayName.trim() || undefined,
          credentials: creds,
          settings,
        });
        enqueueSnackbar('Đã kết nối hãng vận chuyển');
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu kết nối thất bại'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? 'Sửa kết nối hãng vận chuyển' : 'Kết nối hãng vận chuyển'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select label="Hãng" value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)} disabled={editing}>
            {carriers.map((c) => (
              <MenuItem key={c.code} value={c.code}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          {carrier && (
            <Typography variant="body2" color="text.secondary">
              {carrier.help}
            </Typography>
          )}
          <TextField
            select
            label="Môi trường"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            disabled={editing}
            helperText="Thử nghiệm = tài khoản sandbox của hãng (không giao thật)"
          >
            {(carrier?.environments ?? ['production']).map((env) => (
              <MenuItem key={env} value={env}>
                {env === 'staging' ? 'Thử nghiệm (staging)' : 'Thật (production)'}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Tên hiển thị" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={carrier?.label} />

          {carrier?.credentials.map((f) => (
            <TextField
              key={f.key}
              label={f.label + (f.required && !editing ? ' *' : '')}
              type={f.secret ? 'password' : 'text'}
              autoComplete="off"
              value={credentials[f.key] ?? ''}
              onChange={(e) => setCredentials((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={editing && connection?.credentialKeys.includes(f.key) ? 'Đã lưu — để trống để giữ nguyên' : undefined}
              helperText={f.help}
            />
          ))}

          {carrier && carrier.settings.length > 0 && (
            <>
              <Typography variant="subtitle2">Kho lấy hàng</Typography>
              {carrier.settings.map((f) => (
                <TextField
                  key={f.key}
                  size="small"
                  label={f.label}
                  value={settings[f.key] ?? ''}
                  onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                  helperText={f.help}
                />
              ))}
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} onClick={save} disabled={!carrier || missing.length > 0}>
          {editing ? 'Lưu' : 'Kiểm tra & kết nối'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
