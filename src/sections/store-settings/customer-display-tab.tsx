'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { getStorageUrl } from 'src/utils/storage';

import { getBranchLocations } from 'src/api/attendance';
import {
  getCustomerDisplaySettings,
  saveCustomerDisplaySettings,
  deleteCustomerDisplayBranch,
  uploadCustomerDisplayMedia,
  type CustomerDisplaySlideDto,
  type CustomerDisplayConfigDto,
} from 'src/api/customer-display';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { openCustomerDisplayWindow } from 'src/sections/customer-display/customer-display-bus';

// ----------------------------------------------------------------------
// Cài đặt cửa hàng → Màn hình khách: ảnh / video quảng cáo chạy trên màn phụ ở quầy khi không bán hàng. Một bộ mặc
// định cho cả cửa hàng, chi nhánh nào cần khác thì tạo bộ riêng.

const DEFAULT_SCOPE = 'store';
const MAX_SLIDES = 20;

type Branch = { id: string; branchName: string };

export default function CustomerDisplayTab() {
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [settings, setSettings] = useState<CustomerDisplayConfigDto[]>([]);
  const [scope, setScope] = useState<string>(DEFAULT_SCOPE);
  const [slides, setSlides] = useState<CustomerDisplaySlideDto[]>([]);
  const [interval, setIntervalSeconds] = useState(8);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const branchId = scope === DEFAULT_SCOPE ? null : scope;
  const own = settings.find((s) => (s.branchId ?? null) === branchId) ?? null;
  const storeDefault = settings.find((s) => !s.branchId) ?? null;
  const usingDefault = branchId !== null && !own;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, branchList] = await Promise.all([getCustomerDisplaySettings(), getBranchLocations()]);
      setSettings(list);
      setBranches(branchList);
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Không tải được cài đặt màn hình khách', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  // Đổi phạm vi (mặc định / chi nhánh) → nạp bộ slide tương ứng; chi nhánh chưa có bộ riêng thì xem bộ mặc định.
  useEffect(() => {
    const source = own ?? storeDefault;
    setSlides(source?.slides ?? []);
    setIntervalSeconds(source?.intervalSeconds ?? 8);
    setDirty(false);
  }, [scope, own, storeDefault]);

  function edit(next: CustomerDisplaySlideDto[]) {
    setSlides(next);
    setDirty(true);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, Math.max(0, MAX_SLIDES - slides.length));
    if (list.length === 0) {
      enqueueSnackbar(`Tối đa ${MAX_SLIDES} ảnh/video.`, { variant: 'warning' });
      return;
    }
    setUploading(true);
    try {
      const added = await uploadCustomerDisplayMedia(list);
      edit([...slides, ...added]);
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Tải lên thất bại', { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function move(index: number, delta: number) {
    const next = [...slides];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    edit(next);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveCustomerDisplaySettings({
        branchId,
        intervalSeconds: interval,
        slides: slides.map(({ url: _url, ...rest }) => rest),
      });
      enqueueSnackbar('Đã lưu màn hình khách', { variant: 'success' });
      setDirty(false);
      await load();
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Lưu thất bại', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUseDefault() {
    if (!branchId) return;
    setSaving(true);
    try {
      await deleteCustomerDisplayBranch(branchId);
      enqueueSnackbar('Chi nhánh dùng lại bộ mặc định của cửa hàng', { variant: 'success' });
      await load();
    } catch (err: any) {
      enqueueSnackbar(err?.title || err?.message || 'Thao tác thất bại', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6">Màn hình khách</Typography>
          <Typography variant="body2" color="text.secondary">
            Màn phụ ở quầy hướng về khách: khi không bán hàng chạy ảnh / video dưới đây; khi đang bán hiện giỏ hàng, chọn
            chuyển khoản thì hiện mã QR to cho khách quét. Mở từ trang Bán hàng (nút màn hình) hoặc app máy quầy có màn phụ.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <TextField
            select
            size="small"
            label="Áp dụng cho"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            <MenuItem value={DEFAULT_SCOPE}>Mặc định cả cửa hàng</MenuItem>
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.id}>
                {b.branchName}
                {settings.some((s) => s.branchId === b.id) ? ' (riêng)' : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Mỗi ảnh hiện (giây)"
            value={interval}
            onChange={(e) => {
              setIntervalSeconds(Math.min(120, Math.max(3, Number(e.target.value) || 8)));
              setDirty(true);
            }}
            inputProps={{ min: 3, max: 120 }}
            sx={{ width: 180 }}
          />
          <Button variant="outlined" startIcon={<Iconify icon="solar:monitor-bold" />} onClick={() => openCustomerDisplayWindow()}>
            Mở màn hình khách
          </Button>
        </Stack>

        {usingDefault && (
          <Alert severity="info">
            Chi nhánh này đang dùng bộ mặc định của cửa hàng. Sửa rồi lưu để tạo bộ riêng cho chi nhánh.
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          {slides.map((slide, i) => (
            <Card key={`${slide.key}-${i}`} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'grey.900' }}>
                {slide.kind === 'video' ? (
                  <Box component="video" src={slide.url || getStorageUrl(slide.key)} muted playsInline sx={{ width: 1, height: 1, objectFit: 'contain' }} />
                ) : (
                  <Box component="img" src={slide.url || getStorageUrl(slide.key)} alt="" sx={{ width: 1, height: 1, objectFit: 'contain' }} />
                )}
                <Typography variant="caption" sx={{ position: 'absolute', top: 6, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', px: 0.75, borderRadius: 0.5 }}>
                  {i + 1} · {slide.kind === 'video' ? 'Video' : 'Ảnh'}
                </Typography>
              </Box>
              <Stack spacing={1} sx={{ p: 1.5 }}>
                <TextField
                  size="small"
                  placeholder="Chữ trên ảnh (không bắt buộc)"
                  value={slide.title ?? ''}
                  inputProps={{ maxLength: 120 }}
                  onChange={(e) => edit(slides.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Box>
                    <IconButton size="small" disabled={i === 0} onClick={() => move(i, -1)}>
                      <Iconify icon="eva:arrow-back-fill" />
                    </IconButton>
                    <IconButton size="small" disabled={i === slides.length - 1} onClick={() => move(i, 1)}>
                      <Iconify icon="eva:arrow-forward-fill" />
                    </IconButton>
                  </Box>
                  <IconButton size="small" color="error" onClick={() => edit(slides.filter((_, j) => j !== i))}>
                    <Iconify icon="solar:trash-bin-trash-bold" />
                  </IconButton>
                </Stack>
              </Stack>
            </Card>
          ))}

          {slides.length < MAX_SLIDES && (
            <Card
              variant="outlined"
              sx={{ minHeight: 200, display: 'grid', placeItems: 'center', borderStyle: 'dashed', cursor: 'pointer' }}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              <Stack alignItems="center" spacing={1} sx={{ p: 2, textAlign: 'center' }}>
                {uploading ? <CircularProgress size={28} /> : <Iconify icon="solar:gallery-add-bold" width={36} />}
                <Typography variant="subtitle2">{uploading ? 'Đang tải lên…' : 'Thêm ảnh / video'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Ảnh ≤ 10 MB, video MP4/WebM ≤ 100 MB · nên dùng ảnh ngang 16:9
                </Typography>
              </Stack>
            </Card>
          )}
        </Box>
        <input
          ref={fileRef}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          {branchId && own && (
            <Button color="inherit" disabled={saving} onClick={handleUseDefault}>
              Dùng bộ mặc định cho chi nhánh này
            </Button>
          )}
          <LoadingButton variant="contained" loading={saving} disabled={!dirty || uploading} onClick={handleSave}>
            Lưu
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );
}
