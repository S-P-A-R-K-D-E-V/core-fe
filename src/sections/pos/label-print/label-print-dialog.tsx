'use client';

import { useMemo, useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useBoolean } from 'src/hooks/use-boolean';

import { printHtmlDocument } from 'src/utils/print-html';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useStoreBrand } from 'src/components/branding';

import { SYMBOLOGY_LABEL } from './barcode';
import { formatMm, dotsToMm, pageSizeMm } from './label-geometry';
import {
  labelValue,
  planLabelSheet,
  formatLabelPrice,
  buildLabelListCsv,
  normalizeQuantity,
  MAX_LABELS_PER_JOB,
  renderLabelSheetHtml,
  renderCalibrationSheetHtml,
} from './label-sheet';
import {
  loadCalibration,
  saveCalibration,
  LABEL_TEMPLATES,
  resolveTemplate,
  stepCalibration,
  loadLabelSettings,
  saveLabelSettings,
  CUSTOM_TEMPLATE_ID,
  defaultCalibration,
  normalizeCalibration,
  validateLabelTemplate,
  TEMPLATE_NUMBER_FIELDS,
} from './label-template';

import type { LabelSource, LabelPrintJob } from './label-sheet';
import type {
  ModuleDots,
  LabelOptions,
  LabelTemplate,
  LabelPaperKind,
  LabelCalibration,
  LabelPriceSuffix,
  LabelValueSource,
  LabelContentLayout,
  LabelPrintSettings,
} from './label-template';

// ----------------------------------------------------------------------
// Hộp thoại "In tem mã": chọn loại giấy, số tem từng mã, nội dung tem, căn chỉnh máy in, xem trước
// trang đầu tiên rồi in qua hộp thoại in của trình duyệt (iframe ẩn). Mọi tính toán nằm ở các file
// không giao diện cùng thư mục; ô xem trước hiện ĐÚNG tài liệu HTML sẽ gửi cho máy in.
// Loại giấy đã chọn, tuỳ chọn và căn chỉnh được nhớ theo trình duyệt (localStorage) — mỗi máy tính ở
// quầy căn một lần cho máy in của nó.
// ----------------------------------------------------------------------

const PX_PER_MM = 96 / 25.4;
const PREVIEW_WIDTH_PX = 640;
const PREVIEW_MAX_SCALE = 4;
const PREVIEW_MAX_HEIGHT_PX = 420;

const MODULE_HINT: Record<ModuleDots, string> = {
  1: 'vạch mảnh, cho mã dài',
  2: 'thông dụng',
  3: 'vạch to, dễ quét',
};

/** "2 điểm (0,25 mm) — thông dụng" với giấy cuộn; "0,25 mm — thông dụng" với giấy tờ. */
function moduleChoiceLabel(kind: LabelPaperKind, dots: ModuleDots): string {
  const mm = `${formatMm(dotsToMm(dots))} mm`;
  return `${kind === 'sheet' ? mm : `${dots} điểm (${mm})`} — ${MODULE_HINT[dots]}`;
}

const signedMm = (mm: number) => `${mm > 0 ? '+' : ''}${formatMm(mm)} mm`;

const groupThousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Tải một file chữ về máy (danh sách tem dạng CSV). */
function downloadTextFile(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type Props = {
  open: boolean;
  onClose: VoidFunction;
  /** Các mã hàng cần in; `quantity` là số tem gợi ý ban đầu của từng dòng. */
  sources: LabelSource[];
};

export default function LabelPrintDialog({ open, onClose, sources }: Props) {
  // Nội dung chỉ được dựng khi hộp thoại mở → mỗi lần mở là một trạng thái mới đọc từ localStorage.
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <LabelPrintContent sources={sources} onClose={onClose} />
    </Dialog>
  );
}

// ----------------------------------------------------------------------

