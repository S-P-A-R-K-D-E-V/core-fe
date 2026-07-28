'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import Label from 'src/components/label';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftReminderRule } from 'src/types/shift-reminder-rule';
import {
  getShiftReminderRules,
  updateShiftReminderRule,
  deactivateShiftReminderRule,
} from 'src/api/shift-reminder-rules';

// ----------------------------------------------------------------------

function anchorDirectionLabel(rule: IShiftReminderRule) {
  const before = rule.offsetMinutes < 0;
  const anchor = rule.anchorEvent === 'ShiftStart' ? 'giờ vào ca' : 'giờ kết thúc ca';
  return `${before ? 'Trước' : 'Sau'} ${Math.abs(rule.offsetMinutes)} phút ${anchor}`;
}

export default function ShiftReminderRuleListView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const [rules, setRules] = useState<IShiftReminderRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getShiftReminderRules();
      setRules(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh sách quy tắc nhắc lịch', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggleActive = async (rule: IShiftReminderRule) => {
    try {
      if (rule.isActive) {
        await deactivateShiftReminderRule(rule.id);
      } else {
        await updateShiftReminderRule(rule.id, {
          name: rule.name,
          anchorEvent: rule.anchorEvent,
          offsetMinutes: rule.offsetMinutes,
          skipIfConsecutive: rule.skipIfConsecutive,
          titleTemplate: rule.titleTemplate,
          messageTemplate: rule.messageTemplate,
          appliesToAllShiftTemplates: rule.appliesToAllShiftTemplates,
          shiftTemplateIds: rule.shiftTemplateScopes.map((s) => s.shiftTemplateId),
          isActive: true,
        });
      }
      await fetchRules();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Cập nhật trạng thái thất bại', { variant: 'error' });
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Nhắc lịch làm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Ca làm', href: paths.dashboard.shift.root },
          { name: 'Nhắc lịch làm' },
        ]}
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={() => router.push(paths.dashboard.shift.reminderRules.new)}
          >
            Thêm quy tắc
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        <TableContainer sx={{ overflow: 'unset' }}>
          <Table size="medium" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Thời điểm nhắc</TableCell>
                <TableCell>Gộp ca liền nhau</TableCell>
                <TableCell>Phạm vi</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>{anchorDirectionLabel(rule)}</TableCell>
                  <TableCell>
                    {rule.skipIfConsecutive ? (
                      <Iconify icon="eva:checkmark-fill" color="success.main" />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {rule.appliesToAllShiftTemplates ? (
                      <Label color="default">Tất cả</Label>
                    ) : (
                      rule.shiftTemplateScopes.map((s) => (
                        <Chip key={s.shiftTemplateId} label={s.shiftTemplateName} size="small" sx={{ mr: 0.5 }} />
                      ))
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.isActive}
                      onChange={() => handleToggleActive(rule)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => router.push(paths.dashboard.shift.reminderRules.edit(rule.id))}
                    >
                      <Iconify icon="solar:pen-bold" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Chưa có quy tắc nhắc lịch nào
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Container>
  );
}
