'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import { getInspection, submitInspection, saveInspectionResults, uploadInspectionPhotos } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  IInspection,
  IInspectionResult,
  InspectionOutcome,
  IInspectionResultInput,
  IInspectionTemplateItem,
  IShiftWorkCompletion,
} from 'src/types/inspection';
import { INSPECTION_TYPE_LABEL } from 'src/types/inspection';

import {
  ZoneChips,
  LevelChip,
  StatusChip,
  PhotoPicker,
  OutcomeButtons,
  InspectionPhotoRules,
  ShiftWorkDoneInfo,
} from '../inspection-common';

// ----------------------------------------------------------------------
// Chạy checklist một lượt kiểm (và xem lại sau khi nộp). Mỗi mục một dòng với 3 nút Đạt / Không đạt / NA; mục chấm theo
// người có một dòng cho mỗi người × mỗi lượt quan sát. Không đạt ở mục cần ảnh thì phải thêm ảnh trước khi nộp.
// ----------------------------------------------------------------------

type Row = {
  key: string;
  item: IInspectionTemplateItem;
  staffId: string | null;
  staffName: string | null;
  index: number;
};

type Entry = { outcome: InspectionOutcome | null; note: string; files: File[]; dirty: boolean };

export const entryKey = (itemId: string, staffId: string | null, index: number) => `${itemId}|${staffId ?? ''}|${index}`;

/** Các dòng phải chấm của một lượt kiểm (mục theo người: mỗi người trong ca × mỗi lượt). */
export function buildRows(inspection: IInspection): Row[] {
  const staff = inspection.zoneOwners.staff;
  return [...inspection.template.items]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((item): Row[] =>
      item.perStaff
        ? staff.flatMap((s) =>
            Array.from({ length: Math.max(1, item.observationsPerStaff) }, (_, index) => ({
              key: entryKey(item.id, s.staffId, index),
              item,
              staffId: s.staffId,
              staffName: s.name,
              index,
            }))
          )
        : [{ key: entryKey(item.id, null, 0), item, staffId: null, staffName: null, index: 0 }]
    );
}

function entriesFrom(inspection: IInspection): Record<string, Entry> {
  const map: Record<string, Entry> = {};
  inspection.results.forEach((r) => {
    map[entryKey(r.itemId, r.observedStaffId, r.observationIndex)] = {
      outcome: r.outcome,
      note: r.note ?? '',
      files: [],
      dirty: false,
    };
  });
  return map;
}

type Props = { id: string };

