'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid2';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import LinearProgress from '@mui/material/LinearProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { fCurrency } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { getAllSuppliers } from 'src/api/suppliers';
import { getAllWarehouses } from 'src/api/warehouses';
import {
  getPurchaseImport,
  retryPurchaseImport,
  cancelPurchaseImport,
  commitPurchaseImport,
  updatePurchaseImport,
  updatePurchaseImportLine,
} from 'src/api/purchase-imports';

import type { IProduct, ISupplier, IWarehouse } from 'src/types/corecms-api';
import type {
  IPurchaseImport,
  IPurchaseImportLine,
  IUpdatePurchaseImportRequest,
  IUpdatePurchaseImportLineRequest,
} from 'src/types/purchase-import';

import { usePurchaseAccess } from '../../purchase-order/purchase-access';
import PurchaseImportImages from '../purchase-import-images';
import PurchaseImportLineRow from '../purchase-import-line-row';
import PurchaseOrderQuickCreateProduct from '../../purchase-order/purchase-order-quick-create-product';
import PurchaseOrderQuickCreateSupplier from '../../purchase-order/purchase-order-quick-create-supplier';
import {
  lineCounts,
  parseAmount,
  IMPORT_STATUS,
  commitBlockers,
  totalMismatch,
  isDuplicateInvoice,
  importErrorMessage,
} from '../purchase-import-utils';

// ----------------------------------------------------------------------

const POLL_MS = 2500;

type Props = { id: string };

