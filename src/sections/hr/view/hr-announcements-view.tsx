'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

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
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
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
import Autocomplete from '@mui/material/Autocomplete';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { getStorageUrl } from 'src/utils/storage';
import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';

import {
  getAnnouncements,
  saveAnnouncement,
  deleteAnnouncement,
  getAnnouncementStaff,
  uploadAnnouncementImage,
  getAnnouncementReceipts,
} from 'src/api/announcements';
import {
  type IAnnouncement,
  type ISaveAnnouncement,
  type IAnnouncementStaff,
  type AnnouncementAudience,
  type AnnouncementSeverity,
  ANNOUNCEMENT_ROLE_LABEL,
  type IAnnouncementReceipts,
  ANNOUNCEMENT_AUDIENCE_LABEL,
  ANNOUNCEMENT_SEVERITY_LABEL,
} from 'src/types/announcement';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  severityMeta,
  isInternalPath,
  AnnouncementBody,
  AnnouncementImage,
  announcementImageError,
  ANNOUNCEMENT_IMAGE_ACCEPT,
} from 'src/components/announcement';

// ----------------------------------------------------------------------
// Popup thông báo (hr.announcement.manage — mặc định Admin): tạo, sửa, xoá mềm, xem ai đã đọc / đã xác nhận.
// ----------------------------------------------------------------------

const SEVERITIES: AnnouncementSeverity[] = ['Info', 'Warn', 'Critical'];
const AUDIENCES: AnnouncementAudience[] = ['All', 'Role', 'Users'];
const ROLES = Object.keys(ANNOUNCEMENT_ROLE_LABEL);
const MAX_TITLE = 120;
const MAX_BODY = 5000;

const emptyForm = (): ISaveAnnouncement => ({
  title: '',
  bodyMarkdown: '',
  severity: 'Info',
  audience: 'All',
  roles: [],
  userIds: [],
  requireAck: false,
  startAt: null,
  endAt: null,
  ctaLabel: null,
  ctaUrl: null,
  imageKey: null,
});

/** ISO → giá trị ô datetime-local theo giờ của máy. */
const toLocalInput = (iso: string | null) => (iso ? fDateTime(iso, "yyyy-MM-dd'T'HH:mm") : '');
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function statusOf(a: IAnnouncement): { label: string; color: 'success' | 'info' | 'default' } {
  if (a.isActive) return { label: 'Đang hiện', color: 'success' };
  return new Date(a.startAt) > new Date() ? { label: 'Hẹn giờ', color: 'info' } : { label: 'Đã hết hạn', color: 'default' };
}

function audienceText(a: IAnnouncement): string {
  if (a.audience === 'Role') return a.roles.map((r) => ANNOUNCEMENT_ROLE_LABEL[r] ?? r).join(', ');
  return ANNOUNCEMENT_AUDIENCE_LABEL[a.audience];
}

function savedMessage(pushed: boolean, devices: number, isNew: boolean): string {
  if (!isNew) return 'Đã lưu thông báo';
  return pushed
    ? `Đã tạo thông báo, đã gửi push tới ${devices} thiết bị đã đăng ký`
    : 'Đã hẹn giờ thông báo. Không có push khi tới giờ, nhân viên thấy popup khi mở app hoặc chuyển trang';
}

// ── Thêm / sửa ──────────────────────────────────────────────────────────

