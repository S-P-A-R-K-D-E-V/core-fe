'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage } from 'src/utils/api-error';
import { printHtmlDocument } from 'src/utils/print-html';

import {
  getPrintTemplates,
  deletePrintTemplate,
  createPrintTemplate,
  setPrintTemplateAssignments,
} from 'src/api/print-templates';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useStoreBrand } from 'src/components/branding';

import { DEFAULT_CALIBRATION } from 'src/sections/pos/label-print/label-template';

import { PRINT_ANY } from 'src/types/print-template';

import type {
  IPrintTemplate,
  PrintTemplateKind,
  IPrintTemplateList,
  IPrintTemplateAssignmentInput,
} from 'src/types/print-template';

import { sampleReceipt } from '../receipt/receipt-template-default';
import { renderReceiptTemplate } from '../receipt/receipt-template-render';
import { renderDesignSheetHtml } from '../label/label-design-render';
import { parseLabelDesign, paperSummary } from '../label/label-design';
import {
  normalizeReceiptSettings,
  RECEIPT_TEMPLATE_PAPERS,
} from '../receipt/receipt-template-settings';
import {
  PRINT_CHANNELS,
  PRINT_KIND_LABEL,
  PRINT_PAYMENT_METHODS,
  resolveAppliedTemplate,
} from '../print-template-resolve';

// ----------------------------------------------------------------------
// Mẫu in: mỗi loại (hoá đơn / tem mã) một thẻ gồm
//  - "Đang áp dụng": hoá đơn là bảng kênh × phương thức thanh toán, mỗi ô chọn một mẫu hoặc để trống (theo ô rộng hơn:
//    (kênh, *) → (*, phương thức) → (*, *) → mẫu hệ thống); tem mã chỉ có một mẫu mặc định;
//  - danh sách mẫu: sửa, nhân bản, in thử với dữ liệu mẫu, xoá (ô đang dùng mẫu bị gỡ, in theo ô rộng hơn).
// ----------------------------------------------------------------------

const CHANNEL_ROWS = [{ value: PRINT_ANY, label: 'Mọi kênh' }, ...PRINT_CHANNELS];
const METHOD_COLUMNS = [{ value: PRINT_ANY, label: 'Mọi phương thức' }, ...PRINT_PAYMENT_METHODS];

const cellKey = (channel: string, method: string) => `${channel}|${method}`;

const SAMPLE_LABELS = [
  {
    key: 's1',
    name: 'Kẹp tóc nơ nhung đỏ',
    code: 'K35',
    barcode: '8938505974194',
    price: 35000,
    unit: 'cái',
    quantity: 2,
  },
];

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
    : '—';
}

function paperOf(template: IPrintTemplate): string {
  if (template.kind === 'label') return paperSummary(parseLabelDesign(template.content).paper);
  return RECEIPT_TEMPLATE_PAPERS[normalizeReceiptSettings(template.settings).paper].label;
}

const snapshotKey = (data: IPrintTemplateList, kind: PrintTemplateKind) =>
  [
    ...data.templates.filter((t) => t.kind === kind).map((t) => t.id),
    ...data.assignments
      .filter((a) => a.kind === kind)
      .map((a) => `${a.channel}|${a.paymentMethod}|${a.templateId}`),
  ].join(',');

function cellLabel(channel: string, method: string): string {
  if (channel === PRINT_ANY && method === PRINT_ANY) return 'Mặc định';
  const c = PRINT_CHANNELS.find((item) => item.value === channel)?.label ?? 'Mọi kênh';
  const m = PRINT_PAYMENT_METHODS.find((item) => item.value === method)?.label;
  return m ? `${c} · ${m}` : c;
}

