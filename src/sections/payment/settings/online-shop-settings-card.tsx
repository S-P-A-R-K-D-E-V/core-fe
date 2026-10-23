'use client';

import type {
  IShippingCarrier,
  IShippingConnection,
  IOnlineShopSettings,
  IOnlineShopSettingsInput,
} from 'src/types/online-shop';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import RadioGroup from '@mui/material/RadioGroup';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { apiErrorMessage } from 'src/utils/api-error';

import {
  getShippingCarriers,
  getOnlineShopSettings,
  testShippingConnection,
  getShippingConnections,
  updateShippingConnection,
  updateOnlineShopSettings,
  disableShippingConnection,
} from 'src/api/online-shop';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import CopyField from 'src/sections/store-settings/payment-connection/copy-field';

import PickupBranchCard from './pickup-branch-card';
import ShippingConnectionDialog, { carrierLinksFor } from './shipping-connection-dialog';

// ----------------------------------------------------------------------
// Bán online & giao hàng: khách nhận hàng thế nào (nhận tại cửa hàng / giao tận nơi), hãng vận chuyển nào báo giá (tài
// khoản GHN, GHTK... của cửa hàng nằm ở spark-shipping), và cước tính ra sao (khối lượng, hộp, khai giá, miễn phí ship).
// Phí ship luôn do máy chủ hỏi hãng lúc khách đặt — số ở đây là đầu vào, không phải bảng giá.
// ----------------------------------------------------------------------

function inputOf(s: IOnlineShopSettings): IOnlineShopSettingsInput {
  return {
    allowPickup: s.allowPickup,
    pickupNote: s.pickupNote ?? '',
    shippingEnabled: s.shippingEnabled,
    shippingConnectionIds: [...s.shippingConnectionIds],
    carrierSelection: s.carrierSelection,
    defaultItemWeightGrams: s.defaultItemWeightGrams,
    packagingWeightGrams: s.packagingWeightGrams,
    packageLengthCm: s.packageLengthCm,
    packageWidthCm: s.packageWidthCm,
    packageHeightCm: s.packageHeightCm,
    declareInsurance: s.declareInsurance,
    freeShippingThreshold: s.freeShippingThreshold ?? null,
    inspectionPolicy: s.inspectionPolicy,
    pickupBranchId: s.pickupBranchId ?? null,
  };
}

