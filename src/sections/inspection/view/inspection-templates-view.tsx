'use client';

import { useState, useEffect, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { useResponsive } from 'src/hooks/use-responsive';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import {
  getInspectionTemplates,
  importCleaningIntoTemplate,
  publishInspectionTemplate,
  saveInspectionTemplateDraft,
  createInspectionTemplateDraft,
  deleteInspectionTemplateDraft,
} from 'src/api/inspection';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  WorkBlock,
  InspectionType,
  IInspectionTemplate,
  InspectionZoneCode,
  IInspectionTemplateItemInput,
} from 'src/types/inspection';
import {
  WORK_BLOCKS,
  WEEKDAY_SHORT,
  INSPECTION_ZONES,
  WORK_BLOCK_LABEL,
  INSPECTION_TYPE_LABEL,
} from 'src/types/inspection';

import { LevelChip, ZoneChips, toDateInput } from '../inspection-common';

// ----------------------------------------------------------------------
// Hạng mục & lịch: một danh sách hạng mục cho cả việc nhân viên làm trong ca lẫn kiểm tra. Có phiên bản: tạo bản nháp
// (từ mẫu hoặc chép bản mới nhất) → sửa mục → công bố. Bản đã công bố không sửa được — sửa nội dung là tạo phiên bản mới
// có ngày hiệu lực, lượt kiểm cũ vẫn hiện đúng bản lúc kiểm. Hạng mục "nhân viên tự làm" (chỉ bảng mỗi ca) hiện ở Việc
// của tôi của người trong ca theo thứ / ca đã chọn.
// ----------------------------------------------------------------------

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Bật / tắt một giá trị trong lịch; bỏ hết = null (mọi ngày / mọi ca). */
function toggleIn<T>(list: T[] | null, value: T, order: T[]): T[] | null {
  const current = list ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : order.filter((v) => v === value || current.includes(v));
  return next.length === 0 ? null : next;
}

/** "T2, T4 · Sáng" — tóm tắt lịch của hạng mục; trống = mọi ngày, mọi ca. */
export function scheduleLabel(weekdays: number[] | null, blocks: WorkBlock[] | null): string {
  const days = weekdays?.length ? weekdays.map((d) => WEEKDAY_SHORT[d]).join(', ') : 'Mọi ngày';
  const shifts = blocks?.length ? blocks.map((b) => WORK_BLOCK_LABEL[b]).join(', ') : 'mọi ca';
  return `${days} · ${shifts}`;
}

export function toInput(t: IInspectionTemplate): IInspectionTemplateItemInput[] {
  return [...t.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => ({
      code: i.code,
      groupName: i.groupName,
      title: i.title,
      passCriteria: i.passCriteria,
      level: i.level,
      zones: i.zones,
      perStaff: i.perStaff,
      observationsPerStaff: i.observationsPerStaff,
      requiresPhotoOnFail: i.requiresPhotoOnFail,
      requiresFix: i.requiresFix,
      staffDoes: i.staffDoes ?? false,
      weekdays: i.weekdays?.length ? i.weekdays : null,
      blocks: i.blocks?.length ? i.blocks : null,
    }));
}

function TemplateStatus({ t, current }: { t: IInspectionTemplate; current: boolean }) {
  if (!t.publishedAt) return <Chip size="small" color="warning" label="Nháp" />;
  return <Chip size="small" color={current ? 'success' : 'default'} label={current ? 'Đang dùng' : 'Đã công bố'} />;
}

type EditorProps = {
  template: IInspectionTemplate | null;
  readOnly: boolean;
  onClose: VoidFunction;
  onSaved: (t: IInspectionTemplate) => void;
};