export default function PurchaseImportReviewView({ id }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const access = usePurchaseAccess();

  const [item, setItem] = useState<IPurchaseImport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [warehouses, setWarehouses] = useState<IWarehouse[]>([]);

  const [busyLine, setBusyLine] = useState<number | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [createFor, setCreateFor] = useState<IPurchaseImportLine | null>(null);
  const [supplierDialog, setSupplierDialog] = useState(false);

  const [commitOpen, setCommitOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  // Đọc ảnh chạy nền → hỏi lại tới khi xong. pollKey đổi (đọc lại) thì bắt đầu vòng mới.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const data = await getPurchaseImport(id);
        if (cancelled) return;
        setItem(data);
        setLoadError(null);
        if (data.status === 'Extracting') timer = setTimeout(tick, POLL_MS);
      } catch (error) {
        if (!cancelled) setLoadError(importErrorMessage(error, 'Không tải được hoá đơn'));
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, pollKey]);

  useEffect(() => {
    getAllSuppliers().then(setSuppliers).catch(() => {});
    getAllWarehouses().then(setWarehouses).catch(() => {});
  }, []);

  const editable = item?.status === 'NeedsReview' && access.canCreate;

  const saveHeader = useCallback(
    async (patch: IUpdatePurchaseImportRequest) => {
      setSavingHeader(true);
      try {
        setItem(await updatePurchaseImport(id, patch));
      } catch (error) {
        enqueueSnackbar(importErrorMessage(error, 'Không lưu được'), { variant: 'error' });
      } finally {
        setSavingHeader(false);
      }
    },
    [enqueueSnackbar, id]
  );

  const saveLine = useCallback(
    async (lineNo: number, patch: IUpdatePurchaseImportLineRequest) => {
      setBusyLine(lineNo);
      try {
        setItem(await updatePurchaseImportLine(id, lineNo, patch));
      } catch (error) {
        enqueueSnackbar(importErrorMessage(error, 'Không lưu được dòng'), { variant: 'error' });
      } finally {
        setBusyLine(null);
      }
    },
    [enqueueSnackbar, id]
  );

  const handleCommit = async (allowDuplicate: boolean) => {
    setCommitting(true);
    try {
      const { purchaseOrderId } = await commitPurchaseImport(id, allowDuplicate);
      enqueueSnackbar('Đã tạo phiếu nhập nháp');
      router.push(paths.dashboard.pos.purchaseOrder.details(purchaseOrderId));
    } catch (error) {
      if (!allowDuplicate && isDuplicateInvoice(error)) {
        setDuplicate(importErrorMessage(error, 'Hoá đơn này đã được nhập.'));
      } else {
        enqueueSnackbar(importErrorMessage(error, 'Không tạo được phiếu nhập'), { variant: 'error' });
      }
    } finally {
      setCommitting(false);
      setCommitOpen(false);
    }
  };

  const handleRetry = async () => {
    try {
      await retryPurchaseImport(id);
      setPollKey((k) => k + 1);
    } catch (error) {
      enqueueSnackbar(importErrorMessage(error, 'Không đọc lại được'), { variant: 'error' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelPurchaseImport(id);
      setCancelOpen(false);
      setPollKey((k) => k + 1);
    } catch (error) {
      enqueueSnackbar(importErrorMessage(error, 'Không huỷ được'), { variant: 'error' });
    }
  };

  const handleProductCreated = (product: IProduct) => {
    const line = createFor;
    setCreateFor(null);
    if (line) saveLine(line.lineNo, { productId: product.id, created: true });
  };

  // Dòng "—" (như trên) lấy tên của dòng có tên gần nhất phía trên.
  const familyNames = useMemo(() => {
    const names: Record<number, string | null> = {};
    let last: string | null = null;
    item?.lines.forEach((l) => {
      names[l.lineNo] = l.sameAsAbove ? last : l.name ?? null;
      if (!l.sameAsAbove && l.name) last = l.name;
    });
    return names;
  }, [item]);

  const createInitialValues = useMemo(
    () =>
      createFor
        ? {
            name: (createFor.sameAsAbove ? familyNames[createFor.lineNo] : createFor.name) || createFor.rawText,
            costPrice: createFor.unitPrice ?? undefined,
          }
        : undefined,
    [createFor, familyNames]
  );

  if (loadError && !item) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" action={<Button onClick={() => setPollKey((k) => k + 1)}>Thử lại</Button>}>
          {loadError}
        </Alert>
      </Container>
    );
  }

  if (!item) return <LinearProgress sx={{ mx: 3 }} />;

  const status = IMPORT_STATUS[item.status];
  const blockers = commitBlockers(item);
  const mismatch = totalMismatch(item);
  const counts = lineCounts(item);
  const supplier = suppliers.find((s) => s.id === item.supplierId) ?? null;
  const activeLines = item.lines.filter((l) => l.status !== 'Skipped');
  const canCreateSupplier = editable && access.canManageSuppliers && !item.supplierId;

  const renderStatus = (
    <>
      {item.status === 'Extracting' && (
        <Alert severity="info" icon={<Iconify icon="solar:magic-stick-3-bold" />}>
          Đang đọc hoá đơn — thường mất 20–60 giây. Có thể rời trang, lần nhập vẫn chạy và nằm ở danh sách gần đây.
          <LinearProgress sx={{ mt: 1.5 }} />
        </Alert>
      )}
      {item.status === 'Failed' && (
        <Alert
          severity="error"
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" onClick={handleRetry}>
                Đọc lại
              </Button>
              <Button color="inherit" onClick={() => setCancelOpen(true)}>
                Huỷ
              </Button>
            </Stack>
          }
        >
          {item.error || 'Không đọc được hoá đơn.'}
        </Alert>
      )}
      {item.status === 'Committed' && item.purchaseOrderId && (
        <Alert
          severity="success"
          action={
            <Button
              color="inherit"
              component={RouterLink}
              href={paths.dashboard.pos.purchaseOrder.details(item.purchaseOrderId)}
            >
              Xem phiếu
            </Button>
          }
        >
          Đã tạo phiếu nhập {item.purchaseOrderNumber ?? ''} từ hoá đơn này.
        </Alert>
      )}
      {item.status === 'Cancelled' && <Alert severity="warning">Lần nhập này đã huỷ.</Alert>}
      {item.warnings.map((w) => (
        <Alert key={w} severity="warning">
          {w}
        </Alert>
      ))}
    </>
  );

  const renderHeader = (
    <Card>
      <CardHeader
        title="Thông tin hoá đơn"
        subheader={
          item.supplierText || item.supplierPhone
            ? `Trên hoá đơn: ${[item.supplierText, item.supplierPhone].filter(Boolean).join(' · ')}`
            : undefined
        }
        action={savingHeader ? <LinearProgress sx={{ width: 64, mt: 2 }} /> : null}
      />
      <Grid container spacing={2} sx={{ p: 3 }}>
        <Grid size={{ xs: 12, sm: canCreateSupplier ? 5 : 8 }}>
          <Autocomplete
            options={suppliers}
            value={supplier}
            disabled={!editable || savingHeader}
            onChange={(_, value) => value && saveHeader({ supplierId: value.id })}
            getOptionLabel={(s) => (s.phone ? `${s.name} — ${s.phone}` : s.name)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Nhà cung cấp"
                error={editable && !item.supplierId}
                helperText={
                  editable && !item.supplierId
                    ? 'Chưa nhận ra NCC — chọn hoặc tạo mới'
                    : 'Đổi NCC sẽ gợi ý lại các dòng chưa chọn'
                }
              />
            )}
          />
        </Grid>
        {canCreateSupplier && (
          <Grid size={{ xs: 12, sm: 3 }}>
            <Button
              fullWidth
              size="large"
              variant="outlined"
              onClick={() => setSupplierDialog(true)}
              startIcon={<Iconify icon="mingcute:add-line" />}
              sx={{ height: 56 }}
            >
              Tạo NCC
            </Button>
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            select
            fullWidth
            label="Kho nhập"
            value={item.warehouseId ?? ''}
            disabled={!editable || savingHeader}
            onChange={(e) => saveHeader({ warehouseId: e.target.value })}
          >
            {warehouses
              .filter((w) => w.isActive || w.id === item.warehouseId)
              .map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <BlurTextField
            label="Số hoá đơn"
            value={item.invoiceNumber ?? ''}
            disabled={!editable}
            onCommit={(invoiceNumber) => saveHeader({ invoiceNumber })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <BlurTextField
            label="Ngày hoá đơn"
            type="date"
            value={item.invoiceDate ?? ''}
            disabled={!editable}
            onCommit={(invoiceDate) => invoiceDate && saveHeader({ invoiceDate })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <BlurTextField
            label="Tổng trên hoá đơn"
            value={item.invoiceTotal != null ? String(item.invoiceTotal) : ''}
            disabled={!editable}
            inputMode="decimal"
            onCommit={(text) => {
              const total = parseAmount(text);
              if (total !== null) saveHeader({ invoiceTotal: total });
            }}
          />
        </Grid>
      </Grid>
    </Card>
  );

  const renderLines = (
    <Card>
      <CardHeader
        title={`Các dòng (${item.lines.length})`}
        subheader={`${counts.matched} đã có mã · ${counts.pending} cần xem · ${counts.skipped} bỏ`}
      />
      <Scrollbar>
        <Table size="small" sx={{ minWidth: 880 }}>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Trên hoá đơn</TableCell>
              <TableCell align="right">SL</TableCell>
              <TableCell align="right">Đơn giá</TableCell>
              <TableCell align="right">Thành tiền</TableCell>
              <TableCell>Mã hàng</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {item.lines.map((line) => (
              <PurchaseImportLineRow
                key={line.lineNo}
                line={line}
                familyName={familyNames[line.lineNo]}
                editable={editable}
                busy={busyLine === line.lineNo}
                canCreateProduct={access.canCreateProducts}
                onSave={(patch) => saveLine(line.lineNo, patch)}
                onCreateProduct={() => setCreateFor(line)}
              />
            ))}
            {item.lines.length === 0 && item.status !== 'Extracting' && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không đọc được dòng nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Scrollbar>

      <Stack spacing={1.5} sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="subtitle1">Tổng các dòng</Typography>
          <Typography variant="subtitle1">{fCurrency(item.linesTotal)}</Typography>
        </Stack>
        {mismatch !== null && (
          <Alert severity="warning">
            Lệch tổng hoá đơn ({fCurrency(item.invoiceTotal ?? 0)}) {mismatch > 0 ? 'thừa' : 'thiếu'}{' '}
            {fCurrency(Math.abs(mismatch))} — có thể sót dòng hoặc đọc sai số.
          </Alert>
        )}
        {editable && (
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button color="inherit" onClick={() => setCancelOpen(true)}>
              Huỷ lần nhập
            </Button>
            <Tooltip title={blockers.join(' ')}>
              <span>
                <LoadingButton
                  size="large"
                  variant="contained"
                  loading={committing}
                  disabled={blockers.length > 0}
                  onClick={() => setCommitOpen(true)}
                  startIcon={<Iconify icon="solar:check-circle-bold" />}
                >
                  Tạo phiếu nhập
                </LoadingButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Card>
  );

  return (
    <Container maxWidth="xl">
      <CustomBreadcrumbs
        heading={item.invoiceNumber ? `Hoá đơn ${item.invoiceNumber}` : 'Duyệt hoá đơn'}
        links={[
          { name: 'Đơn nhập hàng', href: paths.dashboard.pos.purchaseOrder.list },
          { name: 'Nhập từ ảnh hoá đơn', href: paths.dashboard.pos.purchaseOrder.import },
          { name: item.supplierName || item.supplierText || 'Duyệt' },
        ]}
        action={<Label color={status.color}>{status.label}</Label>}
        sx={{ mb: 3 }}
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <PurchaseImportImages images={item.images} />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            {renderStatus}
            {item.userHints && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Ghi chú khi gửi: “{item.userHints}”
              </Typography>
            )}
            {item.status !== 'Extracting' && renderHeader}
            {item.status !== 'Extracting' && renderLines}
          </Stack>
        </Grid>
      </Grid>

      <PurchaseOrderQuickCreateProduct
        open={!!createFor}
        onClose={() => setCreateFor(null)}
        onCreated={handleProductCreated}
        initialValues={createInitialValues}
      />

      <PurchaseOrderQuickCreateSupplier
        open={supplierDialog}
        onClose={() => setSupplierDialog(false)}
        initialValues={{ name: item.supplierText ?? '', phone: item.supplierPhone ?? '' }}
        onCreated={(created) => {
          setSuppliers((prev) => [created, ...prev]);
          saveHeader({ supplierId: created.id });
        }}
      />

      <ConfirmDialog
        open={commitOpen}
        onClose={() => setCommitOpen(false)}
        title="Tạo phiếu nhập nháp?"
        content={`Phiếu nhập NHÁP gồm ${activeLines.length} dòng, tổng ${fCurrency(item.linesTotal)}${
          supplier ? ` từ ${supplier.name}` : ''
        }. Chưa cộng tồn kho cho tới khi nhận hàng. Lựa chọn mã của bạn được ghi nhớ cho lần sau.`}
        action={
          <LoadingButton variant="contained" loading={committing} onClick={() => handleCommit(false)}>
            Tạo phiếu
          </LoadingButton>
        }
      />

      <ConfirmDialog
        open={!!duplicate}
        onClose={() => setDuplicate(null)}
        title="Hoá đơn đã được nhập"
        content={duplicate}
        action={
          <LoadingButton
            variant="contained"
            color="warning"
            loading={committing}
            onClick={async () => {
              await handleCommit(true);
              setDuplicate(null);
            }}
          >
            Vẫn tạo phiếu
          </LoadingButton>
        }
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Huỷ lần nhập này?"
        content="Ảnh và kết quả đọc vẫn giữ để tra lại, nhưng không tạo phiếu được nữa."
        action={
          <Button variant="contained" color="error" onClick={handleCancel}>
            Huỷ lần nhập
          </Button>
        }
      />
    </Container>
  );
}

// ----------------------------------------------------------------------

type BlurTextFieldProps = {
  label: string;
  value: string;
  disabled: boolean;
  type?: string;
  inputMode?: 'decimal' | 'text';
  onCommit: (value: string) => void;
};

/** Ô chữ lưu khi rời ô / Enter (mỗi lần gõ không gọi API). */
function BlurTextField({ label, value, disabled, type, inputMode, onCommit }: BlurTextFieldProps) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  return (
    <TextField
      fullWidth
      label={label}
      type={type}
      value={text}
      disabled={disabled}
      InputLabelProps={type === 'date' ? { shrink: true } : undefined}
      inputProps={inputMode ? { inputMode } : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onCommit(text.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