export default function InspectionRunView({ id }: Props) {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [confirm, confirmDialog] = useConfirmDialog();

  const [inspection, setInspection] = useState<IInspection | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission(user, PERMISSIONS.inspection.manage);

  const load = useCallback(async () => {
    try {
      const data = await getInspection(id);
      setInspection(data);
      setEntries(entriesFrom(data));
      setNote(data.note ?? '');
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được lượt kiểm'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => (inspection ? buildRows(inspection) : []), [inspection]);
  const resultByKey = useMemo(() => {
    const map: Record<string, IInspectionResult> = {};
    inspection?.results.forEach((r) => {
      map[entryKey(r.itemId, r.observedStaffId, r.observationIndex)] = r;
    });
    return map;
  }, [inspection]);
  // Hạng mục nhân viên tự làm: ai đã làm, ảnh — người kiểm xem khi chấm.
  const completionByItem = useMemo(() => {
    const map: Record<string, IShiftWorkCompletion> = {};
    (inspection?.completions ?? []).forEach((c) => {
      map[c.itemId] = c.completion;
    });
    return map;
  }, [inspection]);
  const names = useMemo(() => {
    const map: Record<string, string> = {};
    inspection?.zoneOwners.staff.forEach((s) => {
      map[s.staffId] = s.name;
    });
    return map;
  }, [inspection]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (!inspection) return null;

  const { summary, zoneOwners } = inspection;
  const userId = user?.id as string | undefined;
  const isSubmitted = summary.status === 'Submitted';
  const canEdit = isSubmitted
    ? canManage
    : canManage || summary.inspectorId === userId || zoneOwners.shiftLeadId === userId;

  const dirtyKeys = Object.keys(entries).filter((k) => entries[k].dirty && entries[k].outcome);
  const remaining = rows.filter((r) => !entries[r.key]?.outcome).length;
  const missingPhotos = rows.filter((r) => {
    const e = entries[r.key];
    if (e?.outcome !== 'Fail' || !r.item.requiresPhotoOnFail) return false;
    const saved = resultByKey[r.key]?.photos.filter((p) => p.kind === 'Fault').length ?? 0;
    return saved + e.files.length === 0;
  }).length;
  const counts = rows.reduce(
    (acc, r) => {
      const o = entries[r.key]?.outcome;
      if (o === 'Pass') acc.pass += 1;
      if (o === 'Fail') acc.fail += 1;
      if (o === 'NotApplicable') acc.na += 1;
      return acc;
    },
    { pass: 0, fail: 0, na: 0 }
  );

  const update = (key: string, patch: Partial<Entry>) =>
    setEntries((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { outcome: null, note: '', files: [], dirty: false }), ...patch, dirty: true },
    }));

  const save = async (): Promise<boolean> => {
    if (dirtyKeys.length === 0) return true;
    setSaving(true);
    try {
      const inputs: IInspectionResultInput[] = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const key of dirtyKeys) {
        const row = rows.find((r) => r.key === key);
        if (row) {
          const entry = entries[key];
          // eslint-disable-next-line no-await-in-loop
          const keys = entry.outcome === 'Fail' ? await uploadInspectionPhotos(inspection.summary.id, entry.files) : [];
          inputs.push({
            itemId: row.item.id,
            observedStaffId: row.staffId,
            observationIndex: row.index,
            outcome: entry.outcome!,
            note: entry.note.trim() || null,
            faultPhotoKeys: keys.length ? keys : null,
          });
        }
      }
      const updated = await saveInspectionResults(inspection.summary.id, inputs);
      setInspection(updated);
      setEntries(entriesFrom(updated));
      enqueueSnackbar('Đã lưu kết quả', { variant: 'success' });
      return true;
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được kết quả'), { variant: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const ok = await confirm({
      title: 'Nộp lượt kiểm?',
      content:
        `${counts.pass} đạt, ${counts.fail} không đạt, ${counts.na} NA.\n` +
        'Người phụ trách sẽ được báo các lỗi cần sửa (mục B: trong 15 phút).',
      confirmText: 'Nộp',
      cancelText: 'Huỷ',
    });
    if (!ok) return;
    if (!(await save())) return;
    setSaving(true);
    try {
      const updated = await submitInspection(inspection.summary.id, note);
      setInspection(updated);
      setEntries(entriesFrom(updated));
      enqueueSnackbar('Đã nộp lượt kiểm', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa nộp được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  let lastGroup: string | null | undefined;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading={`${INSPECTION_TYPE_LABEL[summary.type]}${summary.isSpotCheck ? ' (đột xuất)' : ''} — ${summary.shiftName} ${fDate(summary.date)}`}
        links={[
          { name: 'Kiểm tra ca', href: paths.dashboard.inspection.root },
          { name: `${summary.startTime}–${summary.endTime}` },
        ]}
        sx={{ mb: 3 }}
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Stack spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusChip status={summary.status} />
              <Typography variant="body2" color="text.secondary">
                Người kiểm: {summary.inspectorName}
                {summary.submittedAt ? ` · nộp ${fDateTime(summary.submittedAt)}` : ''}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color={zoneOwners.shiftLeadId ? 'primary' : 'warning'}
                label={`Trưởng ca: ${zoneOwners.shiftLeadId ? names[zoneOwners.shiftLeadId] ?? '—' : 'chưa đặt'}`}
              />
              {(['A', 'B', 'C', 'D'] as const).map((z) => {
                const owner = zoneOwners.zones[z];
                return owner ? <Chip key={z} size="small" variant="outlined" label={`Khu ${z}: ${names[owner] ?? 'ca phụ'}`} /> : null;
              })}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color="success" variant="outlined" label={`${counts.pass} đạt`} />
            <Chip size="small" color="error" variant="outlined" label={`${counts.fail} không đạt`} />
            <Chip size="small" variant="outlined" label={`${counts.na} NA`} />
            {!isSubmitted && <Chip size="small" color="warning" label={`Còn ${remaining}`} />}
          </Stack>
        </Stack>
      </Card>

      {canEdit && (
        <Box sx={{ mb: 2 }}>
          <InspectionPhotoRules />
        </Box>
      )}

      <Card>
        {rows.map((row) => {
          const entry = entries[row.key];
          const saved = resultByKey[row.key];
          const showGroup = row.item.groupName !== lastGroup;
          lastGroup = row.item.groupName;
          const firstOfItem = !row.item.perStaff || (row.index === 0 && row.staffId === zoneOwners.staff[0]?.staffId);
          return (
            <Box key={row.key}>
              {showGroup && row.item.groupName && (
                <Typography variant="overline" sx={{ display: 'block', px: 2, pt: 2, color: 'text.secondary' }}>
                  {row.item.groupName}
                </Typography>
              )}
              <Stack spacing={1} sx={{ px: 2, py: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <LevelChip level={row.item.level} />
                      <Typography variant="subtitle2">
                        {row.item.code} · {row.item.title}
                      </Typography>
                      {firstOfItem && !row.item.perStaff && <ZoneChips zones={row.item.zones} />}
                    </Stack>
                    {firstOfItem && (
                      <Typography variant="body2" color="text.secondary">
                        Đạt khi: {row.item.passCriteria}
                      </Typography>
                    )}
                    {firstOfItem && row.item.staffDoes && (
                      <ShiftWorkDoneInfo completion={completionByItem[row.item.id]} showPending={!isSubmitted} />
                    )}
                    {row.item.perStaff && (
                      <Typography variant="body2">
                        {row.staffName}
                        {row.item.observationsPerStaff > 1 ? ` — lượt khách ${row.index + 1}` : ''}
                      </Typography>
                    )}
                  </Stack>
                  <OutcomeButtons
                    value={entry?.outcome ?? null}
                    disabled={!canEdit || saving}
                    onChange={(outcome) => update(row.key, { outcome })}
                  />
                </Stack>

                {entry?.outcome === 'Fail' && (
                  <Stack spacing={1} sx={{ pl: { sm: 5 } }}>
                    <TextField
                      size="small"
                      label="Ghi chú lỗi"
                      value={entry.note}
                      disabled={!canEdit || saving}
                      onChange={(e) => update(row.key, { note: e.target.value })}
                      fullWidth
                    />
                    {(row.item.requiresPhotoOnFail || (saved?.photos.length ?? 0) > 0) && (
                      <PhotoPicker
                        photos={saved?.photos ?? []}
                        files={entry.files}
                        disabled={!canEdit || saving}
                        onAdd={(files) => update(row.key, { files: [...entry.files, ...files] })}
                        onRemove={(i) => update(row.key, { files: entry.files.filter((_, idx) => idx !== i) })}
                      />
                    )}
                    {saved?.outcome === 'Fail' && (
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {saved.responsibleStaffId ? (
                          <Chip size="small" label={`Phụ trách: ${names[saved.responsibleStaffId] ?? 'ca phụ'}`} />
                        ) : (
                          <Chip size="small" color="warning" label="Chưa xác định người phụ trách" />
                        )}
                        {saved.zoneUnassigned && saved.responsibleStaffId && (
                          <Chip size="small" color="warning" variant="outlined" label="Khu chưa phân — giao trưởng ca" />
                        )}
                        {saved.fixDeadlineAt && !saved.fixedAt && (
                          <Chip
                            size="small"
                            color={saved.isOverdue ? 'error' : 'default'}
                            label={`${saved.isOverdue ? 'Quá hạn' : 'Hạn sửa'} ${fDateTime(saved.fixDeadlineAt, 'HH:mm dd/MM')}`}
                          />
                        )}
                        {saved.fixedAt && (
                          <Chip
                            size="small"
                            color="success"
                            label={`Đã sửa ${fDateTime(saved.fixedAt, 'HH:mm dd/MM')}${saved.isOverdue ? ' (trễ hạn)' : ''}`}
                          />
                        )}
                      </Stack>
                    )}
                  </Stack>
                )}
              </Stack>
              <Divider />
            </Box>
          );
        })}
      </Card>

      {canEdit && (
        <Card sx={{ p: 2, mt: 2, mb: 4 }}>
          <Stack spacing={2}>
            {!isSubmitted && (
              <TextField label="Ghi chú lượt kiểm" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
            )}
            {!isSubmitted && (remaining > 0 || missingPhotos > 0) && (
              <Alert severity="warning">
                {remaining > 0 ? `Còn ${remaining} dòng chưa chấm. ` : ''}
                {missingPhotos > 0 ? `${missingPhotos} lỗi cần ảnh.` : ''}
              </Alert>
            )}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <LoadingButton variant="outlined" loading={saving} disabled={dirtyKeys.length === 0} onClick={save}>
                Lưu
              </LoadingButton>
              {!isSubmitted && (
                <LoadingButton variant="contained" loading={saving} disabled={remaining > 0 || missingPhotos > 0} onClick={submit}>
                  Nộp
                </LoadingButton>
              )}
            </Stack>
          </Stack>
        </Card>
      )}
      {confirmDialog}
    </Container>
  );
}
