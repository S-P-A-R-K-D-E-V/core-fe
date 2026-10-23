'use client';

import type { PaymentChannel, IPaymentOption, IPaymentChannels } from 'src/types/online-shop';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import { getPaymentChannels, updatePaymentChannels } from 'src/api/online-shop';

import { useSnackbar } from 'src/components/snackbar';

import { channelDraft, togglePaymentOption, posDefaultChoices, type ChannelDraft } from './payment-channels-utils';

// ----------------------------------------------------------------------
// Phương thức theo kênh: một bảng, mỗi dòng một lựa chọn thanh toán (tiền mặt, thẻ, VietQR theo tài khoản, chuyển khoản
// qua kết nối S Payment như ApiPay, payOS, VNPay), mỗi cột một kênh — chủ cửa hàng tích ô nào dùng ở quầy (POS, F&B) và ô
// nào hiện trên trang bán online. Ô "—" = lựa chọn đó không dùng được cho kênh (vd tiền mặt ở trang online).
// ----------------------------------------------------------------------

const CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: 'pos', label: 'Quầy (POS)' },
  { value: 'online', label: 'Bán online' },
];

type Props = {
  /** Mở tab Báo có & kết nối (thêm kết nối ApiPay / ngân hàng). */
  onOpenConnections?: () => void;
};

export default function PaymentChannelsCard({ onOpenConnections }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IPaymentChannels | null>(null);
  const [draft, setDraft] = useState<ChannelDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentChannels();
      setData(res);
      setDraft(channelDraft(res));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được phương thức thanh toán'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const defaultChoices = useMemo(
    () => (data && draft ? posDefaultChoices(data.options, draft.pos) : []),
    [data, draft]
  );

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (!data || !draft) {
    return (
      <Alert severity="error" action={<Button onClick={load}>Thử lại</Button>}>
        Không tải được phương thức thanh toán.
      </Alert>
    );
  }

  const toggle = (channel: PaymentChannel, key: string) => setDraft((d) => (d ? togglePaymentOption(d, channel, key) : d));

  const save = async () => {
    setSaving(true);
    try {
      const res = await updatePaymentChannels({
        pos: { enabled: draft.pos, defaultTransfer: draft.posDefault || null },
        online: { enabled: draft.online },
      });
      setData(res);
      setDraft(channelDraft(res));
      enqueueSnackbar('Đã lưu phương thức thanh toán');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const hasConnection = data.options.some((o) => o.kind === 'transfer' && o.autoConfirm);

  return (
    <Card>
      <CardHeader
        title="Phương thức thanh toán theo kênh"
        subheader="Tích ô để bật phương thức cho từng kênh bán. Quầy chỉ hiện phương thức / nguồn chuyển khoản được bật; trang bán online chỉ cho khách chọn các ô ở cột Bán online."
      />

      <Stack spacing={2} sx={{ p: 3, pt: 2 }}>
        {!data.paymentServiceEnabled && (
          <Alert severity="info">
            S Payment chưa bật cho cửa hàng — chỉ có tiền mặt, thẻ và VietQR theo tài khoản (không tự xác nhận). Bán online
            cần một kết nối xác nhận tiền về.
          </Alert>
        )}
        {data.paymentServiceEnabled && !hasConnection && (
          <Alert
            severity="warning"
            action={onOpenConnections && <Button color="inherit" onClick={onOpenConnections}>Thêm kết nối</Button>}
          >
            Chưa có kết nối xác nhận tiền về (ApiPay, ngân hàng trực tiếp…). Trang bán online cần ít nhất một kết nối để đơn tự
            xác nhận khi khách chuyển khoản.
          </Alert>
        )}
        {!data.pos.configured && (
          <Alert severity="info">
            Chưa lưu cấu hình quầy: quầy đang dùng mọi phương thức như trước. Bấm Lưu để áp dụng lựa chọn bên dưới.
          </Alert>
        )}
        {draft.online.length === 0 && (
          <Alert severity="warning">Trang bán online chưa nhận thanh toán — tích ít nhất một ô ở cột Bán online.</Alert>
        )}

        <TableContainer sx={{ border: (theme) => `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Phương thức</TableCell>
                {CHANNELS.map((c) => (
                  <TableCell key={c.value} align="center" sx={{ width: 110 }}>
                    {c.label}
                  </TableCell>
                ))}
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Chi phí</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.options.map((option) => (
                <OptionRow key={option.key} option={option} draft={draft} onToggle={toggle} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TextField
          select
          label="Nguồn chuyển khoản mặc định ở quầy"
          value={draft.posDefault}
          onChange={(e) => setDraft({ ...draft, posDefault: e.target.value })}
          helperText="Quầy tự chọn sẵn nguồn này khi tạo mã QR; để trống thì mỗi máy quầy nhớ lựa chọn lần trước."
          sx={{ maxWidth: 560 }}
        >
          <MenuItem value="">Để máy quầy tự nhớ</MenuItem>
          {defaultChoices.map((o) => (
            <MenuItem key={o.key} value={o.key}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" justifyContent="flex-end" spacing={1}>
          <Button color="inherit" onClick={() => setDraft(channelDraft(data))} disabled={saving}>
            Hoàn tác
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={save} disabled={draft.pos.length === 0}>
            Lưu
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );
}

// ----------------------------------------------------------------------

type RowProps = {
  option: IPaymentOption;
  draft: ChannelDraft;
  onToggle: (channel: PaymentChannel, key: string) => void;
};

function OptionRow({ option, draft, onToggle }: RowProps) {
  return (
    <TableRow hover>
      <TableCell>
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2">{option.label}</Typography>
            {option.autoConfirm && <Chip size="small" color="success" variant="soft" label="Tự xác nhận" />}
            {option.environment === 'test' && <Chip size="small" color="warning" variant="outlined" label="Thử nghiệm" />}
          </Stack>
          {option.detail && (
            <Typography variant="caption" color="text.secondary">
              {option.detail}
            </Typography>
          )}
          {option.feeNote && (
            <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none' } }}>
              {option.feeNote}
            </Typography>
          )}
        </Stack>
      </TableCell>
      {CHANNELS.map((c) => {
        const usable = option.channels.includes(c.value);
        const checked = (c.value === 'pos' ? draft.pos : draft.online).includes(option.key);
        return (
          <TableCell key={c.value} align="center">
            {usable ? (
              <Checkbox
                checked={checked}
                onChange={() => onToggle(c.value, option.key)}
                inputProps={{ 'aria-label': `${option.label} — ${c.label}` }}
              />
            ) : (
              <Tooltip title={c.value === 'online' ? 'Không dùng cho bán online (cần tự xác nhận tiền về)' : 'Chỉ dùng cho bán online'}>
                <Typography variant="body2" color="text.disabled">
                  —
                </Typography>
              </Tooltip>
            )}
          </TableCell>
        );
      })}
      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
        <Typography variant="caption" color="text.secondary">
          {option.feeNote ?? 'Không phát sinh phí'}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
