'use client';

import type { IPaymentConnection, IApiPayBanksResponse } from 'src/types/payment-service';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { apiErrorMessage } from 'src/utils/api-error';

import { selectApiPayBank, getApiPayLinkedBanks } from 'src/api/payment-settings';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import ApiPayBankLinkDialog from './apipay-bank-link-dialog';
import {
  linkedBankStatus,
  apiPayConnections,
  coreBankAccountText,
  apiPayConnectionLabel,
} from './utils';

// ----------------------------------------------------------------------
// "Liên kết ngân hàng qua ApiPay" (tab Thanh toán, tab Tài khoản ngân hàng): chọn kết nối ApiPay → tài khoản đã liên
// kết (trạng thái, số VA, đang nhận tiền) → Liên kết tài khoản mới / Dùng tài khoản này / Kiểm tra lại. Tài khoản chờ
// ApiPay kích hoạt mà đã xong thì "Kiểm tra lại" tự gắn vào kết nối + thêm vào Tài khoản ngân hàng.
// ----------------------------------------------------------------------

type Props = {
  /** Mọi kết nối của cửa hàng — chỉ lấy kết nối ApiPay */
  connections: IPaymentConnection[];
  /** Không có kết nối ApiPay thì ẩn hẳn thẻ (tab Tài khoản ngân hàng) thay vì hiện hướng dẫn */
  hideWhenEmpty?: boolean;
  /** Kết nối / tài khoản ngân hàng đã đổi → nơi gọi tải lại */
  onChanged: VoidFunction;
};

export default function ApiPayBankLinkCard({ connections, hideWhenEmpty, onChanged }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const options = useMemo(() => apiPayConnections(connections), [connections]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState<IApiPayBanksResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usingId, setUsingId] = useState<string | null>(null);

  const selected = options.find((c) => c.id === selectedId) ?? options[0] ?? null;
  const connectionId = selected?.id;

  const load = useCallback(async () => {
    if (!connectionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getApiPayLinkedBanks(connectionId);
      setData(res);
      if (res.applied) {
        // Tài khoản chờ kích hoạt vừa xong → máy chủ đã gắn vào kết nối.
        enqueueSnackbar(
          `Tài khoản ${res.applied.accountNumber} đã kích hoạt và thành tài khoản nhận của kết nối. ${
            coreBankAccountText(res.coreBankAccount) ?? ''
          }`.trim()
        );
        onChanged();
      }
    } catch (err) {
      setData(null);
      setError(apiErrorMessage(err, 'Không tải được tài khoản đã liên kết trên ApiPay'));
    } finally {
      setLoading(false);
    }
  }, [connectionId, enqueueSnackbar, onChanged]);

  useEffect(() => {
    setData(null);
    load();
    // Chỉ tải lại khi đổi kết nối — tránh gọi ApiPay mỗi lần nơi gọi dựng lại danh sách kết nối.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  const handleUse = async (publicId: string) => {
    if (!connectionId) return;
    setUsingId(publicId);
    try {
      const res = await selectApiPayBank(connectionId, publicId);
      enqueueSnackbar(
        `Kết nối nhận tiền qua ${res.applied?.accountNumber ?? 'tài khoản đã chọn'}. ${
          coreBankAccountText(res.coreBankAccount) ?? ''
        }`.trim()
      );
      onChanged();
      await load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không dùng được tài khoản này'), { variant: 'error' });
    } finally {
      setUsingId(null);
    }
  };

  if (!options.length && hideWhenEmpty) return null;

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">Liên kết ngân hàng qua ApiPay</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Liên kết tài khoản nhận tiền vào ApiPay ngay tại đây (OTP ngân hàng) — không cần vào
              my.apipay.vn. Ngân hàng cấp tài khoản ảo (MB, BIDV, OCB, VIB, VPBank...) thì QR in số
              VA. Chỉ tạo tài khoản ApiPay và API key là làm trên my.apipay.vn.
            </Typography>
          </Stack>
          {selected && (
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => setDialogOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              Liên kết tài khoản mới
            </Button>
          )}
        </Stack>

        {!selected && (
          <Alert severity="info">
            Chưa có kết nối ApiPay. Tạo tài khoản và API key trên my.apipay.vn, thêm kết nối ApiPay
            (Thêm kết nối → ApiPay) bằng Access key + Secret key, rồi liên kết ngân hàng tại đây.
          </Alert>
        )}

        {options.length > 1 && (
          <TextField
            select
            label="Kết nối ApiPay"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {options.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {apiPayConnectionLabel(c)}
              </MenuItem>
            ))}
          </TextField>
        )}
        {options.length === 1 && selected && (
          <Typography variant="body2">
            Kết nối: <b>{apiPayConnectionLabel(selected)}</b>
          </Typography>
        )}

        {selected?.status === 'disabled' && (
          <Alert severity="warning">
            Kết nối đang tắt — vẫn liên kết được, nhưng phải bật lại kết nối thì tiền về mới tự xác
            nhận.
          </Alert>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        {selected && (
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Tài khoản đã liên kết</Typography>
              <LoadingButton
                size="small"
                loading={loading}
                startIcon={<Iconify icon="solar:refresh-bold" />}
                onClick={load}
              >
                Kiểm tra lại
              </LoadingButton>
            </Stack>

            {loading && !data && <Skeleton variant="rounded" height={64} />}

            {data && data.banks.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Tài khoản ApiPay này chưa liên kết ngân hàng nào.
              </Typography>
            )}

            {data && data.banks.length > 0 && (
              <Stack spacing={1.5} divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
                {data.banks.map((b) => {
                  const status = linkedBankStatus(b);
                  return (
                    <Stack
                      key={b.publicId}
                      direction={{ xs: 'column', sm: 'row' }}
                      alignItems={{ sm: 'center' }}
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                          useFlexGap
                        >
                          <Typography variant="subtitle2">
                            {b.bankName || b.bankShortName || 'Ngân hàng'} · {b.accountNumber}
                          </Typography>
                          <Label color={status.color}>{status.label}</Label>
                          {b.inUse && <Label color="info">Đang nhận tiền</Label>}
                          {b.pending && !b.inUse && (
                            <Label color="warning">Tự gắn khi kích hoạt xong</Label>
                          )}
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {b.vaNumber
                            ? `Số VA in trên QR: ${b.vaNumber}`
                            : 'Không có tài khoản ảo — QR in số gốc'}
                          {b.accountName ? ` · ${b.accountName}` : ''}
                          {b.nickname ? ` · ${b.nickname}` : ''}
                        </Typography>
                      </Stack>
                      {b.status === 'active' && !b.inUse && (
                        <LoadingButton
                          size="small"
                          variant="outlined"
                          loading={usingId === b.publicId}
                          disabled={!!usingId && usingId !== b.publicId}
                          onClick={() => handleUse(b.publicId)}
                          sx={{ flexShrink: 0 }}
                        >
                          Dùng tài khoản này
                        </LoadingButton>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}
      </Stack>

      <ApiPayBankLinkDialog
        open={dialogOpen}
        connection={selected}
        onClose={() => setDialogOpen(false)}
        onChanged={() => {
          onChanged();
          load();
        }}
      />
    </Card>
  );
}
