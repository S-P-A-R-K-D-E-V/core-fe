'use client';

import type { AgentMode, QuickReply, QuickReplyInput, ConversationSettings } from 'src/lib/inbox';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import MenuItem from '@mui/material/MenuItem';
import TableHead from '@mui/material/TableHead';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { apiErrorMessage } from 'src/utils/api-error';

import { AGENT_MODE_LABEL } from 'src/lib/inbox';
import {
  createQuickReply,
  deleteQuickReply,
  updateQuickReply,
  useQuickReplies,
  useConversationSettings,
  saveConversationSettings,
} from 'src/api/inbox';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import InboxQuickReplyDialog from '../inbox-quick-reply-dialog';
import { useInboxPermissions } from '../hooks/use-inbox-permissions';

// ----------------------------------------------------------------------
// Mẫu trả lời nhanh + cấu hình hộp thư. Xem với conversation.read; thêm / sửa / xoá và lưu cấu hình cần conversation.manage.
// ----------------------------------------------------------------------

export function InboxSettingsView() {
  const settings = useSettingsContext();
  const { manage } = useInboxPermissions();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'} sx={{ pb: 3 }}>
      <CustomBreadcrumbs
        heading="Mẫu trả lời & hộp thư"
        links={[
          { name: 'Hộp thư khách', href: paths.dashboard.inbox.root },
          { name: 'Mẫu trả lời & cấu hình' },
        ]}
        sx={{ mb: { xs: 2, md: 3 } }}
      />

      {!manage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Bạn chỉ xem được. Sửa mẫu và cấu hình cần quyền “Quản lý hộp thư” (conversation.manage).
        </Alert>
      )}

      <Stack spacing={3}>
        <QuickRepliesCard canEdit={manage} />
        <SettingsCard canEdit={manage} />
      </Stack>
    </Container>
  );
}

// ----------------------------------------------------------------------

