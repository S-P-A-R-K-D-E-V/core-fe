'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Draggable, Droppable, DragDropContext, type DropResult } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { getCorrectiveActions, createCorrectiveAction, updateCorrectiveAction } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { ICorrectiveAction, CorrectiveActionStatus } from 'src/types/inspection';
import { CORRECTIVE_ACTION_STATUS_LABEL } from 'src/types/inspection';

// ----------------------------------------------------------------------
// Việc sửa tận gốc lỗi lặp (thiếu chỗ, thiếu dụng cụ, thiếu người) — Bảng kiểm, mục 5. Cuối tuần hệ thống gợi ý cho 3 mục
// có nhiều lỗi nhất; quản lý kéo sang "Đang làm", giao người, đặt hạn. Không gắn với người bị chấm lỗi.
// ----------------------------------------------------------------------

export const ACTION_COLUMNS: CorrectiveActionStatus[] = ['Suggested', 'Open', 'Done', 'Dismissed'];

type Draft = {
  id: string | null;
  title: string;
  itemCode: string;
  rootCause: string;
  action: string;
  ownerUserId: string;
  dueDate: string;
  status: CorrectiveActionStatus;
};

const emptyDraft: Draft = {
  id: null,
  title: '',
  itemCode: '',
  rootCause: '',
  action: '',
  ownerUserId: '',
  dueDate: '',
  status: 'Open',
};

export default function InspectionCorrectiveActionsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.inspection.correctiveActionManage);

  const [actions, setActions] = useState<ICorrectiveAction[]>([]);
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setActions(await getCorrectiveActions());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được việc sửa tận gốc'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
    getActiveStaffUsers()
      .then((users) => setStaff(users.map((u) => ({ id: u.id, name: u.fullName }))))
      .catch(() => setStaff([]));
  }, [load]);

  const staffName = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.name])), [staff]);

  const persist = async (input: Draft) => {
    const body = {
      title: input.title.trim(),
      itemCode: input.itemCode.trim() || null,
      rootCause: input.rootCause.trim() || null,
      action: input.action.trim() || null,
      ownerUserId: input.ownerUserId || null,
      dueDate: input.dueDate || null,
    };
    return input.id ? updateCorrectiveAction(input.id, { ...body, status: input.status }) : createCorrectiveAction(body);
  };

  const onDragEnd = async ({ draggableId, destination, source }: DropResult) => {
    if (!destination || destination.droppableId === source.droppableId) return;
    const action = actions.find((a) => a.id === draggableId);
    if (!action) return;
    const status = destination.droppableId as CorrectiveActionStatus;
    setActions((prev) => prev.map((a) => (a.id === draggableId ? { ...a, status } : a)));
    try {
      await updateCorrectiveAction(action.id, {
        title: action.title,
        rootCause: action.rootCause,
        action: action.action,
        ownerUserId: action.ownerUserId,
        dueDate: action.dueDate,
        status,
      });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đổi được trạng thái'), { variant: 'error' });
      load();
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await persist(draft);
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const edit = (a: ICorrectiveAction) =>
    setDraft({
      id: a.id,
      title: a.title,
      itemCode: a.itemCode ?? '',
      rootCause: a.rootCause ?? '',
      action: a.action ?? '',
      ownerUserId: a.ownerUserId ?? '',
      dueDate: a.dueDate ?? '',
      status: a.status,
    });

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Sửa tận gốc"
        links={[{ name: 'Kiểm tra cửa hàng', href: paths.dashboard.inspection.root }, { name: 'Sửa tận gốc' }]}
        action={
          canManage && (
            <Button variant="contained" onClick={() => setDraft({ ...emptyDraft })}>
              Thêm việc
            </Button>
          )
        }
        sx={{ mb: 2 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Lỗi lặp nhiều lần thường do thiếu chỗ hoặc thiếu dụng cụ, không phải do người. Chủ nhật hằng tuần hệ thống gợi ý 3 lỗi
        lặp nhiều nhất — kéo sang &quot;Đang làm&quot; để giao việc, hoặc &quot;Bỏ qua&quot;.
      </Typography>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
            {ACTION_COLUMNS.map((status) => {
              const items = actions.filter((a) => a.status === status);
              return (
                <Box key={status} sx={{ flex: 1, width: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{CORRECTIVE_ACTION_STATUS_LABEL[status]}</Typography>
                    <Chip size="small" label={items.length} />
                  </Stack>
                  <Droppable droppableId={status} isDropDisabled={!canManage}>
                    {(provided) => (
                      <Stack
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        spacing={1}
                        sx={{ minHeight: 80, p: 1, borderRadius: 1, bgcolor: 'background.neutral' }}
                      >
                        {items.map((a, index) => (
                          <Draggable key={a.id} draggableId={a.id} index={index} isDragDisabled={!canManage}>
                            {(drag) => (
                              <Card
                                ref={drag.innerRef}
                                {...drag.draggableProps}
                                {...drag.dragHandleProps}
                                onClick={() => canManage && edit(a)}
                                sx={{ p: 1.5, cursor: canManage ? 'pointer' : 'default' }}
                              >
                                <Typography variant="subtitle2">{a.title}</Typography>
                                {a.action && (
                                  <Typography variant="body2" color="text.secondary">
                                    {a.action}
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                                  {a.itemCode && <Chip size="small" variant="outlined" label={a.itemCode} />}
                                  {a.ownerUserId && <Chip size="small" label={staffName[a.ownerUserId] ?? 'Đã giao'} />}
                                  {a.dueDate && <Chip size="small" color="warning" variant="outlined" label={`Hạn ${fDate(a.dueDate)}`} />}
                                  {a.suggestedForWeek && (
                                    <Chip size="small" variant="outlined" label={`Tuần ${fDate(a.suggestedForWeek, 'dd/MM')}`} />
                                  )}
                                </Stack>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </Box>
              );
            })}
          </Stack>
        </DragDropContext>
      )}

      <Dialog open={!!draft} onClose={() => !saving && setDraft(null)} fullWidth maxWidth="sm">
        <DialogTitle>{draft?.id ? 'Sửa việc' : 'Thêm việc sửa tận gốc'}</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField label="Việc cần làm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              {!draft.id && (
                <TextField
                  label="Mã mục kiểm (nếu có)"
                  value={draft.itemCode}
                  onChange={(e) => setDraft({ ...draft, itemCode: e.target.value })}
                  helperText="Vd Q07 — mục bị lỗi lặp."
                />
              )}
              <TextField
                label="Nguyên nhân gốc"
                value={draft.rootCause}
                onChange={(e) => setDraft({ ...draft, rootCause: e.target.value })}
                multiline
                minRows={2}
              />
              <TextField
                label="Cách sửa"
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                multiline
                minRows={2}
              />
              <TextField
                select
                label="Người làm"
                value={draft.ownerUserId}
                onChange={(e) => setDraft({ ...draft, ownerUserId: e.target.value })}
              >
                <MenuItem value="">— Chưa giao —</MenuItem>
                {staff.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Hạn"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
              {draft.id && (
                <TextField
                  select
                  label="Trạng thái"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as CorrectiveActionStatus })}
                >
                  {ACTION_COLUMNS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {CORRECTIVE_ACTION_STATUS_LABEL[s]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={saving}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={saving} disabled={!draft?.title.trim()} onClick={save}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
