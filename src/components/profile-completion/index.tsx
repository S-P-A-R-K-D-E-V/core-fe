'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LoadingButton from '@mui/lab/LoadingButton';

import { useSnackbar } from 'src/components/snackbar';
import Iconify from 'src/components/iconify';

import { IUser, IVietQRBank } from 'src/types/corecms-api';
import { getCurrentUser, updateMyProfile } from 'src/api/users';
import { getVietQRBanks } from 'src/api/bank-accounts';

// ----------------------------------------------------------------------

const SESSION_SKIP_KEY = 'profile_completion_skip';

function getMissing(user: IUser) {
  return {
    phone: !user.phoneNumber?.trim(),
    address: !user.address?.trim(),
    // Bank is incomplete when either code or number is missing
    bank: !user.bankCode?.trim() || !user.bankNo?.trim(),
  };
}

// ----------------------------------------------------------------------

export default function ProfileCompletionDialog() {
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<IUser | null>(null);
  const [banks, setBanks] = useState<IVietQRBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [missing, setMissing] = useState({ phone: false, address: false, bank: false });

  // Controlled field values
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedBank, setSelectedBank] = useState<IVietQRBank | null>(null);
  const [bankNo, setBankNo] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_SKIP_KEY)) return;

    getCurrentUser()
      .then((user) => {
        const m = getMissing(user);
        // Nothing to fill — skip silently
        if (!m.phone && !m.address && !m.bank) return;

        setProfile(user);
        setMissing(m);
        setPhone(user.phoneNumber || '');
        setAddress(user.address || '');
        setBankNo(user.bankNo || '');
        setOpen(true);

        // Load bank list in background only when bank info is missing
        if (m.bank) {
          setBanksLoading(true);
          getVietQRBanks()
            .then((list) => {
              setBanks(list);
              if (user.bankCode) {
                const match = list.find((b) => b.code === user.bankCode);
                if (match) setSelectedBank(match);
              }
            })
            .catch(console.error)
            .finally(() => setBanksLoading(false));
        }
      })
      .catch(console.error);
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (missing.phone && !phone.trim()) errs.phone = 'Vui lòng nhập số điện thoại';
    if (missing.address && !address.trim()) errs.address = 'Vui lòng nhập địa chỉ';
    if (missing.bank) {
      if (!selectedBank) errs.bankCode = 'Vui lòng chọn ngân hàng';
      if (!bankNo.trim()) errs.bankNo = 'Vui lòng nhập số tài khoản';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const clearError = (key: string) =>
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const handleSkip = () => {
    sessionStorage.setItem(SESSION_SKIP_KEY, '1');
    setOpen(false);
  };

  const handleSave = async () => {
    if (!profile || !validate()) return;
    try {
      setSaving(true);
      await updateMyProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        // Merge new values with existing ones so we never wipe filled fields
        phoneNumber: phone.trim() || profile.phoneNumber || undefined,
        address: address.trim() || profile.address || undefined,
        bankCode: selectedBank?.code || profile.bankCode || undefined,
        bankNo: bankNo.trim() || profile.bankNo || undefined,
        profileImageUrl: profile.profileImageUrl || undefined,
      });
      enqueueSnackbar('Đã cập nhật thông tin cá nhân!', { variant: 'success' });
      setOpen(false);
    } catch (err) {
      console.error(err);
      enqueueSnackbar('Cập nhật thất bại, vui lòng thử lại', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const missingCount = Object.values(missing).filter(Boolean).length;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Iconify
            icon="solar:user-id-bold-duotone"
            width={30}
            sx={{ color: 'warning.main', flexShrink: 0 }}
          />
          <Box>
            <Typography variant="h6" lineHeight={1.3}>
              Hoàn thiện thông tin cá nhân
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Còn {missingCount} nhóm thông tin chưa điền
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Vui lòng bổ sung các thông tin còn thiếu để hệ thống có thể xử lý lương và liên lạc
            chính xác.
          </Typography>

          {/* ── Số điện thoại ── */}
          {missing.phone && (
            <TextField
              label="Số điện thoại"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearError('phone');
              }}
              error={!!fieldErrors.phone}
              helperText={fieldErrors.phone}
              placeholder="Ví dụ: 0901 234 567"
              fullWidth
              inputProps={{ inputMode: 'tel' }}
              InputProps={{
                startAdornment: (
                  <Iconify
                    icon="solar:phone-bold-duotone"
                    width={20}
                    sx={{ mr: 1, color: 'text.disabled' }}
                  />
                ),
              }}
            />
          )}

          {/* ── Địa chỉ ── */}
          {missing.address && (
            <TextField
              label="Địa chỉ"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                clearError('address');
              }}
              error={!!fieldErrors.address}
              helperText={fieldErrors.address}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              fullWidth
              multiline
              rows={2}
            />
          )}

          {/* ── Thông tin ngân hàng ── */}
          {missing.bank && (
            <>
              {(missing.phone || missing.address) && <Divider />}

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Thông tin ngân hàng (nhận lương)
                </Typography>

                <Stack spacing={2}>
                  {/* Bank selector */}
                  <Autocomplete
                    options={banks}
                    loading={banksLoading}
                    value={selectedBank}
                    onChange={(_, val) => {
                      setSelectedBank(val);
                      clearError('bankCode');
                    }}
                    getOptionLabel={(o) => `${o.shortName} — ${o.name}`}
                    isOptionEqualToValue={(a, b) => a.code === b.code}
                    renderOption={(props, option) => {
                      const { key, ...rest } = props as any;
                      return (
                        <Box
                          key={key}
                          component="li"
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}
                          {...rest}
                        >
                          <Avatar
                            src={option.logo}
                            alt={option.shortName}
                            variant="rounded"
                            sx={{ width: 32, height: 32, '& img': { objectFit: 'contain' } }}
                          />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {option.shortName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.name}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Ngân hàng"
                        error={!!fieldErrors.bankCode}
                        helperText={fieldErrors.bankCode || 'Chọn ngân hàng nhận lương'}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: selectedBank ? (
                            <>
                              <Avatar
                                src={selectedBank.logo}
                                alt={selectedBank.shortName}
                                variant="rounded"
                                sx={{
                                  width: 22,
                                  height: 22,
                                  mr: 0.5,
                                  '& img': { objectFit: 'contain' },
                                }}
                              />
                              {params.InputProps.startAdornment}
                            </>
                          ) : (
                            params.InputProps.startAdornment
                          ),
                        }}
                      />
                    )}
                  />

                  {/* Account number */}
                  <TextField
                    label="Số tài khoản"
                    value={bankNo}
                    onChange={(e) => {
                      setBankNo(e.target.value);
                      clearError('bankNo');
                    }}
                    error={!!fieldErrors.bankNo}
                    helperText={fieldErrors.bankNo || 'Nhập đúng số tài khoản để nhận lương'}
                    placeholder="Ví dụ: 1234567890"
                    fullWidth
                    inputProps={{ inputMode: 'numeric' }}
                    InputProps={{
                      startAdornment: (
                        <Iconify
                          icon="solar:card-bold-duotone"
                          width={20}
                          sx={{ mr: 1, color: 'text.disabled' }}
                        />
                      ),
                    }}
                  />
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="text"
          color="inherit"
          onClick={handleSkip}
          sx={{ mr: 'auto', color: 'text.secondary' }}
        >
          Bỏ qua lần này
        </Button>
        <LoadingButton
          variant="contained"
          onClick={handleSave}
          loading={saving}
          startIcon={<Iconify icon="solar:diskette-bold" width={18} />}
        >
          Lưu thông tin
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