function QuickRepliesCard({ canEdit }: { canEdit: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const { replies, loading, error, refresh } = useQuickReplies();
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const sorted = [...replies].sort((a, b) => a.sortOrder - b.sortOrder || a.shortcut.localeCompare(b.shortcut));
  const nextSortOrder = sorted.length ? sorted[sorted.length - 1].sortOrder + 10 : 10;

  const open = (reply: QuickReply | null) => {
    setEditing(reply);
    setDialogOpen(true);
  };

  const handleSave = async (input: QuickReplyInput) => {
    if (editing) await updateQuickReply(editing.id, input);
    else await createQuickReply(input);
    enqueueSnackbar(editing ? 'Đã lưu mẫu' : 'Đã thêm mẫu');
    refresh();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteQuickReply(deleting.id);
      enqueueSnackbar('Đã xoá mẫu');
      setDeleting(null);
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xoá được mẫu'), { variant: 'error' });
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Mẫu trả lời nhanh"
        subheader='Trong ô trả lời, gõ "/" + phím tắt để chèn nội dung và ảnh kèm.'
        action={
          canEdit && (
            <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => open(null)}>
              Thêm mẫu
            </Button>
          )
        }
        sx={{ mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
          {apiErrorMessage(error, 'Không tải được mẫu trả lời')}
        </Alert>
      )}

      {loading ? (
        <Stack alignItems="center" sx={{ py: 5 }}>
          <CircularProgress size={24} />
        </Stack>
      ) : sorted.length === 0 ? (
        <EmptyContent
          title="Chưa có mẫu nào"
          description="Thêm các câu hay dùng: báo giá, phí ship, địa chỉ cửa hàng, cách đặt hàng…"
          sx={{ py: 5 }}
        />
      ) : (
        <TableContainer>
          <Scrollbar>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={140}>Phím tắt</TableCell>
                  <TableCell width={200}>Tiêu đề</TableCell>
                  <TableCell>Nội dung</TableCell>
                  <TableCell width={70} align="center">
                    Ảnh
                  </TableCell>
                  <TableCell width={70} align="right">
                    Thứ tự
                  </TableCell>
                  {canEdit && <TableCell width={96} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                        /{r.shortcut}
                      </Typography>
                    </TableCell>
                    <TableCell>{r.title}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {r.text}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.imageUrls.length > 0 ? (
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                          <Box
                            component="img"
                            src={r.imageUrls[0]}
                            alt=""
                            sx={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 0.5 }}
                          />
                          {r.imageUrls.length > 1 && (
                            <Typography variant="caption">+{r.imageUrls.length - 1}</Typography>
                          )}
                        </Stack>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">{r.sortOrder}</TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Tooltip title="Sửa">
                          <IconButton size="small" onClick={() => open(r)}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xoá">
                          <IconButton size="small" color="error" onClick={() => setDeleting(r)}>
                            <Iconify icon="solar:trash-bin-trash-bold" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Scrollbar>
        </TableContainer>
      )}

      <InboxQuickReplyDialog
        open={dialogOpen}
        reply={editing}
        nextSortOrder={nextSortOrder}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Xoá mẫu trả lời?"
        content={deleting ? `Xoá mẫu /${deleting.shortcut} — ${deleting.title}.` : ''}
        cancelText="Huỷ"
        action={
          <LoadingButton variant="contained" color="error" loading={deletingBusy} onClick={handleDelete}>
            Xoá
          </LoadingButton>
        }
      />
    </Card>
  );
}

// ----------------------------------------------------------------------

type SettingsForm = {
  agentMode: AgentMode;
  assistantName: string;
  openFrom: string;
  openTo: string;
  offHoursMessage: string;
  autoReturnMinutes: string;
  hidePhoneComments: boolean;
  approvalEscalateMinutes: string;
};

function toForm(s: ConversationSettings): SettingsForm {
  return {
    agentMode: s.agentMode,
    assistantName: s.assistantName ?? '',
    openFrom: s.openHours?.from ?? '08:00',
    openTo: s.openHours?.to ?? '22:00',
    offHoursMessage: s.offHoursMessage ?? '',
    autoReturnMinutes: s.autoReturnMinutes === null || s.autoReturnMinutes === undefined ? '' : String(s.autoReturnMinutes),
    hidePhoneComments: !!s.hidePhoneComments,
    approvalEscalateMinutes: String(s.approvalEscalateMinutes ?? 10),
  };
}

function fromForm(f: SettingsForm): ConversationSettings {
  const autoReturn = Number.parseInt(f.autoReturnMinutes, 10);
  return {
    agentMode: f.agentMode,
    assistantName: f.assistantName.trim(),
    openHours: { from: f.openFrom, to: f.openTo },
    offHoursMessage: f.offHoursMessage.trim() || null,
    autoReturnMinutes: Number.isFinite(autoReturn) && autoReturn > 0 ? autoReturn : null,
    hidePhoneComments: f.hidePhoneComments,
    approvalEscalateMinutes: Math.max(1, Number.parseInt(f.approvalEscalateMinutes, 10) || 10),
  };
}

function SettingsCard({ canEdit }: { canEdit: boolean }) {
  const { enqueueSnackbar } = useSnackbar();
  const { settings, loading, error, refresh } = useConversationSettings();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm(toForm(settings));
  }, [settings]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const dirty = !!form && !!settings && JSON.stringify(fromForm(form)) !== JSON.stringify(fromForm(toForm(settings)));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await saveConversationSettings(fromForm(form));
      enqueueSnackbar('Đã lưu cấu hình hộp thư');
      refresh();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được cấu hình'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Cấu hình hộp thư" subheader="Giờ trả lời, tin ngoài giờ, agent CSKH." sx={{ mb: 2 }} />

      {error && (
        <Alert severity="error" sx={{ mx: 3, mb: 2 }}>
          {apiErrorMessage(error, 'Không tải được cấu hình')}
        </Alert>
      )}

      {loading || !form ? (
        !error && (
          <Stack alignItems="center" sx={{ py: 5 }}>
            <CircularProgress size={24} />
          </Stack>
        )
      ) : (
        <Stack spacing={2.5} sx={{ px: 3, pb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              select
              label="Agent CSKH"
              value={form.agentMode}
              disabled={!canEdit}
              onChange={(e) => set('agentMode', e.target.value as AgentMode)}
              helperText="Gợi ý / Tự động có tác dụng khi bật agent CSKH (bước sau)."
              sx={{ flex: 1 }}
            >
              {(Object.keys(AGENT_MODE_LABEL) as AgentMode[]).map((m) => (
                <MenuItem key={m} value={m}>
                  {AGENT_MODE_LABEL[m]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Tên trợ lý (khách thấy)"
              value={form.assistantName}
              disabled={!canEdit}
              onChange={(e) => set('assistantName', e.target.value)}
              placeholder="vd: CiCi"
              sx={{ flex: 1 }}
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Giờ có người trả lời
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                type="time"
                label="Từ"
                value={form.openFrom}
                disabled={!canEdit}
                onChange={(e) => set('openFrom', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
              <TextField
                type="time"
                label="Đến"
                value={form.openTo}
                disabled={!canEdit}
                onChange={(e) => set('openTo', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
            </Stack>
          </Box>

          <TextField
            label="Tin nhắn ngoài giờ"
            value={form.offHoursMessage}
            disabled={!canEdit}
            onChange={(e) => set('offHoursMessage', e.target.value)}
            multiline
            minRows={2}
            maxRows={6}
            placeholder="vd: Shop đã nghỉ, sáng mai 8h nhân viên trả lời bạn nhé!"
            helperText="Chưa tự gửi ở bước này — lưu sẵn để dùng khi bật trả lời tự động."
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              type="number"
              label="Tự trả về agent sau (phút)"
              value={form.autoReturnMinutes}
              disabled={!canEdit}
              onChange={(e) => set('autoReturnMinutes', e.target.value)}
              helperText="Để trống = tắt. Nhân viên im lặng quá số phút này thì agent trả lời tiếp."
              inputProps={{ min: 1 }}
              sx={{ flex: 1 }}
            />
            <TextField
              type="number"
              label="Báo quản lý khi chờ duyệt quá (phút)"
              value={form.approvalEscalateMinutes}
              disabled={!canEdit}
              onChange={(e) => set('approvalEscalateMinutes', e.target.value)}
              inputProps={{ min: 1 }}
              sx={{ flex: 1 }}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                checked={form.hidePhoneComments}
                disabled={!canEdit}
                onChange={(_, v) => set('hidePhoneComments', v)}
              />
            }
            label={
              <Box>
                <Typography variant="body2">Ẩn bình luận có số điện thoại</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Bảo vệ khách, tránh lọt khách cho đối thủ (áp dụng khi nối bình luận fanpage).
                </Typography>
              </Box>
            }
          />

          {canEdit && (
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              {dirty && settings && (
                <Button color="inherit" onClick={() => setForm(toForm(settings))} disabled={saving}>
                  Huỷ thay đổi
                </Button>
              )}
              <LoadingButton variant="contained" loading={saving} disabled={!dirty} onClick={handleSave}>
                Lưu cấu hình
              </LoadingButton>
            </Stack>
          )}
        </Stack>
      )}
    </Card>
  );
}
