'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';
import Lightbox, { useLightBox } from 'src/components/lightbox';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';
import { TableHeadCustom, TableNoData } from 'src/components/table';

import { parseDateStr, toDateStr } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';

import type { ICleaningTaskInstance, IShiftStaffForPenalty } from 'src/types/corecms-api';

import {
  createCleaningPenalty,
  getCleaningChecklist,
  getShiftStaffForPenalty,
  reviewCleaningTask,
} from 'src/api/cleaning';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Đầu việc', width: 220 },
  { id: 'area', label: 'Khu vực', width: 160 },
  { id: 'completedBy', label: 'Người thực hiện', width: 160 },
  { id: 'photo', label: 'Ảnh minh chứng', width: 120 },
  { id: 'status', label: 'Trạng thái', width: 120 },
  { id: 'penalties', label: 'Phạt', width: 180 },
  { id: 'actions', label: 'Hành động', width: 180 },
];

const CLEANING_BLOCKS = [
  { value: 'Morning', label: 'Sáng' },
  { value: 'Afternoon', label: 'Chiều' },
  { value: 'Evening', label: 'Tối' },
];

const STATUS_LABEL: Record<string, { label: string; color: 'default' | 'info' | 'success' | 'error' }> = {
  Pending: { label: 'Chưa làm', color: 'default' },
  Done: { label: 'Chờ chấm', color: 'info' },
  Passed: { label: 'Đạt', color: 'success' },
  Failed: { label: 'Không đạt', color: 'error' },
};

const formatCurrency = (amount: number) =>
  amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

// ----------------------------------------------------------------------

function TaskPhotos({ objectKeys }: { objectKeys: string[] }) {
  const slides = objectKeys.map((key) => ({ src: getStorageUrl(key) }));
  const lightbox = useLightBox(slides);

  if (objectKeys.length === 0) return <>-</>;

  return (
    <>
      <Stack direction="row" spacing={0.5} flexWrap="wrap">
        {objectKeys.map((key) => (
          <Box
            key={key}
            component="img"
            src={getStorageUrl(key)}
            onClick={() => lightbox.onOpen(getStorageUrl(key))}
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              objectFit: 'cover',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: 'divider',
            }}
          />
        ))}
      </Stack>
      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />
    </>
  );
}

// ----------------------------------------------------------------------