export function PrintTemplateListView() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { brandName, logoUrl } = useStoreBrand();
  const [kind, setKind] = useState<PrintTemplateKind>('receipt');
  const [data, setData] = useState<IPrintTemplateList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<IPrintTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getPrintTemplates());
      setError(null);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Không tải được mẫu in'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const templates = useMemo(
    () => (data?.templates ?? []).filter((t) => t.kind === kind),
    [data, kind]
  );
  const assignments = useMemo(
    () => (data?.assignments ?? []).filter((a) => a.kind === kind),
    [data, kind]
  );

  const handleDuplicate = async (template: IPrintTemplate) => {
    setBusy(true);
    try {
      const copy = await createPrintTemplate(template.kind, {
        name: `${template.name} (bản sao)`.slice(0, 120),
        content: template.content,
        settings: template.settings,
      });
      enqueueSnackbar('Đã nhân bản mẫu');
      router.push(paths.dashboard.storeSettings.printTemplateEdit(copy.id));
    } catch (duplicateError) {
      enqueueSnackbar(apiErrorMessage(duplicateError, 'Không nhân bản được mẫu'), {
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleTestPrint = async (template: IPrintTemplate) => {
    try {
      const html =
        template.kind === 'receipt'
          ? (await renderReceiptTemplate(template, sampleReceipt(brandName, logoUrl))).html
          : renderDesignSheetHtml(
              { items: SAMPLE_LABELS, context: { storeName: brandName, logoUrl } },
              parseLabelDesign(template.content),
              DEFAULT_CALIBRATION
            );
      await printHtmlDocument(html);
    } catch (printError) {
      console.error(printError);
      enqueueSnackbar('Không mở được hộp thoại in của trình duyệt', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePrintTemplate(deleting.id);
      enqueueSnackbar('Đã xoá mẫu in');
      setDeleting(null);
      await load();
    } catch (deleteError) {
      enqueueSnackbar(apiErrorMessage(deleteError, 'Không xoá được mẫu'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pb: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Mẫu in</Typography>
          <Typography variant="body2" color="text.secondary">
            Soạn mẫu hoá đơn và tem mã của cửa hàng; chọn mẫu dùng cho từng kênh bán và phương thức
            thanh toán. Chưa chọn mẫu nào thì in bằng mẫu hệ thống như trước.
          </Typography>
        </Box>
        <Button
          variant="contained"
          component={RouterLink}
          href={paths.dashboard.storeSettings.printTemplateNew(kind)}
          startIcon={<Iconify icon="mingcute:add-line" />}
        >
          {kind === 'receipt' ? 'Tạo mẫu hoá đơn' : 'Tạo mẫu tem'}
        </Button>
      </Stack>

      <Tabs value={kind} onChange={(_, next) => setKind(next)} sx={{ mb: 3 }}>
        {(['receipt', 'label'] as PrintTemplateKind[]).map((value) => (
          <Tab
            key={value}
            value={value}
            label={`${PRINT_KIND_LABEL[value]} (${(data?.templates ?? []).filter((t) => t.kind === value).length})`}
          />
        ))}
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button onClick={load}>Thử lại</Button>}>
          {error}
        </Alert>
      )}

      {!data && !error && (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      )}

      {data && (
        <Stack spacing={3}>
          {/* key: dựng lại thẻ (bỏ phần đang chọn dở) khi bảng áp dụng hoặc danh sách mẫu trên máy chủ đổi. */}
          {kind === 'receipt' ? (
            <ReceiptAssignmentsCard key={snapshotKey(data, 'receipt')} data={data} onSaved={load} />
          ) : (
            <LabelDefaultCard key={snapshotKey(data, 'label')} data={data} onSaved={load} />
          )}

          <Card>
            <CardHeader title={`Mẫu ${PRINT_KIND_LABEL[kind].toLowerCase()}`} sx={{ mb: 1 }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tên mẫu</TableCell>
                    <TableCell>Khổ giấy</TableCell>
                    <TableCell>Đang áp dụng</TableCell>
                    <TableCell>Cập nhật</TableCell>
                    <TableCell align="right" sx={{ width: 190 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 3, textAlign: 'center' }}
                        >
                          Chưa có mẫu {PRINT_KIND_LABEL[kind].toLowerCase()} — đang in bằng mẫu hệ
                          thống.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {templates.map((template) => {
                    const cells = assignments.filter((a) => a.templateId === template.id);
                    return (
                      <TableRow key={template.id} hover>
                        <TableCell>
                          <Typography
                            component={RouterLink}
                            href={paths.dashboard.storeSettings.printTemplateEdit(template.id)}
                            variant="subtitle2"
                            sx={{
                              color: 'text.primary',
                              textDecoration: 'none',
                              '&:hover': { textDecoration: 'underline' },
                            }}
                          >
                            {template.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{paperOf(template)}</TableCell>
                        <TableCell>
                          <Stack direction="row" flexWrap="wrap" gap={0.5}>
                            {cells.length === 0 && (
                              <Typography variant="caption" color="text.disabled">
                                Chưa dùng
                              </Typography>
                            )}
                            {cells.map((a) => (
                              <Chip
                                key={cellKey(a.channel, a.paymentMethod)}
                                size="small"
                                color={
                                  a.channel === PRINT_ANY && a.paymentMethod === PRINT_ANY
                                    ? 'primary'
                                    : 'default'
                                }
                                label={cellLabel(a.channel, a.paymentMethod)}
                              />
                            ))}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          {formatDate(template.updatedAt ?? template.createdAt)}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Sửa">
                            <IconButton
                              component={RouterLink}
                              href={paths.dashboard.storeSettings.printTemplateEdit(template.id)}
                              aria-label={`Sửa ${template.name}`}
                            >
                              <Iconify icon="solar:pen-bold" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="In thử với dữ liệu mẫu">
                            <IconButton
                              aria-label={`In thử ${template.name}`}
                              onClick={() => handleTestPrint(template)}
                            >
                              <Iconify icon="solar:printer-minimalistic-bold" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Nhân bản">
                            <IconButton
                              aria-label={`Nhân bản ${template.name}`}
                              disabled={busy}
                              onClick={() => handleDuplicate(template)}
                            >
                              <Iconify icon="solar:copy-bold" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xoá">
                            <IconButton
                              aria-label={`Xoá ${template.name}`}
                              color="error"
                              onClick={() => setDeleting(template)}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Stack>
      )}

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Xoá mẫu in?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Xoá <strong>{deleting?.name}</strong>. Các ô đang dùng mẫu này sẽ in theo ô rộng hơn
            (hoặc mẫu hệ thống). Không hoàn tác được.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleting(null)}>
            Huỷ
          </Button>
          <LoadingButton color="error" variant="contained" loading={busy} onClick={handleDelete}>
            Xoá
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ----------------------------------------------------------------------

function ReceiptAssignmentsCard({
  data,
  onSaved,
}: {
  data: IPrintTemplateList;
  onSaved: () => Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const templates = data.templates.filter((t) => t.kind === 'receipt');
  const initial = useMemo(
    () =>
      Object.fromEntries(
        data.assignments
          .filter((a) => a.kind === 'receipt')
          .map((a) => [cellKey(a.channel, a.paymentMethod), a.templateId])
      ) as Record<string, string>,
    [data.assignments]
  );
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(cells) !== JSON.stringify(initial);

  // Bảng đang soạn dưới dạng danh sách để tính mẫu "kế thừa" của các ô trống.
  const draftList: IPrintTemplateList = useMemo(
    () => ({
      templates,
      assignments: Object.entries(cells)
        .filter(([, templateId]) => templateId)
        .map(([key, templateId]) => {
          const [channel, paymentMethod] = key.split('|');
          return {
            kind: 'receipt',
            channel,
            paymentMethod,
            templateId,
          } as IPrintTemplateList['assignments'][number];
        }),
    }),
    [cells, templates]
  );

  const save = async () => {
    const entries: IPrintTemplateAssignmentInput[] = draftList.assignments.map(
      ({ channel, paymentMethod, templateId }) => ({
        channel,
        paymentMethod,
        templateId,
      })
    );
    setSaving(true);
    try {
      await setPrintTemplateAssignments('receipt', entries);
      enqueueSnackbar('Đã lưu mẫu áp dụng');
      await onSaved();
    } catch (saveError) {
      enqueueSnackbar(apiErrorMessage(saveError, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Mẫu hoá đơn đang áp dụng"
        subheader="Mỗi ô là một kênh bán × phương thức thanh toán. Ô để trống dùng mẫu của ô rộng hơn: cùng kênh → cùng phương thức → mặc định (góc trên trái) → mẫu hệ thống. Hoá đơn trả bằng nhiều phương thức dùng cột “Mọi phương thức”."
        action={
          <Stack direction="row" spacing={1}>
            <Button color="inherit" disabled={!dirty || saving} onClick={() => setCells(initial)}>
              Hoàn tác
            </Button>
            <LoadingButton variant="contained" disabled={!dirty} loading={saving} onClick={save}>
              Lưu
            </LoadingButton>
          </Stack>
        }
      />
      {templates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
          Tạo mẫu hoá đơn trước rồi chọn ở đây.
        </Typography>
      ) : (
        <TableContainer sx={{ p: 2 }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 150 }}>Kênh \ Thanh toán</TableCell>
                {METHOD_COLUMNS.map((column) => (
                  <TableCell key={column.value}>{column.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {CHANNEL_ROWS.map((row) => (
                <TableRow key={row.value}>
                  <TableCell>
                    <Typography variant="subtitle2">{row.label}</Typography>
                  </TableCell>
                  {METHOD_COLUMNS.map((column) => {
                    const key = cellKey(row.value, column.value);
                    const value = cells[key] ?? '';
                    const isDefault = row.value === PRINT_ANY && column.value === PRINT_ANY;
                    // Ô trống → mẫu mà ô này đang kế thừa.
                    const inherited = value
                      ? null
                      : resolveAppliedTemplate(
                          draftList,
                          'receipt',
                          row.value === PRINT_ANY ? null : row.value,
                          column.value === PRINT_ANY ? null : column.value
                        );
                    return (
                      <TableCell key={column.value}>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={value}
                          onChange={(event) =>
                            setCells((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                          SelectProps={{
                            displayEmpty: true,
                            renderValue: (selected) => {
                              const chosen = templates.find((t) => t.id === selected);
                              if (chosen) return chosen.name;
                              return (
                                <Box
                                  component="span"
                                  sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                                >
                                  {inherited ? `↳ ${inherited.name}` : 'Mẫu hệ thống'}
                                </Box>
                              );
                            },
                          }}
                          inputProps={{ 'aria-label': `Mẫu cho ${row.label} · ${column.label}` }}
                          sx={{ minWidth: 130 }}
                        >
                          <MenuItem value="">
                            <em>{isDefault ? 'Mẫu hệ thống' : 'Theo ô rộng hơn'}</em>
                          </MenuItem>
                          {templates.map((template) => (
                            <MenuItem key={template.id} value={template.id}>
                              {template.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  );
}

function LabelDefaultCard({
  data,
  onSaved,
}: {
  data: IPrintTemplateList;
  onSaved: () => Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const templates = data.templates.filter((t) => t.kind === 'label');
  const initial =
    data.assignments.find(
      (a) => a.kind === 'label' && a.channel === PRINT_ANY && a.paymentMethod === PRINT_ANY
    )?.templateId ?? '';
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await setPrintTemplateAssignments(
        'label',
        value ? [{ channel: PRINT_ANY, paymentMethod: PRINT_ANY, templateId: value }] : []
      );
      enqueueSnackbar('Đã lưu mẫu tem mặc định');
      await onSaved();
    } catch (saveError) {
      enqueueSnackbar(apiErrorMessage(saveError, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Mẫu tem đang áp dụng"
        subheader="Mẫu được chọn sẵn khi bấm “In tem mã”; người in vẫn đổi được sang mẫu khác hoặc khổ giấy hệ thống."
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ p: 3 }}
        alignItems={{ sm: 'center' }}
      >
        <TextField
          select
          size="small"
          label="Mẫu tem mặc định"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 320 }}
          disabled={templates.length === 0}
          helperText={templates.length === 0 ? 'Tạo mẫu tem trước rồi chọn ở đây.' : undefined}
        >
          <MenuItem value="">
            <em>Khổ giấy hệ thống (chọn khi in)</em>
          </MenuItem>
          {templates.map((template) => (
            <MenuItem key={template.id} value={template.id}>
              {template.name}
            </MenuItem>
          ))}
        </TextField>
        <LoadingButton
          variant="contained"
          disabled={value === initial}
          loading={saving}
          onClick={save}
        >
          Lưu
        </LoadingButton>
      </Stack>
    </Card>
  );
}