function LabelPrintContent({ sources, onClose }: Omit<Props, 'open'>) {
  const { enqueueSnackbar } = useSnackbar();
  const { brandName } = useStoreBrand();
  const help = useBoolean();

  const [rows] = useState<LabelSource[]>(() => sources);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(sources.map((source) => [source.key, String(normalizeQuantity(source.quantity))]))
  );
  const [settings, setSettings] = useState<LabelPrintSettings>(loadLabelSettings);
  const [calibration, setCalibration] = useState<LabelCalibration>(() =>
    loadCalibration(settings.templateId)
  );

  const template = useMemo(() => resolveTemplate(settings), [settings]);
  const isCustom = settings.templateId === CUSTOM_TEMPLATE_ID;
  const isSheet = template.kind === 'sheet';
  const { options } = settings;

  const changeSettings = useCallback(
    (patch: Partial<LabelPrintSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      saveLabelSettings(next);
    },
    [settings]
  );

  const changeOptions = (patch: Partial<LabelOptions>) =>
    changeSettings({ options: { ...options, ...patch } });

  const changeCustomTemplate = (patch: Partial<LabelTemplate>) =>
    changeSettings({ customTemplate: { ...settings.customTemplate, ...patch } });

  const handleChangeTemplate = (templateId: string) => {
    changeSettings({ templateId });
    setCalibration(loadCalibration(templateId));
  };

  const changeCalibration = (next: LabelCalibration) => {
    const normalized = normalizeCalibration(next, calibration);
    setCalibration(normalized);
    saveCalibration(settings.templateId, normalized);
  };

  const templateErrors = useMemo(() => validateLabelTemplate(template), [template]);

  const job: LabelPrintJob = useMemo(
    () => ({
      items: rows.map((row) => ({ ...row, quantity: normalizeQuantity(quantities[row.key]) })),
      options,
      storeName: brandName,
    }),
    [rows, quantities, options, brandName]
  );

  const plan = useMemo(
    () => (templateErrors.length > 0 ? null : planLabelSheet(job, template, calibration)),
    [templateErrors, job, template, calibration]
  );

  const planErrors = [plan?.layoutError, plan?.limitError].filter((error): error is string => !!error);
  const blockingErrors = templateErrors.length > 0 ? templateErrors : planErrors;
  const labelCount = plan?.labelCount ?? 0;
  const pageCount = plan?.pageCount ?? 0;
  const canPrint = blockingErrors.length === 0 && labelCount > 0;
  const hasRowsToExport = job.items.some((item) => item.quantity > 0);

  const previewHtml = useMemo(
    () => (canPrint ? renderLabelSheetHtml(job, template, calibration, { maxPages: 1 }) : ''),
    [canPrint, job, template, calibration]
  );

  const problemByKey = new Map((plan?.problems ?? []).map((problem) => [problem.key, problem]));
  const labelByKey = new Map((plan?.labels ?? []).map((label) => [label.source.key, label]));
  const notes = (plan?.labels ?? []).filter((label) => label.note);

  const print = (html: string) => {
    printHtmlDocument(html).catch((error) => {
      console.error(error);
      enqueueSnackbar('Không mở được hộp thoại in của trình duyệt', { variant: 'error' });
    });
  };

  const handlePrint = () => {
    if (canPrint) print(renderLabelSheetHtml(job, template, calibration));
  };

  const handlePrintCalibration = () => {
    if (templateErrors.length === 0) print(renderCalibrationSheetHtml(template, calibration));
  };

  const handleExport = () => {
    downloadTextFile('danh-sach-tem-ma.csv', buildLabelListCsv(job.items), 'text/csv;charset=utf-8');
  };

  const page = pageSizeMm(template);
  // Mẫu tuỳ chỉnh đang gõ dở có thể chưa có số hợp lệ
  const pageSizeText =
    templateErrors.length > 0 ? '—' : `${formatMm(page.widthMm)} × ${formatMm(page.heightMm)} mm`;
  // Giấy cuộn: phóng to cho dễ đọc. Giấy tờ: cỡ thật, cuộn trong khung để xem cả tờ.
  const previewScale = isSheet
    ? 1
    : Math.min(PREVIEW_MAX_SCALE, Math.max(1, PREVIEW_WIDTH_PX / (page.widthMm * PX_PER_MM)));
  const previewTitle = isSheet ? 'Xem trước tờ tem đầu tiên' : 'Xem trước hàng tem đầu tiên';
  const pageWord = isSheet ? 'tờ' : 'hàng (trang in)';
  const priceExample = formatLabelPrice(185000, {
    suffix: options.priceSuffix,
    unit: options.showUnit ? 'cái' : null,
  });

  return (
    <>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        In tem mã
        <IconButton onClick={onClose} size="small" aria-label="Đóng hộp thoại">
          <Iconify icon="mingcute:close-line" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box
          display="grid"
          gap={3}
          gridTemplateColumns={{ xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(0, 5fr)' }}
        >
          {/* Cột trái: hàng cần in + xem trước */}
          <Stack spacing={2}>
            <TableContainer sx={{ maxHeight: 320, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Tên hàng</TableCell>
                    <TableCell>Mã in vạch</TableCell>
                    <TableCell align="right" sx={{ width: 110 }}>
                      Số tem
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const problem = problemByKey.get(row.key);
                    const label = labelByKey.get(row.key);
                    return (
                      <TableRow key={row.key}>
                        <TableCell>
                          <Typography variant="body2">{row.name}</Typography>
                          {row.code && (
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              {row.code}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                            {labelValue(row, options) || '—'}
                          </Typography>
                          {label && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {SYMBOLOGY_LABEL[label.barcode.symbology]}
                            </Typography>
                          )}
                          {problem && <Chip size="small" color="error" variant="outlined" label="Không in được" />}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={quantities[row.key] ?? ''}
                            onChange={(event) =>
                              setQuantities((prev) => ({ ...prev, [row.key]: event.target.value }))
                            }
                            inputProps={{
                              min: 0,
                              max: MAX_LABELS_PER_JOB,
                              step: 1,
                              'aria-label': `Số tem của ${row.name}`,
                              style: { textAlign: 'right' },
                            }}
                            sx={{ width: 90 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Mỗi lần in tối đa {groupThousands(MAX_LABELS_PER_JOB)} tem. Nếu mã vạch in không đầy đủ, hãy dùng
              mẫu giấy lớn hơn hoặc rút ngắn mã hàng. Mã có dấu tiếng Việt không in được thành mã vạch.
            </Typography>

            {plan && plan.problems.length > 0 && (
              <Alert severity="warning">
                <Typography variant="subtitle2">
                  {plan.problems.length} mã hàng không in được — các mã còn lại vẫn in bình thường
                </Typography>
                <Box component="ul" aria-label="Mã hàng không in được" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                  {plan.problems.map((problem) => (
                    <li key={problem.key}>
                      <Typography variant="body2">
                        <strong>{problem.name}</strong>
                        {problem.value ? ` (${problem.value})` : ''}: {problem.reason}
                      </Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            )}

            {notes.length > 0 && (
              <Alert severity="info">
                {notes.map((label) => (
                  <Typography key={label.source.key} variant="body2">
                    <strong>{label.source.name}</strong> ({label.barcode.value}): {label.note}
                  </Typography>
                ))}
              </Alert>
            )}

            {blockingErrors.length > 0 && (
              <Alert severity="error">
                {blockingErrors.map((error) => (
                  <Typography key={error} variant="body2">
                    {error}
                  </Typography>
                ))}
              </Alert>
            )}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {previewTitle}
              </Typography>
              {previewHtml ? (
                <Box sx={{ overflow: 'auto', maxHeight: PREVIEW_MAX_HEIGHT_PX }}>
                  <Box
                    sx={{
                      width: page.widthMm * PX_PER_MM * previewScale,
                      height: page.heightMm * PX_PER_MM * previewScale,
                      overflow: 'hidden',
                      borderRadius: 0.5,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <iframe
                      title={previewTitle}
                      sandbox=""
                      srcDoc={previewHtml}
                      style={{
                        display: 'block',
                        border: 0,
                        width: `${page.widthMm}mm`,
                        height: `${page.heightMm}mm`,
                        transform: `scale(${previewScale})`,
                        transformOrigin: '0 0',
                      }}
                    />
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  Chưa có tem nào in được để xem trước.
                </Typography>
              )}
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                {isSheet
                  ? `Cỡ thật · mỗi tờ là một trang in ${pageSizeText}`
                  : `Phóng to ${formatMm(Math.round(previewScale * 10) / 10)} lần · mỗi hàng tem là một trang in ${pageSizeText}`}{' '}
                · viền nét đứt chỉ để xem, không in ra.
              </Typography>
            </Box>
          </Stack>

          {/* Cột phải: loại giấy, nội dung, căn chỉnh, hướng dẫn */}
          <Stack spacing={2.5}>
            <TextField
              select
              size="small"
              label="Loại giấy in tem"
              value={settings.templateId}
              onChange={(event) => handleChangeTemplate(event.target.value)}
            >
              {LABEL_TEMPLATES.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name}
                </MenuItem>
              ))}
              <MenuItem value={CUSTOM_TEMPLATE_ID}>Tuỳ chỉnh…</MenuItem>
            </TextField>

            {isCustom && (
              <Box display="grid" gap={1.5} gridTemplateColumns="repeat(2, minmax(0, 1fr))">
                <TextField
                  select
                  size="small"
                  label="Kiểu giấy"
                  value={settings.customTemplate.kind}
                  onChange={(event) => changeCustomTemplate({ kind: event.target.value as LabelPaperKind })}
                >
                  <MenuItem value="roll">Giấy cuộn — mỗi hàng một trang</MenuItem>
                  <MenuItem value="sheet">Giấy tờ (A4, A5…) — nhiều hàng</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Bố cục tem"
                  value={settings.customTemplate.layout}
                  onChange={(event) =>
                    changeCustomTemplate({ layout: event.target.value as LabelContentLayout })
                  }
                >
                  <MenuItem value="stacked">Xếp dọc: tên, mã vạch, giá</MenuItem>
                  <MenuItem value="split">Tem dài: mã vạch trái, tên và giá phải</MenuItem>
                </TextField>
                {TEMPLATE_NUMBER_FIELDS.filter((field) => isSheet || !field.sheetOnly).map((field) => {
                  const value = settings.customTemplate[field.key];
                  return (
                    <TextField
                      key={field.key}
                      size="small"
                      type="number"
                      label={`${(isSheet && field.sheetLabel) || field.label} (${field.unit})`}
                      value={Number.isFinite(value) ? value : ''}
                      onChange={(event) =>
                        changeCustomTemplate({
                          [field.key]: event.target.value === '' ? NaN : Number(event.target.value),
                        })
                      }
                      inputProps={{ min: field.min, max: field.max, step: field.step }}
                    />
                  );
                })}
              </Box>
            )}

            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Nội dung tem</Typography>
              <TextField
                select
                size="small"
                label="Mã để in vạch"
                value={options.valueSource}
                onChange={(event) =>
                  changeOptions({ valueSource: event.target.value as LabelValueSource })
                }
                sx={{ my: 1 }}
              >
                <MenuItem value="barcode-or-code">Mã vạch — không có thì dùng mã hàng</MenuItem>
                <MenuItem value="code">Mã hàng</MenuItem>
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={options.showName}
                    onChange={(event) => changeOptions({ showName: event.target.checked })}
                  />
                }
                label="In tên hàng (tối đa 2 dòng)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={options.showStoreName}
                    onChange={(event) => changeOptions({ showStoreName: event.target.checked })}
                  />
                }
                label={`In tên cửa hàng (${brandName})`}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={options.showPrice}
                    onChange={(event) => changeOptions({ showPrice: event.target.checked })}
                  />
                }
                label="In giá bán"
              />
              {options.showPrice && (
                <>
                  <TextField
                    select
                    size="small"
                    label="Chữ sau giá"
                    value={options.priceSuffix}
                    onChange={(event) =>
                      changeOptions({ priceSuffix: event.target.value as LabelPriceSuffix })
                    }
                    helperText={`Giá sẽ in dạng: ${priceExample}`}
                    sx={{ mt: 1 }}
                  >
                    <MenuItem value="đ">đ</MenuItem>
                    <MenuItem value="VND">VND</MenuItem>
                    <MenuItem value="none">Không ghi</MenuItem>
                  </TextField>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.showUnit}
                        onChange={(event) => changeOptions({ showUnit: event.target.checked })}
                      />
                    }
                    label="Kèm đơn vị tính (hàng có đơn vị)"
                  />
                </>
              )}
            </Stack>

            <Stack spacing={1}>
              <Typography variant="subtitle2">Căn chỉnh máy in (nhớ riêng cho loại giấy này)</Typography>
              <CalibrationStepper
                label="Lệch trái"
                hint="dương = sang phải"
                value={calibration.offsetLeftMm}
                onStep={(steps) => changeCalibration(stepCalibration(calibration, 'offsetLeftMm', steps))}
              />
              <CalibrationStepper
                label="Lệch trên"
                hint="dương = xuống dưới"
                value={calibration.offsetTopMm}
                onStep={(steps) => changeCalibration(stepCalibration(calibration, 'offsetTopMm', steps))}
              />
              <CalibrationStepper
                label="Khe cột thêm"
                hint="cộng vào khe ngang giữa các tem"
                value={calibration.extraColumnGapMm}
                onStep={(steps) =>
                  changeCalibration(stepCalibration(calibration, 'extraColumnGapMm', steps))
                }
              />
              {isSheet && (
                <CalibrationStepper
                  label="Khe hàng thêm"
                  hint="cộng vào khe dọc giữa các hàng"
                  value={calibration.extraRowGapMm}
                  onStep={(steps) =>
                    changeCalibration(stepCalibration(calibration, 'extraRowGapMm', steps))
                  }
                />
              )}
              <TextField
                select
                size="small"
                label="Độ rộng vạch"
                value={calibration.moduleDots}
                onChange={(event) =>
                  changeCalibration({ ...calibration, moduleDots: Number(event.target.value) as ModuleDots })
                }
                sx={{ mt: 1 }}
              >
                {([1, 2, 3] as ModuleDots[]).map((dots) => (
                  <MenuItem key={dots} value={dots}>
                    {moduleChoiceLabel(template.kind, dots)}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handlePrintCalibration}
                  disabled={templateErrors.length > 0}
                >
                  In thử căn chỉnh
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => changeCalibration(defaultCalibration(settings.templateId))}
                >
                  Đặt lại
                </Button>
              </Stack>
            </Stack>

            <Box>
              <Button
                size="small"
                color="inherit"
                onClick={help.onToggle}
                aria-expanded={help.value}
                endIcon={
                  <Iconify
                    icon={help.value ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
                    width={16}
                  />
                }
              >
                Cài đặt máy in
              </Button>
              <Collapse in={help.value} unmountOnExit>
                <Box
                  component="ol"
                  sx={{ m: 0, mt: 1, pl: 2.5, typography: 'body2', color: 'text.secondary', '& li': { mb: 0.5 } }}
                >
                  <li>
                    Trong hộp thoại in, chọn đúng {isSheet ? 'máy in giấy tờ (laser / in phun)' : 'máy in tem'} ở
                    mục Máy in.
                  </li>
                  {isSheet ? (
                    <li>
                      Khổ giấy = cả tờ tem: <strong>{pageSizeText}</strong>. Tờ không phải A4 / A5 thì tạo
                      khổ giấy này trong driver của máy in.
                    </li>
                  ) : (
                    <li>
                      Khổ giấy = một hàng tem: <strong>{pageSizeText}</strong> (rộng = khổ cuộn, cao = chiều
                      cao một tem). Chưa có thì tạo khổ giấy này trong driver của máy in.
                    </li>
                  )}
                  <li>Lề: Không có.</li>
                  <li>Tỉ lệ: 100% — không chọn vừa trang.</li>
                  <li>Bỏ chọn “Đầu trang và chân trang”.</li>
                  {!isSheet && (
                    <li>
                      Trong driver, bật cảm biến khe hở giữa các tem (Gap sensor) để máy dừng đúng đầu mỗi
                      hàng tem.
                    </li>
                  )}
                  <li>
                    Bấm “In thử căn chỉnh”: khung in ra phải cách đều mép tem 0,5 mm; lệch về phía nào
                    thì chỉnh ngược lại, mỗi nấc 0,5 mm. Kích thước giấy khác mẫu thì chọn “Tuỳ chỉnh…”
                    để sửa từng số.
                  </li>
                </Box>
              </Collapse>
            </Box>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions>
        <Typography variant="body2" sx={{ flexGrow: 1, pl: 1, color: 'text.secondary' }}>
          {labelCount > 0
            ? `${groupThousands(labelCount)} tem · ${groupThousands(pageCount)} ${pageWord} · ${template.name}`
            : 'Chưa có tem nào để in'}
        </Typography>
        <Button color="inherit" onClick={handleExport} disabled={!hasRowsToExport}>
          Xuất file CSV
        </Button>
        <Button color="inherit" onClick={onClose}>
          Đóng
        </Button>
        <Button
          variant="contained"
          onClick={handlePrint}
          disabled={!canPrint}
          startIcon={<Iconify icon="solar:printer-minimalistic-bold" />}
        >
          {labelCount > 0 ? `In ${groupThousands(labelCount)} tem` : 'In'}
        </Button>
      </DialogActions>
    </>
  );
}

// ----------------------------------------------------------------------

function CalibrationStepper({
  label,
  hint,
  value,
  onStep,
}: {
  label: string;
  hint: string;
  value: number;
  onStep: (steps: number) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          {hint}
        </Typography>
      </Box>
      <IconButton size="small" aria-label={`Giảm ${label}`} onClick={() => onStep(-1)}>
        <Iconify icon="eva:minus-fill" width={18} />
      </IconButton>
      <Typography
        variant="subtitle2"
        aria-label={label}
        sx={{ width: 76, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
      >
        {signedMm(value)}
      </Typography>
      <IconButton size="small" aria-label={`Tăng ${label}`} onClick={() => onStep(1)}>
        <Iconify icon="eva:plus-fill" width={18} />
      </IconButton>
    </Stack>
  );
}