export default function CleaningReviewView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(searchParams.get('date') || toDateStr(new Date()));
  const [block, setBlock] = useState(searchParams.get('block') || 'Morning');
  const [tasks, setTasks] = useState<ICleaningTaskInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const [failDialog, setFailDialog] = useState<{ open: boolean; task: ICleaningTaskInstance | null; note: string }>(
    { open: false, task: null, note: '' }
  );

  const [penaltyDialog, setPenaltyDialog] = useState<{
    open: boolean;
    task: ICleaningTaskInstance | null;
    staff: IShiftStaffForPenalty[];
    selectedUserIds: string[];
    amount: number;
    reason: string;
    loadingStaff: boolean;
  }>({ open: false, task: null, staff: [], selectedUserIds: [], amount: 0, reason: '', loadingStaff: false });

  const fetchChecklist = useCallback(async () => {
    if (!date || !block) return;
    try {
      setLoading(true);
      const data = await getCleaningChecklist(date, block);
      setTasks(data);
    } catch (error) {
      console.error('Error fetching cleaning checklist:', error);
      enqueueSnackbar('Không thể tải checklist', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [date, block, enqueueSnackbar]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handlePass = async (task: ICleaningTaskInstance) => {
    try {
      await reviewCleaningTask(task.id, { status: 'Passed' });
      enqueueSnackbar('Đã đánh giá Đạt');
      fetchChecklist();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleOpenFail = (task: ICleaningTaskInstance) => {
    setFailDialog({ open: true, task, note: '' });
  };

  const handleCloseFail = () => setFailDialog({ open: false, task: null, note: '' });

  const handleSubmitFail = async () => {
    if (!failDialog.task) return;
    try {
      await reviewCleaningTask(failDialog.task.id, {
        status: 'Failed',
        reviewNote: failDialog.note || undefined,
      });
      enqueueSnackbar('Đã đánh giá Không đạt');
      handleCloseFail();
      fetchChecklist();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleOpenPenalty = async (task: ICleaningTaskInstance) => {
    setPenaltyDialog({
      open: true,
      task,
      staff: [],
      selectedUserIds: [],
      amount: 0,
      reason: '',
      loadingStaff: true,
    });
    try {
      const staff = await getShiftStaffForPenalty(task.id);
      setPenaltyDialog((d) => ({ ...d, staff, loadingStaff: false }));
    } catch (error) {
      enqueueSnackbar('Không thể tải danh sách nhân viên trong ca', { variant: 'error' });
      setPenaltyDialog((d) => ({ ...d, loadingStaff: false }));
    }
  };

  const handleClosePenalty = () =>
    setPenaltyDialog({ open: false, task: null, staff: [], selectedUserIds: [], amount: 0, reason: '', loadingStaff: false });

  const toggleStaff = (userId: string) => {
    setPenaltyDialog((d) => ({
      ...d,
      selectedUserIds: d.selectedUserIds.includes(userId)
        ? d.selectedUserIds.filter((id) => id !== userId)
        : [...d.selectedUserIds, userId],
    }));
  };

  const handleSubmitPenalty = async () => {
    if (!penaltyDialog.task) return;
    if (penaltyDialog.selectedUserIds.length === 0) {
      enqueueSnackbar('Chọn ít nhất 1 nhân viên', { variant: 'error' });
      return;
    }
    if (penaltyDialog.amount <= 0) {
      enqueueSnackbar('Số tiền phạt phải lớn hơn 0', { variant: 'error' });
      return;
    }
    try {
      await Promise.all(
        penaltyDialog.selectedUserIds.map((userId) =>
          createCleaningPenalty(penaltyDialog.task!.id, {
            userId,
            amount: penaltyDialog.amount,
            reason: penaltyDialog.reason || undefined,
          })
        )
      );
      enqueueSnackbar('Đã áp phạt');
      handleClosePenalty();
      fetchChecklist();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Có lỗi xảy ra', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Đánh giá vệ sinh"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Đánh giá' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <DatePicker
            label="Ngày"
            value={parseDateStr(date)}
            onChange={(val) => setDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } } }}
          />
          <TextField
            select
            label="Ca"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            sx={{ width: { xs: 1, md: 200 } }}
          >
            {CLEANING_BLOCKS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size="medium">
                <TableHeadCustom headLabel={TABLE_HEAD} />
                <TableBody>
                  {tasks.map((task) => {
                    const activePenalties = task.penalties.filter((p) => !p.voidedAt);
                    const canReview = task.status === 'Done' || task.status === 'Pending';
                    return (
                      <TableRow key={task.id}>
                        <TableCell>{task.name}</TableCell>
                        <TableCell>{task.area || '-'}</TableCell>
                        <TableCell>{task.completedByUserName || '-'}</TableCell>
                        <TableCell>
                          <TaskPhotos objectKeys={task.photoObjectKeys} />
                        </TableCell>
                        <TableCell>
                          <Label color={STATUS_LABEL[task.status]?.color || 'default'}>
                            {STATUS_LABEL[task.status]?.label || task.status}
                          </Label>
                        </TableCell>
                        <TableCell>
                          {activePenalties.length === 0 ? (
                            '-'
                          ) : (
                            <Stack spacing={0.5}>
                              {activePenalties.map((p) => (
                                <Typography key={p.id} variant="caption">
                                  {p.userName}: {formatCurrency(p.amount)}
                                </Typography>
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            {canReview && (
                              <>
                                <Tooltip title="Đạt">
                                  <IconButton color="success" size="small" onClick={() => handlePass(task)}>
                                    <Iconify icon="eva:checkmark-circle-2-fill" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Không đạt">
                                  <IconButton color="error" size="small" onClick={() => handleOpenFail(task)}>
                                    <Iconify icon="eva:close-circle-fill" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {task.status === 'Failed' && (
                              <Button size="small" color="warning" onClick={() => handleOpenPenalty(task)}>
                                Phạt
                              </Button>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {tasks.length === 0 && <TableNoData notFound />}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>

      {/* Fail dialog */}
      <Dialog open={failDialog.open} onClose={handleCloseFail} maxWidth="sm" fullWidth>
        <DialogTitle>Đánh giá Không đạt</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Ghi chú (tuỳ chọn)"
            value={failDialog.note}
            onChange={(e) => setFailDialog((d) => ({ ...d, note: e.target.value }))}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFail}>Huỷ</Button>
          <Button variant="contained" color="error" onClick={handleSubmitFail}>
            Xác nhận Không đạt
          </Button>
        </DialogActions>
      </Dialog>

      {/* Penalty dialog */}
      <Dialog open={penaltyDialog.open} onClose={handleClosePenalty} maxWidth="sm" fullWidth>
        <DialogTitle>Phạt vệ sinh: {penaltyDialog.task?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Chọn nhân viên trong ca</Typography>
            {penaltyDialog.loadingStaff ? (
              <Stack alignItems="center" sx={{ py: 2 }}>
                <CircularProgress size={24} />
              </Stack>
            ) : penaltyDialog.staff.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có nhân viên nào được phân công trong ca này.
              </Typography>
            ) : (
              <Stack>
                {penaltyDialog.staff.map((s) => (
                  <FormControlLabel
                    key={s.userId}
                    control={
                      <Checkbox
                        checked={penaltyDialog.selectedUserIds.includes(s.userId)}
                        onChange={() => toggleStaff(s.userId)}
                      />
                    }
                    label={s.isPartialCover ? `${s.fullName} (làm hộ 1 phần ca)` : s.fullName}
                  />
                ))}
              </Stack>
            )}

            {penaltyDialog.selectedUserIds.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {penaltyDialog.selectedUserIds.map((id) => {
                  const staff = penaltyDialog.staff.find((s) => s.userId === id);
                  return staff ? <Chip key={id} size="small" label={staff.fullName} /> : null;
                })}
              </Stack>
            )}

            <TextField
              label="Số tiền phạt (mỗi người)"
              type="number"
              value={penaltyDialog.amount}
              onChange={(e) => setPenaltyDialog((d) => ({ ...d, amount: Number(e.target.value) }))}
              fullWidth
            />

            <TextField
              label="Lý do (tuỳ chọn)"
              value={penaltyDialog.reason}
              onChange={(e) => setPenaltyDialog((d) => ({ ...d, reason: e.target.value }))}
              multiline
              rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePenalty}>Huỷ</Button>
          <Button variant="contained" color="warning" onClick={handleSubmitPenalty}>
            Áp phạt
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
