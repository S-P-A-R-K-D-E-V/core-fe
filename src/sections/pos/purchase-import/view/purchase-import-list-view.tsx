'use client';

import { useDropzone } from 'react-dropzone';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import { alpha } from '@mui/material/styles';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDateTime } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';
import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { getAllSuppliers } from 'src/api/suppliers';
import {
  createPurchaseImport,
  uploadInvoiceImages,
  getRecentPurchaseImports,
  getPurchaseImportCapabilities,
} from 'src/api/purchase-imports';

import type { ISupplier } from 'src/types/corecms-api';
import type { IPurchaseImportSummary, IPurchaseImportCapabilities } from 'src/types/purchase-import';

import { IMPORT_STATUS, importErrorMessage } from '../purchase-import-utils';

// ----------------------------------------------------------------------

type Picked = { file: File; preview: string };

export default function PurchaseImportListView() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [capabilities, setCapabilities] = useState<IPurchaseImportCapabilities | null>(null);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [recent, setRecent] = useState<IPurchaseImportSummary[]>([]);

  const [images, setImages] = useState<Picked[]>([]);
  const [supplier, setSupplier] = useState<ISupplier | null>(null);
  const [hints, setHints] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const maxImages = capabilities?.maxImages ?? 6;

  useEffect(() => {
    getPurchaseImportCapabilities().then(setCapabilities).catch(() => setCapabilities(null));
    getAllSuppliers().then(setSuppliers).catch(() => {});
    getRecentPurchaseImports().then(setRecent).catch(() => {});
  }, []);

  // Giải phóng object URL của ảnh xem trước khi rời trang.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter((f) => f.type.startsWith('image/'));
      if (accepted.length === 0) return;
      const room = Math.max(0, maxImages - imagesRef.current.length);
      if (accepted.length > room) enqueueSnackbar(`Một hoá đơn tối đa ${maxImages} ảnh`, { variant: 'warning' });
      const added = accepted.slice(0, room).map((file) => ({ file, preview: URL.createObjectURL(file) }));
      if (added.length) setImages((prev) => [...prev, ...added]);
    },
    [enqueueSnackbar, maxImages]
  );

  // Dán ảnh chụp màn hình / ảnh copy từ Zalo bằng Ctrl+V.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length) addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    multiple: true,
    disabled: submitting,
    onDrop: addFiles,
  });

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].preview);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (images.length === 0) return;
    setSubmitting(true);
    try {
      const objectKeys = await uploadInvoiceImages(images.map((i) => i.file));
      const { id } = await createPurchaseImport({
        objectKeys,
        supplierId: supplier?.id ?? null,
        hints: hints.trim() || null,
      });
      router.push(paths.dashboard.pos.purchaseOrder.importDetails(id));
    } catch (error) {
      enqueueSnackbar(importErrorMessage(error, 'Không gửi được hoá đơn'), { variant: 'error' });
      setSubmitting(false);
    }
  };

  const disabled = capabilities !== null && !capabilities.enabled;

  const renderUpload = (
    <Card>
      <CardHeader
        title="Ảnh hoá đơn nhà cung cấp"
        subheader="Mỗi hoá đơn tạo một phiếu nhập. Chọn nhiều ảnh chỉ khi là các tờ của CÙNG một hoá đơn."
      />
      <Stack spacing={2.5} sx={{ p: 3 }}>
        {disabled && <Alert severity="warning">Cửa hàng chưa bật đọc ảnh hoá đơn.</Alert>}

        <Box
          {...getRootProps()}
          sx={{
            p: 4,
            outline: 'none',
            borderRadius: 1,
            cursor: 'pointer',
            textAlign: 'center',
            border: (theme) => `1px dashed ${alpha(theme.palette.grey[500], 0.32)}`,
            bgcolor: (theme) => alpha(theme.palette.grey[500], isDragActive ? 0.16 : 0.08),
            '&:hover': { opacity: 0.72 },
          }}
        >
          <input {...getInputProps()} />
          <Iconify icon="solar:camera-add-bold-duotone" width={48} sx={{ color: 'primary.main', mb: 1 }} />
          <Typography variant="subtitle1">Kéo thả, bấm để chọn, hoặc dán (Ctrl+V) ảnh hoá đơn</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Chụp thẳng, đủ sáng, thấy rõ cột số lượng / giá / thành tiền — tối đa {maxImages} ảnh
          </Typography>
        </Box>

        {images.length > 0 && (
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {images.map((img, index) => (
              <Box key={img.preview} sx={{ position: 'relative', width: 96, height: 128 }}>
                <Box
                  component="img"
                  src={img.preview}
                  alt={`Tờ ${index + 1}`}
                  sx={{ width: 1, height: 1, objectFit: 'cover', borderRadius: 1 }}
                />
                <Label variant="filled" sx={{ position: 'absolute', left: 4, bottom: 4 }}>
                  Tờ {index + 1}
                </Label>
                <IconButton
                  size="small"
                  disabled={submitting}
                  onClick={() => removeImage(index)}
                  sx={{
                    p: 0.25,
                    top: 4,
                    right: 4,
                    position: 'absolute',
                    color: 'common.white',
                    bgcolor: (theme) => alpha(theme.palette.grey[900], 0.48),
                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.grey[900], 0.72) },
                  }}
                >
                  <Iconify icon="mingcute:close-line" width={14} />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Autocomplete
              options={suppliers}
              value={supplier}
              onChange={(_, value) => setSupplier(value)}
              getOptionLabel={(s) => (s.phone ? `${s.name} — ${s.phone}` : s.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Nhà cung cấp (không bắt buộc)" helperText="Bỏ trống để hệ thống tự nhận từ hoá đơn" />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <TextField
              fullWidth
              label="Ghi chú cho AI"
              value={hints}
              onChange={(e) => setHints(e.target.value)}
              placeholder="vd: đơn này nhà Ngọc Bang, tiền ghi theo nghìn"
              helperText="Mô tả như nhắn trong chat — hệ thống đọc kèm ảnh"
              inputProps={{ maxLength: 500 }}
            />
          </Grid>
        </Grid>

        <Stack direction="row" justifyContent="flex-end">
          <LoadingButton
            size="large"
            variant="contained"
            loading={submitting}
            disabled={disabled || images.length === 0}
            onClick={handleSubmit}
            startIcon={<Iconify icon="solar:magic-stick-3-bold" />}
          >
            Đọc hoá đơn
          </LoadingButton>
        </Stack>
      </Stack>
    </Card>
  );

  const renderRecent = (
    <Card>
      <CardHeader title="Hoá đơn gần đây" />
      <Scrollbar>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell width={72} />
              <TableCell>Nhà cung cấp</TableCell>
              <TableCell width={120}>Số HĐ</TableCell>
              <TableCell width={140} align="right">Tổng</TableCell>
              <TableCell width={110} align="center">Dòng</TableCell>
              <TableCell width={140}>Trạng thái</TableCell>
              <TableCell width={150}>Gửi lúc</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recent.map((row) => (
              <TableRow
                key={row.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => router.push(paths.dashboard.pos.purchaseOrder.importDetails(row.id))}
              >
                <TableCell>
                  {row.thumbnail ? (
                    <Box
                      component="img"
                      src={getStorageUrl(row.thumbnail)}
                      alt=""
                      sx={{ width: 40, height: 52, objectFit: 'cover', borderRadius: 0.75 }}
                    />
                  ) : (
                    <Iconify icon="solar:bill-list-bold-duotone" width={32} sx={{ color: 'text.disabled' }} />
                  )}
                </TableCell>
                <TableCell>{row.supplierText || '—'}</TableCell>
                <TableCell>{row.invoiceNumber || '—'}</TableCell>
                <TableCell align="right">{row.invoiceTotal ? fCurrency(row.invoiceTotal) : '—'}</TableCell>
                <TableCell align="center">
                  {row.lineCount}
                  {row.pendingLines > 0 && row.status === 'NeedsReview' && (
                    <Typography component="span" variant="caption" sx={{ color: 'warning.main', ml: 0.5 }}>
                      ({row.pendingLines} chờ)
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Label color={IMPORT_STATUS[row.status].color}>{IMPORT_STATUS[row.status].label}</Label>
                </TableCell>
                <TableCell>{fDateTime(row.createdAt)}</TableCell>
              </TableRow>
            ))}
            {recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Chưa có hoá đơn nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Scrollbar>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Nhập từ ảnh hoá đơn"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Đơn nhập hàng', href: paths.dashboard.pos.purchaseOrder.list },
          { name: 'Nhập từ ảnh hoá đơn' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack spacing={3}>
        {renderUpload}
        {renderRecent}
      </Stack>
    </Container>
  );
}