function TemplateEditorDialog({ template, readOnly, onClose, onSaved }: EditorProps) {
  const { enqueueSnackbar } = useSnackbar();
  const smDown = useResponsive('down', 'sm');
  const [name, setName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [items, setItems] = useState<IInspectionTemplateItemInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setEffectiveFrom(template.effectiveFrom);
      setItems(toInput(template));
    }
  }, [template]);

  const patch = (index: number, change: Partial<IInspectionTemplateItemInput>) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...change } : it)));
  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const toggleZone = (index: number, zone: InspectionZoneCode) =>
    setItems((prev) =>
      prev.map((it, i) =>
        i !== index
          ? it
          : {
              ...it,
              zones: it.zones.includes(zone)
                ? it.zones.filter((z) => z !== zone)
                : INSPECTION_ZONES.filter((z) => z === zone || it.zones.includes(z)),
            }
      )
    );

  const codes = items.map((i) => i.code.trim().toUpperCase());
  const duplicate = codes.find((c, i) => c && codes.indexOf(c) !== i);
  const incomplete = items.some((i) => !i.code.trim() || !i.title.trim() || !i.passCriteria.trim());

  const save = async () => {
    if (!template) return;
    setSaving(true);
    try {
      const saved = await saveInspectionTemplateDraft(template.id, name, effectiveFrom, items);
      enqueueSnackbar('Đã lưu bản nháp', { variant: 'success' });
      onSaved(saved);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được hạng mục'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Lưu những gì đang sửa trước, rồi thêm hạng mục "nhân viên tự làm" từ lịch vệ sinh đang dùng vào bản nháp.
  const importCleaning = async () => {
    if (!template) return;
    setSaving(true);
    try {
      if (items.length > 0) await saveInspectionTemplateDraft(template.id, name, effectiveFrom, items);
      const updated = await importCleaningIntoTemplate(template.id);
      const added = updated.items.length - items.length;
      setItems(toInput(updated));
      enqueueSnackbar(added > 0 ? `Đã thêm ${added} hạng mục từ lịch vệ sinh` : 'Lịch vệ sinh không có việc nào mới để thêm', {
        variant: added > 0 ? 'success' : 'info',
      });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lấy được lịch vệ sinh'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const isShiftQuick = template?.type === 'ShiftQuick';

  return (
    <Dialog open={!!template} onClose={() => !saving && onClose()} fullWidth maxWidth="lg" fullScreen={smDown}>
      <DialogTitle>
        {template ? `${INSPECTION_TYPE_LABEL[template.type]} — phiên bản ${template.version}` : ''}
        {readOnly ? ' (chỉ xem)' : ''}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Tên" value={name} onChange={(e) => setName(e.target.value)} disabled={readOnly} fullWidth />
            <TextField
              type="date"
              label="Hiệu lực từ"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              disabled={readOnly}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 200 }}
            />
          </Stack>
          {!readOnly && (
            <Alert severity="info">
              Mức B: không đạt thì người phụ trách khu sửa trong 15 phút. Mức T: sửa trong ca. Khu: lỗi giao người giữ khu đầu
              tiên có người trong ca; không chọn khu thì giao trưởng ca. Chấm theo người: mỗi người trong ca × số lượt.
              {isShiftQuick &&
                ' Nhân viên tự làm: người trong ca làm và chụp ảnh ở Việc của tôi, trưởng ca chấm khi kiểm. Thứ / ca bỏ trống = mọi ngày / mọi ca.'}
            </Alert>
          )}
          {!readOnly && isShiftQuick && (
            <Stack direction="row" spacing={1} alignItems="center">
              <LoadingButton
                size="small"
                variant="outlined"
                loading={saving}
                disabled={!!duplicate || incomplete || !name.trim() || !effectiveFrom}
                startIcon={<Iconify icon="solar:import-bold" />}
                onClick={importCleaning}
              >
                Lấy từ lịch vệ sinh
              </LoadingButton>
              <Typography variant="caption" color="text.secondary">
                Thêm các việc trong lịch vệ sinh đang dùng thành hạng mục &quot;nhân viên tự làm&quot;, giữ thứ và ca.
              </Typography>
            </Stack>
          )}
          {items.map((item, index) => (
            <Stack key={index} spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <TextField
                  size="small"
                  label="Mã"
                  value={item.code}
                  disabled={readOnly}
                  error={!!duplicate && item.code.trim().toUpperCase() === duplicate}
                  onChange={(e) => patch(index, { code: e.target.value })}
                  sx={{ width: { md: 110 } }}
                />
                <TextField
                  size="small"
                  label="Nhóm"
                  value={item.groupName ?? ''}
                  disabled={readOnly}
                  onChange={(e) => patch(index, { groupName: e.target.value || null })}
                  sx={{ width: { md: 220 } }}
                />
                <TextField
                  size="small"
                  label="Hạng mục"
                  value={item.title}
                  disabled={readOnly}
                  onChange={(e) => patch(index, { title: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  size="small"
                  label="Mức"
                  value={item.level}
                  disabled={readOnly}
                  onChange={(e) => patch(index, { level: e.target.value as IInspectionTemplateItemInput['level'] })}
                  sx={{ width: { md: 110 } }}
                >
                  <MenuItem value="Mandatory">B — bắt buộc</MenuItem>
                  <MenuItem value="Standard">T — tiêu chuẩn</MenuItem>
                </TextField>
                {!readOnly && (
                  <Stack direction="row">
                    <IconButton size="small" aria-label="Lên" onClick={() => move(index, -1)}>
                      <Iconify icon="eva:arrow-upward-fill" />
                    </IconButton>
                    <IconButton size="small" aria-label="Xuống" onClick={() => move(index, 1)}>
                      <Iconify icon="eva:arrow-downward-fill" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Xoá mục"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Iconify icon="solar:trash-bin-trash-bold" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
              <TextField
                size="small"
                label="Đạt khi"
                value={item.passCriteria}
                disabled={readOnly}
                onChange={(e) => patch(index, { passCriteria: e.target.value })}
                fullWidth
              />
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="caption" color="text.secondary">
                  Khu:
                </Typography>
                {INSPECTION_ZONES.map((z) => (
                  <Chip
                    key={z}
                    size="small"
                    label={z}
                    disabled={readOnly}
                    color={item.zones.includes(z) ? 'primary' : 'default'}
                    variant={item.zones.includes(z) ? 'filled' : 'outlined'}
                    onClick={() => toggleZone(index, z)}
                  />
                ))}
                <FormControlLabel
                  disabled={readOnly}
                  control={<Switch size="small" checked={item.perStaff} onChange={(e) => patch(index, { perStaff: e.target.checked })} />}
                  label="Chấm theo người"
                />
                {item.perStaff && (
                  <TextField
                    size="small"
                    type="number"
                    label="Số lượt"
                    value={item.observationsPerStaff}
                    disabled={readOnly}
                    onChange={(e) => patch(index, { observationsPerStaff: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })}
                    sx={{ width: 90 }}
                  />
                )}
                <FormControlLabel
                  disabled={readOnly}
                  control={
                    <Switch
                      size="small"
                      checked={item.requiresPhotoOnFail}
                      onChange={(e) => patch(index, { requiresPhotoOnFail: e.target.checked })}
                    />
                  }
                  label="Cần ảnh khi không đạt"
                />
                <FormControlLabel
                  disabled={readOnly}
                  control={<Switch size="small" checked={item.requiresFix} onChange={(e) => patch(index, { requiresFix: e.target.checked })} />}
                  label="Phải sửa"
                />
              </Stack>
              {isShiftQuick && (
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <FormControlLabel
                    disabled={readOnly}
                    control={
                      <Switch size="small" checked={item.staffDoes} onChange={(e) => patch(index, { staffDoes: e.target.checked })} />
                    }
                    label="Nhân viên tự làm"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Thứ:
                  </Typography>
                  {WEEKDAYS.map((d) => (
                    <Chip
                      key={d}
                      size="small"
                      label={WEEKDAY_SHORT[d]}
                      disabled={readOnly}
                      color={item.weekdays?.includes(d) ? 'primary' : 'default'}
                      variant={item.weekdays?.includes(d) ? 'filled' : 'outlined'}
                      onClick={() => patch(index, { weekdays: toggleIn(item.weekdays, d, WEEKDAYS) })}
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    Ca:
                  </Typography>
                  {WORK_BLOCKS.map((b) => (
                    <Chip
                      key={b}
                      size="small"
                      label={WORK_BLOCK_LABEL[b]}
                      disabled={readOnly}
                      color={item.blocks?.includes(b) ? 'primary' : 'default'}
                      variant={item.blocks?.includes(b) ? 'filled' : 'outlined'}
                      onClick={() => patch(index, { blocks: toggleIn(item.blocks, b, WORK_BLOCKS) })}
                    />
                  ))}
                  <Typography variant="caption" color="text.secondary">
                    {scheduleLabel(item.weekdays, item.blocks)}
                  </Typography>
                </Stack>
              )}
              <Divider />
            </Stack>
          ))}
          {!readOnly && (
            <Button
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    code: '',
                    groupName: prev[prev.length - 1]?.groupName ?? null,
                    title: '',
                    passCriteria: '',
                    level: 'Mandatory',
                    zones: [],
                    perStaff: false,
                    observationsPerStaff: 1,
                    requiresPhotoOnFail: true,
                    requiresFix: true,
                    staffDoes: false,
                    weekdays: null,
                    blocks: null,
                  },
                ])
              }
            >
              Thêm mục
            </Button>
          )}
          {duplicate && <Alert severity="error">Mã mục {duplicate} bị trùng.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {readOnly ? 'Đóng' : 'Huỷ'}
        </Button>
        {!readOnly && (
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!name.trim() || !effectiveFrom || items.length === 0 || !!duplicate || incomplete}
            onClick={save}
          >
            Lưu nháp
          </LoadingButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function InspectionTemplatesView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();

  const [type, setType] = useState<InspectionType>('ShiftQuick');
  const [templates, setTemplates] = useState<IInspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ template: IInspectionTemplate; readOnly: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await getInspectionTemplates(type));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được hạng mục'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [type, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const today = toDateInput(new Date());
  const current = templates
    .filter((t) => t.publishedAt && t.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0];

  const createDraft = async (fromDefault: boolean) => {
    setBusy(true);
    try {
      const draft = await createInspectionTemplateDraft(type, fromDefault, today);
      await load();
      setEditing({ template: draft, readOnly: false });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tạo được bản nháp'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (t: IInspectionTemplate) => {
    const ok = await confirm({
      title: `Công bố phiên bản ${t.version}?`,
      content:
        `Từ ${fDate(t.effectiveFrom)}, việc trong ca và lượt kiểm mới dùng phiên bản này (${t.items.length} mục).\n` +
        'Sau khi công bố không sửa được — muốn đổi thì tạo phiên bản mới.',
      confirmText: 'Công bố',
      cancelText: 'Huỷ',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await publishInspectionTemplate(t.id);
      enqueueSnackbar('Đã công bố', { variant: 'success' });
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không công bố được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: IInspectionTemplate) => {
    const ok = await confirm({
      title: `Xoá bản nháp phiên bản ${t.version}?`,
      confirmText: 'Xoá',
      cancelText: 'Huỷ',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteInspectionTemplateDraft(t.id);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xoá được'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Hạng mục & lịch"
        links={[{ name: 'Công việc', href: paths.dashboard.cleaning.myChecklist }, { name: 'Hạng mục & lịch' }]}
        action={
          <Stack direction="row" spacing={1}>
            <LoadingButton variant="outlined" loading={busy} onClick={() => createDraft(true)}>
              Tạo nháp từ mẫu
            </LoadingButton>
            {templates.length > 0 && (
              <LoadingButton variant="contained" loading={busy} onClick={() => createDraft(false)}>
                Phiên bản mới
              </LoadingButton>
            )}
          </Stack>
        }
        sx={{ mb: 3 }}
      />

      <Tabs value={type} onChange={(_, v) => setType(v)} sx={{ mb: 2 }}>
        <Tab value="ShiftQuick" label="Mỗi ca (làm + kiểm nhanh)" />
        <Tab value="WeeklyFull" label="Kiểm đầy đủ hằng tuần" />
      </Tabs>

      {!loading && !current && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Chưa có hạng mục {INSPECTION_TYPE_LABEL[type].toLowerCase()} nào đang dùng. Bấm &quot;Tạo nháp từ mẫu&quot;, xem lại
          các mục rồi công bố — chưa công bố thì nhân viên không thấy việc trong ca, không bắt đầu kiểm được và hệ thống không
          nhắc kiểm.
        </Alert>
      )}

      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Phiên bản</TableCell>
                    <TableCell>Tên</TableCell>
                    <TableCell>Hiệu lực từ</TableCell>
                    <TableCell>Số mục</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                        Chưa có phiên bản nào.
                      </TableCell>
                    </TableRow>
                  )}
                  {templates.map((t) => (
                    <TableRow key={t.id} hover>
                      <TableCell>v{t.version}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{fDate(t.effectiveFrom)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <span>{t.items.length}</span>
                          <LevelChip level="Mandatory" />
                          <span>{t.items.filter((i) => i.level === 'Mandatory').length}</span>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <TemplateStatus t={t} current={current?.id === t.id} />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          {t.publishedAt ? (
                            <Button size="small" onClick={() => setEditing({ template: t, readOnly: true })}>
                              Xem
                            </Button>
                          ) : (
                            <>
                              <Button size="small" onClick={() => setEditing({ template: t, readOnly: false })}>
                                Sửa
                              </Button>
                              <Button size="small" variant="contained" disabled={busy} onClick={() => publish(t)}>
                                Công bố
                              </Button>
                              <Button size="small" color="error" disabled={busy} onClick={() => remove(t)}>
                                Xoá
                              </Button>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>

      {current && (
        <Card sx={{ mt: 3 }}>
          <Stack sx={{ p: 2 }} spacing={1}>
            <Typography variant="subtitle1">Đang dùng: v{current.version}</Typography>
            {[...current.items]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((i) => (
                <Stack key={i.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <LevelChip level={i.level} />
                  <Typography variant="body2" sx={{ minWidth: 220 }}>
                    {i.code} · {i.title}
                  </Typography>
                  {!i.perStaff && <ZoneChips zones={i.zones} />}
                  {i.perStaff && <Chip size="small" variant="outlined" label={`Theo người × ${i.observationsPerStaff}`} />}
                  {i.staffDoes && (
                    <Chip size="small" color="info" variant="outlined" label={`Nhân viên làm · ${scheduleLabel(i.weekdays, i.blocks)}`} />
                  )}
                </Stack>
              ))}
          </Stack>
        </Card>
      )}

      <TemplateEditorDialog
        template={editing?.template ?? null}
        readOnly={editing?.readOnly ?? true}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
      {confirmDialog}
    </Container>
  );
}