function AnnouncementFormDialog({
  announcement,
  open,
  staff,
  onClose,
  onSaved,
}: {
  announcement: IAnnouncement | null;
  open: boolean;
  staff: IAnnouncementStaff[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<ISaveAnnouncement>(emptyForm());
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  // Ảnh đang chọn: link đã ký của ảnh hiện có, hoặc blob của ảnh vừa chọn.
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadTurn = useRef(0);

  useEffect(() => {
    if (!open) return;
    setTab('edit');
    uploadTurn.current += 1;
    setUploading(false);
    setImageSrc(announcement?.imageUrl ? getStorageUrl(announcement.imageUrl) : null);
    if (announcement) {
      setForm({
        title: announcement.title,
        bodyMarkdown: announcement.bodyMarkdown,
        severity: announcement.severity,
        audience: announcement.audience,
        roles: announcement.roles,
        // Người đã nghỉ không còn trong danh sách chọn: bỏ khỏi form để lưu lại không bị từ chối.
        userIds: announcement.userIds.filter((id) => staff.some((s) => s.userId === id)),
        requireAck: announcement.requireAck,
        startAt: announcement.startAt,
        endAt: announcement.endAt,
        ctaLabel: announcement.ctaLabel,
        ctaUrl: announcement.ctaUrl,
        // Chưa đổi ảnh thì gửi null: máy chủ giữ nguyên.
        imageKey: null,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, announcement, staff]);

  // Blob của ảnh vừa chọn: giải phóng khi đổi ảnh hoặc đóng hộp thoại.
  useEffect(
    () => () => {
      if (imageSrc?.startsWith('blob:')) URL.revokeObjectURL(imageSrc);
    },
    [imageSrc]
  );

  const set = <K extends keyof ISaveAnnouncement>(key: K, value: ISaveAnnouncement[K]) => setForm((f) => ({ ...f, [key]: value }));

  const pickImage = async (file: File) => {
    const problem = announcementImageError(file);
    if (problem) {
      enqueueSnackbar(problem, { variant: 'error' });
      return;
    }
    uploadTurn.current += 1;
    const turn = uploadTurn.current;
    const previous = imageSrc;
    setImageSrc(URL.createObjectURL(file));
    setUploading(true);
    try {
      const key = await uploadAnnouncementImage(file);
      if (turn === uploadTurn.current) set('imageKey', key);
    } catch (err) {
      if (turn !== uploadTurn.current) return;
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được ảnh lên'), { variant: 'error' });
      // Quay lại ảnh trước đó. Nếu đó là ảnh vừa chọn (blob đã giải phóng) thì quay về ảnh đang lưu trên máy chủ.
      if (previous?.startsWith('blob:')) {
        setImageSrc(announcement?.imageUrl ? getStorageUrl(announcement.imageUrl) : null);
        set('imageKey', null);
      } else {
        setImageSrc(previous);
      }
    } finally {
      if (turn === uploadTurn.current) setUploading(false);
    }
  };

  const removeImage = () => {
    uploadTurn.current += 1;
    setUploading(false);
    setImageSrc(null);
    set('imageKey', announcement?.imageKey ? '' : null);
  };

  const ctaUrl = form.ctaUrl?.trim() ?? '';
  const ctaLabel = form.ctaLabel?.trim() ?? '';
  const ctaUrlError = !!ctaUrl && !isInternalPath(ctaUrl);
  const ctaIncomplete = !!ctaUrl !== !!ctaLabel;
  const periodError = !!form.endAt && !!form.startAt && new Date(form.endAt) <= new Date(form.startAt);
  const audienceValid =
    form.audience === 'All' || (form.audience === 'Role' ? form.roles.length > 0 : form.userIds.length > 0);
  const valid =
    !!form.title.trim() && !!form.bodyMarkdown.trim() && audienceValid && !ctaUrlError && !ctaIncomplete && !periodError && !uploading;

  const selectedStaff = useMemo(() => staff.filter((s) => form.userIds.includes(s.userId)), [staff, form.userIds]);

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await saveAnnouncement(announcement?.id ?? null, {
        ...form,
        title: form.title.trim(),
        bodyMarkdown: form.bodyMarkdown.trim(),
        roles: form.audience === 'Role' ? form.roles : [],
        userIds: form.audience === 'Users' ? form.userIds : [],
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
      });
      enqueueSnackbar(savedMessage(saved.pushed, saved.devices, !announcement), { variant: 'success' });
      onSaved();
      onClose();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được thông báo'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle>{announcement ? 'Sửa thông báo' : 'Tạo thông báo'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {announcement && (
            <Alert severity="info">Sửa không gửi lại push. Người đã đọc không thấy lại popup, kể cả khi đổi nội dung.</Alert>
          )}

          <TextField
            label="Tiêu đề"
            value={form.title}
            inputProps={{ maxLength: MAX_TITLE }}
            onChange={(e) => set('title', e.target.value)}
          />

          <Stack spacing={1}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab value="edit" label="Nội dung" />
              <Tab value="preview" label="Xem trước" />
            </Tabs>
            {tab === 'edit' ? (
              <TextField
                multiline
                minRows={6}
                maxRows={14}
                value={form.bodyMarkdown}
                inputProps={{ maxLength: MAX_BODY, 'aria-label': 'Nội dung' }}
                onChange={(e) => set('bodyMarkdown', e.target.value)}
                helperText="Dùng Markdown: **đậm**, *nghiêng*, - danh sách. HTML không hiển thị. Chỉ link nội bộ (bắt đầu bằng /) bấm được; link ngoài hiện như chữ thường. Ảnh trong Markdown không hiện, dùng ô Ảnh đính kèm bên dưới."
              />
            ) : (
              <Card variant="outlined" sx={{ p: 2, minHeight: 140 }}>
                {form.bodyMarkdown.trim() ? (
                  <AnnouncementBody body={form.bodyMarkdown} />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Chưa có nội dung.
                  </Typography>
                )}
                {imageSrc && <AnnouncementImage src={imageSrc} alt={`Ảnh đính kèm: ${form.title.trim()}`} />}
              </Card>
            )}
          </Stack>

          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button component="label" variant="outlined" color="inherit" disabled={saving} startIcon={<Iconify icon="solar:gallery-add-bold" />}>
                {imageSrc ? 'Đổi ảnh' : 'Ảnh đính kèm'}
                <input
                  hidden
                  type="file"
                  aria-label="Ảnh đính kèm"
                  accept={ANNOUNCEMENT_IMAGE_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) pickImage(file);
                  }}
                />
              </Button>
              {imageSrc && (
                <Button color="error" disabled={saving} onClick={removeImage}>
                  Gỡ ảnh
                </Button>
              )}
              {uploading && (
                <Typography variant="caption" color="text.secondary">
                  Đang tải ảnh lên...
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Không bắt buộc. JPEG, PNG hoặc WebP, tối đa 5 MB. Ảnh dài vẫn đọc được vì popup cuộn cùng nội dung. Nội dung chữ vẫn phải có: push và app bản cũ chỉ đọc được phần chữ.
            </Typography>
            {imageSrc && (
              <Box
                component="img"
                src={imageSrc}
                alt="Ảnh đã chọn"
                sx={{ maxHeight: 220, maxWidth: 1, width: 'fit-content', objectFit: 'contain', borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}
              />
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Mức độ"
              value={form.severity}
              onChange={(e) => set('severity', e.target.value as AnnouncementSeverity)}
            >
              {SEVERITIES.map((s) => (
                <MenuItem key={s} value={s}>
                  {ANNOUNCEMENT_SEVERITY_LABEL[s]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Người nhận"
              value={form.audience}
              onChange={(e) => set('audience', e.target.value as AnnouncementAudience)}
            >
              {AUDIENCES.map((a) => (
                <MenuItem key={a} value={a}>
                  {ANNOUNCEMENT_AUDIENCE_LABEL[a]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {form.audience === 'Role' && (
            <Stack direction="row" flexWrap="wrap">
              {ROLES.map((role) => (
                <FormControlLabel
                  key={role}
                  label={ANNOUNCEMENT_ROLE_LABEL[role]}
                  control={
                    <Checkbox
                      checked={form.roles.includes(role)}
                      onChange={(e) =>
                        set('roles', e.target.checked ? [...form.roles, role] : form.roles.filter((r) => r !== role))
                      }
                    />
                  }
                />
              ))}
            </Stack>
          )}

          {form.audience === 'Users' && (
            <Autocomplete
              multiple
              options={staff}
              value={selectedStaff}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.userId === b.userId}
              onChange={(_, list) => set('userIds', list.map((s) => s.userId))}
              renderInput={(params) => <TextField {...params} label="Chọn nhân viên" />}
            />
          )}

          <FormControlLabel
            label="Bắt buộc xác nhận: chỉ đóng được bằng nút Đã hiểu, chưa bấm thì còn hiện lại"
            control={<Switch checked={form.requireAck} onChange={(e) => set('requireAck', e.target.checked)} />}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              type="datetime-local"
              label="Bắt đầu hiện"
              value={toLocalInput(form.startAt)}
              onChange={(e) => set('startAt', fromLocalInput(e.target.value))}
              InputLabelProps={{ shrink: true }}
              helperText={announcement ? undefined : 'Để trống = hiện và gửi push ngay. Hẹn giờ thì không có push.'}
            />
            <TextField
              fullWidth
              type="datetime-local"
              label="Kết thúc"
              value={toLocalInput(form.endAt)}
              onChange={(e) => set('endAt', fromLocalInput(e.target.value))}
              InputLabelProps={{ shrink: true }}
              error={periodError}
              helperText={periodError ? 'Phải sau thời gian bắt đầu.' : 'Để trống = không hết hạn.'}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Chữ trên nút (không bắt buộc)"
              value={form.ctaLabel ?? ''}
              inputProps={{ maxLength: 40 }}
              onChange={(e) => set('ctaLabel', e.target.value)}
              error={ctaIncomplete && !ctaLabel}
              helperText={ctaIncomplete && !ctaLabel ? 'Nhập chữ trên nút.' : undefined}
            />
            <TextField
              fullWidth
              label="Đường dẫn của nút"
              placeholder="/dashboard/hr/policies"
              value={form.ctaUrl ?? ''}
              inputProps={{ maxLength: 300 }}
              onChange={(e) => set('ctaUrl', e.target.value)}
              error={ctaUrlError || (ctaIncomplete && !ctaUrl)}
              helperText={
                ctaUrlError ? 'Chỉ nhận đường dẫn nội bộ bắt đầu bằng /, không nhận link ngoài.' : 'Đường dẫn nội bộ, bắt đầu bằng /.'
              }
            />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={saving} onClick={onClose}>
          Huỷ
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!valid} onClick={submit}>
          {announcement ? 'Lưu' : 'Tạo thông báo'}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

// ── Ai đã đọc ───────────────────────────────────────────────────────────

type ReceiptFilter = 'all' | 'unseen' | 'unacked';

function ReceiptsDialog({ announcement, onClose }: { announcement: IAnnouncement | null; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState<IAnnouncementReceipts | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>('all');
  const id = announcement?.id;

  useEffect(() => {
    setData(null);
    setFilter('all');
    if (!id) return;
    getAnnouncementReceipts(id)
      .then(setData)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách'), { variant: 'error' }));
  }, [id, enqueueSnackbar]);

  const people = useMemo(() => {
    const all = data?.people ?? [];
    if (filter === 'unseen') return all.filter((p) => !p.seenAt);
    if (filter === 'unacked') return all.filter((p) => !p.ackAt);
    return all;
  }, [data, filter]);

  return (
    <Dialog open={!!announcement} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ wordBreak: 'break-word' }}>{announcement?.title}</DialogTitle>
      <DialogContent>
        {data && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`${data.recipients} người nhận`} />
              <Chip size="small" color="info" variant="soft" label={`${data.seenCount} đã đọc`} />
              <Chip size="small" color="success" variant="soft" label={`${data.ackCount} đã xác nhận`} />
            </Stack>
            <TextField select size="small" label="Lọc" value={filter} onChange={(e) => setFilter(e.target.value as ReceiptFilter)}>
              <MenuItem value="all">Tất cả</MenuItem>
              <MenuItem value="unseen">Chưa đọc</MenuItem>
              <MenuItem value="unacked">Chưa xác nhận</MenuItem>
            </TextField>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nhân viên</TableCell>
                    <TableCell>Đã đọc</TableCell>
                    <TableCell>Đã xác nhận</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {people.map((p) => (
                    <TableRow key={p.userId}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.seenAt ? fDateTime(p.seenAt, 'dd/MM HH:mm') : '—'}</TableCell>
                      <TableCell>{p.ackAt ? fDateTime(p.ackAt, 'dd/MM HH:mm') : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {people.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ color: 'text.secondary' }}>
                        Không có ai trong danh sách này.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Trang ───────────────────────────────────────────────────────────────

export default function HrAnnouncementsView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [askConfirm, confirmDialog] = useConfirmDialog();
  const [list, setList] = useState<IAnnouncement[]>([]);
  const [staff, setStaff] = useState<IAnnouncementStaff[]>([]);
  const [editing, setEditing] = useState<IAnnouncement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [receiptsOf, setReceiptsOf] = useState<IAnnouncement | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await getAnnouncements());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được thông báo'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
    getAnnouncementStaff()
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [load]);

  const remove = async (a: IAnnouncement) => {
    const ok = await askConfirm({
      title: `Xoá thông báo "${a.title}"?`,
      content: 'Nhân viên sẽ không thấy popup này nữa. Danh sách ai đã đọc vẫn được giữ trong hệ thống.',
      confirmText: 'Xoá',
      cancelText: 'Huỷ',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAnnouncement(a.id);
      enqueueSnackbar('Đã xoá thông báo', { variant: 'success' });
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xoá được thông báo'), { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Popup thông báo"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Nhân sự' }, { name: 'Popup thông báo' }]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Tạo thông báo
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell>Thông báo</TableCell>
                <TableCell>Người nhận</TableCell>
                <TableCell>Thời gian</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Đã đọc</TableCell>
                <TableCell align="right">Đã xác nhận</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((a) => {
                const status = statusOf(a);
                return (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>
                        {a.title}
                      </Typography>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                        <Chip size="small" variant="soft" color={severityMeta(a.severity).color} label={ANNOUNCEMENT_SEVERITY_LABEL[a.severity]} />
                        {a.requireAck && <Chip size="small" variant="outlined" label="Bắt buộc xác nhận" />}
                        {a.imageKey && <Chip size="small" variant="outlined" label="Có ảnh" />}
                      </Stack>
                      {a.createdByName && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {a.createdByName}, {fDate(a.createdAt, 'dd/MM/yyyy')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {audienceText(a)}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {a.recipients} người
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {fDateTime(a.startAt, 'dd/MM HH:mm')}
                      <Typography variant="caption" color="text.secondary" display="block">
                        {a.endAt ? `đến ${fDateTime(a.endAt, 'dd/MM HH:mm')}` : 'không hết hạn'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={status.color} variant="soft" label={status.label} />
                    </TableCell>
                    <TableCell align="right">{a.seenCount}</TableCell>
                    <TableCell align="right">{a.requireAck ? a.ackCount : '—'}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Ai đã đọc">
                        <IconButton aria-label="Ai đã đọc" onClick={() => setReceiptsOf(a)}>
                          <Iconify icon="solar:users-group-rounded-bold" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sửa">
                        <IconButton
                          aria-label="Sửa"
                          onClick={() => {
                            setEditing(a);
                            setFormOpen(true);
                          }}
                        >
                          <Iconify icon="solar:pen-bold" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá">
                        <IconButton aria-label="Xoá" color="error" onClick={() => remove(a)}>
                          <Iconify icon="solar:trash-bin-trash-bold" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Chưa có thông báo nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <AnnouncementFormDialog
        open={formOpen}
        announcement={editing}
        staff={staff}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
      <ReceiptsDialog announcement={receiptsOf} onClose={() => setReceiptsOf(null)} />
      {confirmDialog}
    </Container>
  );
}