export default function OnlineShopSettingsCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [settings, setSettings] = useState<IOnlineShopSettings | null>(null);
  const [form, setForm] = useState<IOnlineShopSettingsInput | null>(null);
  const [carriers, setCarriers] = useState<IShippingCarrier[]>([]);
  const [connections, setConnections] = useState<IShippingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; connection?: IShippingConnection | null }>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([getShippingCarriers(), getShippingConnections()]);
      setCarriers(c);
      setConnections(list);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được kết nối hãng vận chuyển'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getOnlineShopSettings();
      setSettings(s);
      setForm(inputOf(s));
      if (s.shippingServiceEnabled) await loadConnections();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được cài đặt bán online'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, loadConnections]);

  useEffect(() => {
    load();
  }, [load]);

  /** Sau khi sửa địa chỉ gửi hàng: lấy lại danh sách chi nhánh, giữ nguyên các ô đang sửa chưa lưu. */
  const refreshBranches = useCallback(async () => {
    try {
      setSettings(await getOnlineShopSettings());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải lại được chi nhánh'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (!settings || !form) {
    return (
      <Alert severity="error" action={<Button onClick={load}>Thử lại</Button>}>
        Không tải được cài đặt bán online.
      </Alert>
    );
  }

  const set = <K extends keyof IOnlineShopSettingsInput>(key: K, value: IOnlineShopSettingsInput[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));
  const num = (key: keyof IOnlineShopSettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (e.target.value === '' ? 0 : Number(e.target.value)) as never);

  const activeConnections = connections.filter((c) => c.status === 'active');
  const quotedAll = form.shippingConnectionIds.length === 0;

  const toggleQuoted = (id: string) => {
    const base = quotedAll ? activeConnections.map((c) => c.id) : form.shippingConnectionIds;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    // Tích lại đủ mọi kết nối = "mọi kết nối đang bật" (kết nối thêm sau cũng tự được báo giá).
    set('shippingConnectionIds', next.length === activeConnections.length ? [] : next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateOnlineShopSettings({
        ...form,
        pickupNote: form.pickupNote?.trim() || null,
        freeShippingThreshold: form.freeShippingThreshold ? form.freeShippingThreshold : null,
      });
      setSettings(res);
      setForm(inputOf(res));
      enqueueSnackbar('Đã lưu cài đặt bán online');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const test = async (c: IShippingConnection) => {
    setBusyId(c.id);
    try {
      const res = await testShippingConnection(c.id);
      enqueueSnackbar(res.message, { variant: res.ok ? 'success' : 'warning' });
      await loadConnections();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Kiểm tra thất bại'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (c: IShippingConnection) => {
    if (c.status === 'active') {
      const ok = await confirm({
        title: 'Tắt kết nối?',
        content: `Tắt "${c.displayName}": trang bán online thôi báo giá hãng này. Vận đơn đã tạo vẫn được cập nhật trạng thái.`,
        confirmText: 'Tắt',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusyId(c.id);
    try {
      if (c.status === 'active') await disableShippingConnection(c.id);
      else await updateShippingConnection(c.id, { active: true });
      await loadConnections();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Thao tác thất bại'), { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const carrierLabel = (code: string) => carriers.find((c) => c.code === code)?.label ?? code;

  return (
    <Stack spacing={3}>
      {confirmDialog}

      <Card>
        <CardHeader title="Cách nhận hàng" subheader="Khách chọn một trong các cách bên dưới ở trang đặt hàng." />
        <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
          <FormControlLabel
            control={<Switch checked={form.allowPickup} onChange={(e) => set('allowPickup', e.target.checked)} />}
            label="Nhận tại cửa hàng (không phí ship)"
          />
          {form.allowPickup && (
            <TextField
              label="Địa chỉ / giờ nhận hàng hiện cho khách"
              value={form.pickupNote ?? ''}
              onChange={(e) => set('pickupNote', e.target.value)}
              placeholder="Vd: 21 Chùa Láng, Đống Đa — 9:00–21:30 hằng ngày"
              inputProps={{ maxLength: 500 }}
            />
          )}
          <FormControlLabel
            control={
              <Switch
                checked={form.shippingEnabled}
                onChange={(e) => set('shippingEnabled', e.target.checked)}
                disabled={!settings.shippingServiceEnabled}
              />
            }
            label="Giao tận nơi qua hãng vận chuyển"
          />
          {!settings.shippingServiceEnabled && (
            <Alert severity="info">
              Dịch vụ giao hàng (spark-shipping) chưa bật trên hệ thống — tạm thời chỉ có nhận tại cửa hàng.
            </Alert>
          )}
        </Stack>
      </Card>

      {settings.shippingServiceEnabled && (
        <PickupBranchCard
          settings={settings}
          value={form.pickupBranchId ?? null}
          onChange={(id) => set('pickupBranchId', id)}
          onRefresh={refreshBranches}
        />
      )}

      {settings.shippingServiceEnabled && (
        <Card>
          <CardHeader
            title="Hãng vận chuyển"
            subheader="Shop / tài khoản hãng của cửa hàng (cước trừ vào tài khoản hãng). Khoá API của hãng do nền tảng giữ — cửa hàng chỉ liên kết bằng SĐT."
            action={
              <Button
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
                onClick={() => setDialog({ open: true, connection: null })}
              >
                Thêm kết nối
              </Button>
            }
          />
          <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
            {settings.connectionsError && <Alert severity="warning">{settings.connectionsError}</Alert>}
            {connections.length === 0 && (
              <Alert severity="info">Chưa kết nối hãng nào. Liên kết shop GHN (hoặc tài khoản Ahamove) của cửa hàng để báo phí ship.</Alert>
            )}

            {connections.map((c) => {
              const active = c.status === 'active';
              const quoted = active && (quotedAll || form.shippingConnectionIds.includes(c.id));
              const carrier = carriers.find((x) => x.code === c.carrier);
              return (
                <Box key={c.id} sx={{ p: 2, borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <Stack sx={{ flexGrow: 1 }} spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="subtitle2">{c.displayName}</Typography>
                        <Chip size="small" variant="outlined" label={carrierLabel(c.carrier)} />
                        {c.environment === 'staging' && <Chip size="small" color="warning" variant="outlined" label="Thử nghiệm" />}
                        <Chip size="small" color={active ? 'success' : 'default'} variant="soft" label={active ? 'Đang bật' : 'Đã tắt'} />
                      </Stack>
                      {c.lastError && (
                        <Typography variant="caption" color="error.main">
                          {c.lastError}
                        </Typography>
                      )}
                    </Stack>
                    <FormControlLabel
                      control={<Checkbox checked={quoted} disabled={!active} onChange={() => toggleQuoted(c.id)} />}
                      label="Báo giá cho khách"
                    />
                    <LoadingButton size="small" loading={busyId === c.id} onClick={() => test(c)}>
                      Kiểm tra
                    </LoadingButton>
                    <Button size="small" onClick={() => setDialog({ open: true, connection: c })}>
                      Sửa
                    </Button>
                    <Button size="small" color={active ? 'error' : 'primary'} onClick={() => toggleActive(c)} disabled={busyId === c.id}>
                      {active ? 'Tắt' : 'Bật lại'}
                    </Button>
                  </Stack>
                  <Box sx={{ mt: 2 }}>
                    {c.webhookUrl ? (
                      <CopyField
                        label="URL webhook (dán vào trang cấu hình webhook của hãng)"
                        value={c.webhookUrl}
                        helperText={carrier?.webhookHelp}
                      />
                    ) : (
                      carrier?.webhookHelp && (
                        <Typography variant="caption" color="text.secondary">
                          {carrier.webhookHelp}
                        </Typography>
                      )
                    )}
                    {carrier && c.webhookUrl && carrierLinksFor(carrier, c.environment, ['webhook', 'token']).length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                        {carrierLinksFor(carrier, c.environment, ['webhook', 'token']).map((l) => (
                          <Button
                            key={l.url}
                            size="small"
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            endIcon={<Iconify icon="eva:external-link-fill" width={16} />}
                          >
                            {l.label}
                          </Button>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Box>
              );
            })}

            <Divider sx={{ borderStyle: 'dashed' }} />

            <Typography variant="subtitle2">Khi có nhiều hãng</Typography>
            <RadioGroup
              value={form.carrierSelection}
              onChange={(e) => set('carrierSelection', e.target.value as IOnlineShopSettingsInput['carrierSelection'])}
            >
              <FormControlLabel value="cheapest" control={<Radio />} label="Tự chọn hãng rẻ nhất (khách chỉ thấy một phí ship)" />
              <FormControlLabel value="choose" control={<Radio />} label="Cho khách chọn hãng (hiện phí + ngày giao dự kiến của từng hãng)" />
            </RadioGroup>
          </Stack>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Tính phí ship"
          subheader="Hãng tính cước theo khối lượng thực hoặc khối lượng quy đổi từ kích thước hộp (D×R×C ÷ 5.000 với GHN, ÷ 6.000 với GHTK), lấy số lớn hơn."
        />
        <Stack spacing={2.5} sx={{ p: 3, pt: 2 }}>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            <TextField
              type="number"
              label="Khối lượng mỗi sản phẩm (khi chưa khai)"
              value={form.defaultItemWeightGrams}
              onChange={num('defaultItemWeightGrams')}
              InputProps={{ endAdornment: <InputAdornment position="end">gram</InputAdornment> }}
              helperText="Sản phẩm có khối lượng trong danh mục hàng thì dùng số đó"
            />
            <TextField
              type="number"
              label="Bao bì cộng thêm mỗi đơn"
              value={form.packagingWeightGrams}
              onChange={num('packagingWeightGrams')}
              InputProps={{ endAdornment: <InputAdornment position="end">gram</InputAdornment> }}
            />
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {(['packageLengthCm', 'packageWidthCm', 'packageHeightCm'] as const).map((key, i) => (
              <TextField
                key={key}
                type="number"
                label={['Dài hộp', 'Rộng hộp', 'Cao hộp'][i]}
                value={form[key]}
                onChange={num(key)}
                InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
              />
            ))}
          </Box>
          <TextField
            type="number"
            label="Miễn phí ship cho đơn từ"
            value={form.freeShippingThreshold ?? ''}
            onChange={(e) => set('freeShippingThreshold', e.target.value === '' ? null : Number(e.target.value))}
            InputProps={{ endAdornment: <InputAdornment position="end">₫</InputAdornment> }}
            helperText="Để trống = khách luôn trả phí ship. Đủ ngưỡng thì cửa hàng chịu cước — chi phí hiện ở chi tiết đơn."
            sx={{ maxWidth: 360 }}
          />
          <FormControlLabel
            control={<Switch checked={form.declareInsurance} onChange={(e) => set('declareInsurance', e.target.checked)} />}
            label="Khai giá trị hàng để hãng bảo hiểm (GHN, GHTK miễn phí dưới 1.000.000 ₫, trên đó khoảng 0,5% giá trị)"
          />
          <TextField
            select
            label="Cho người nhận xem hàng"
            value={form.inspectionPolicy}
            onChange={(e) => set('inspectionPolicy', e.target.value as IOnlineShopSettingsInput['inspectionPolicy'])}
            sx={{ maxWidth: 360 }}
          >
            <MenuItem value="view_no_try">Cho xem, không cho thử</MenuItem>
            <MenuItem value="try">Cho thử hàng</MenuItem>
            <MenuItem value="no_view">Không cho xem hàng</MenuItem>
          </TextField>

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button color="inherit" onClick={() => setForm(inputOf(settings))} disabled={saving}>
              Hoàn tác
            </Button>
            <LoadingButton
              variant="contained"
              loading={saving}
              onClick={save}
              disabled={!form.allowPickup && !form.shippingEnabled}
            >
              Lưu
            </LoadingButton>
          </Stack>
        </Stack>
      </Card>

      <ShippingConnectionDialog
        open={dialog.open}
        connection={dialog.connection ?? null}
        carriers={carriers}
        onClose={() => setDialog({ open: false })}
        onSaved={async () => {
          setDialog({ open: false });
          await loadConnections();
        }}
      />
    </Stack>
  );
}
