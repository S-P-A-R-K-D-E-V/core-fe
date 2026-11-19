'use client';

import type { CustomerPanel, ConversationDetail, CustomerUpdateInput } from 'src/lib/inbox';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';

import { fDate } from 'src/utils/format-time';
import { hasApiErrorCode, apiErrorMessage } from 'src/utils/api-error';

import { fVnd, normalizeTags, TAG_MAX_COUNT, TAG_MAX_LENGTH } from 'src/lib/inbox';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Cột thông tin khách: sửa tên / SĐT / địa chỉ / ghi chú (PUT customer — SĐT trùng đúng một khách cũ thì máy chủ gộp vào
// khách đó), nhãn hội thoại (PUT tags), lịch sử mua, thẻ "Trạng thái đơn đặt hàng" (5 hoá đơn gần nhất; nút Tạo đơn đặt
// hàng chờ F4 — chốt đơn trong hội thoại).
// ----------------------------------------------------------------------

type Props = {
  detail: ConversationDetail;
  /** Có quyền conversation.reply. */
  canEdit: boolean;
  /** Nhãn gợi ý (đã dùng ở các hội thoại khác). */
  tagOptions: string[];
  onSaveCustomer: (input: CustomerUpdateInput) => Promise<CustomerPanel>;
  onSaveTags: (tags: string[]) => Promise<void>;
  onClose?: VoidFunction;
};

type Form = { name: string; phone: string; address: string; note: string };

function formFrom(detail: ConversationDetail): Form {
  const p = detail.customerPanel;
  return {
    name: p?.name ?? detail.customer.name ?? '',
    phone: p?.phone ?? detail.customer.phone ?? '',
    address: p?.address ?? '',
    note: p?.note ?? '',
  };
}

export default function InboxCustomerPanel({ detail, canEdit, tagOptions, onSaveCustomer, onSaveTags, onClose }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const panel = detail.customerPanel;

  const [form, setForm] = useState<Form>(() => formFrom(detail));
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);

  // Đổi hội thoại / máy chủ trả hồ sơ mới → nạp lại form.
  const formKey = `${detail.id}|${panel?.id ?? ''}|${panel?.name ?? ''}|${panel?.phone ?? ''}|${panel?.address ?? ''}|${panel?.note ?? ''}`;
  useEffect(() => {
    setForm(formFrom(detail));
    setPhoneError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const initial = formFrom(detail);
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k].trim() !== initial[k].trim());

  const handleSave = async () => {
    const input: CustomerUpdateInput = {};
    (Object.keys(form) as (keyof Form)[]).forEach((k) => {
      if (form[k].trim() !== initial[k].trim()) input[k] = form[k].trim();
    });
    setSaving(true);
    setPhoneError(null);
    try {
      const saved = await onSaveCustomer(input);
      enqueueSnackbar(
        panel && saved.id !== panel.id ? 'Đã gắn hội thoại vào khách cũ trùng SĐT' : 'Đã lưu thông tin khách'
      );
    } catch (err) {
      if (hasApiErrorCode(err, 'Customer.PhoneAmbiguous')) {
        setPhoneError(
          apiErrorMessage(err, 'SĐT này trùng nhiều khách cũ — kiểm tra lại ở danh sách Khách hàng rồi sửa SĐT.')
        );
      } else {
        enqueueSnackbar(apiErrorMessage(err, 'Không lưu được thông tin khách'), { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTags = async (value: string[]) => {
    const tags = normalizeTags(value);
    if (value.length > TAG_MAX_COUNT) enqueueSnackbar(`Tối đa ${TAG_MAX_COUNT} nhãn`, { variant: 'warning' });
    setSavingTags(true);
    try {
      await onSaveTags(tags);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được nhãn'), { variant: 'error' });
    } finally {
      setSavingTags(false);
    }
  };

  const field = (key: keyof Form, label: string, extra?: Partial<React.ComponentProps<typeof TextField>>) => (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={form[key]}
      disabled={!canEdit}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      {...extra}
    />
  );

  return (
    <Stack sx={{ height: 1, minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, minHeight: 56 }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          Thông tin khách
        </Typography>
        {onClose && (
          <Button size="small" color="inherit" onClick={onClose} startIcon={<Iconify icon="mingcute:close-line" />}>
            Đóng
          </Button>
        )}
      </Stack>
      <Divider />

      <Scrollbar sx={{ flex: 1, minHeight: 0 }}>
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack alignItems="center" spacing={1} sx={{ pt: 1, textAlign: 'center' }}>
            <Avatar src={panel?.avatarUrl ?? detail.customer.avatarUrl ?? undefined} sx={{ width: 72, height: 72 }}>
              {(panel?.name ?? detail.customer.name)?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, maxWidth: 1 }}>
              <Typography variant="subtitle1" noWrap>
                {panel?.name ?? detail.customer.name}
              </Typography>
              <Stack
                direction="row"
                spacing={0.5}
                justifyContent="center"
                sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}
              >
                {(panel?.code ?? detail.customer.code) && (
                  <Label color="default">{panel?.code ?? detail.customer.code}</Label>
                )}
                {panel?.source && <Label color="info">{panel.source}</Label>}
                {!panel && <Label color="warning">Chưa có hồ sơ khách</Label>}
              </Stack>
            </Box>
          </Stack>

          {field('name', 'Tên khách')}
          {field('phone', 'Số điện thoại', {
            error: !!phoneError,
            helperText: phoneError ?? 'Trùng SĐT một khách cũ → tự gắn vào khách đó',
            inputProps: { inputMode: 'tel' },
          })}
          {field('address', 'Địa chỉ', { multiline: true, minRows: 1, maxRows: 4 })}
          {field('note', 'Ghi chú về khách', { multiline: true, minRows: 2, maxRows: 6 })}

          {canEdit && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {dirty && (
                <Button color="inherit" onClick={() => setForm(initial)} disabled={saving}>
                  Huỷ
                </Button>
              )}
              <LoadingButton variant="contained" size="small" loading={saving} disabled={!dirty} onClick={handleSave}>
                Lưu
              </LoadingButton>
            </Stack>
          )}

          <Divider />

          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Nhãn hội thoại
            </Typography>
            <Autocomplete
              multiple
              freeSolo
              size="small"
              options={tagOptions.filter((t) => !detail.tags.includes(t))}
              value={detail.tags}
              disabled={!canEdit || savingTags}
              onChange={(_, value) => handleTags(value as string[])}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key} size="small" label={option} {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={detail.tags.length ? '' : 'Thêm nhãn (Enter)'}
                  inputProps={{ ...params.inputProps, maxLength: TAG_MAX_LENGTH }}
                />
              )}
              sx={{ mt: 1 }}
            />
          </Box>

          <Divider />

          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Lịch sử mua
            </Typography>
            {panel ? (
              <>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Số đơn
                    </Typography>
                    <Typography variant="subtitle1">{panel.totalOrders}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      Tổng chi
                    </Typography>
                    <Typography variant="subtitle1">{fVnd(panel.totalSpent)}</Typography>
                  </Box>
                </Stack>
                {panel.lastPurchaseAt && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Mua gần nhất: {fDate(panel.lastPurchaseAt)}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
                Khách chưa có hồ sơ — lưu SĐT để gắn với khách cũ hoặc tạo hồ sơ mới.
              </Typography>
            )}
          </Box>

          <Card variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Iconify icon="solar:cart-large-2-bold" width={18} sx={{ color: 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                Trạng thái đơn đặt hàng
              </Typography>
            </Stack>

            {panel && panel.recentInvoices.length > 0 ? (
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {panel.recentInvoices.map((inv) => (
                  <Stack
                    key={inv.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ p: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
                  >
                    <Iconify icon="solar:bill-list-bold" width={18} sx={{ color: 'text.secondary' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {inv.code}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {fDate(inv.createdAt)}
                        {inv.channel ? ` · ${inv.channel}` : ''}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2">{fVnd(inv.total)}</Typography>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>
                Chưa có đơn / hoá đơn.
              </Typography>
            )}

            <Button
              fullWidth
              variant="outlined"
              disabled
              startIcon={<Iconify icon="mingcute:add-line" />}
              sx={{ mt: 1.5 }}
            >
              Tạo đơn đặt hàng
            </Button>
            <Typography variant="caption" component="div" sx={{ color: 'text.disabled', mt: 0.5, textAlign: 'center' }}>
              Sắp có (chốt đơn trong hội thoại — F4)
            </Typography>
          </Card>
        </Stack>
      </Scrollbar>
    </Stack>
  );
}
