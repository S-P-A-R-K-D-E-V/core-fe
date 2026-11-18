'use client';

import type { AgentAutonomyLevel, IAgentAutonomyPolicies } from 'src/api/agent-actions';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import { setAgentAutonomyLevel, useAgentAutonomyPolicies } from 'src/api/agent-actions';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

import { DOMAIN_LABELS } from 'src/sections/store-settings/agent-permission-picker';

import { AUTONOMY_LEVELS, AUTONOMY_LEVEL_ORDER, groupPoliciesByDomain } from './agent-action-utils';

// ----------------------------------------------------------------------
// Mức tự chủ của agent theo từng quyền ghi (chỉ áp dụng cho khoá "Agent tự chạy"). Danh sách quyền do máy chủ dựng từ
// chính các lệnh ghi của API nội bộ; quyền chưa đặt mức = Chờ duyệt.
// ----------------------------------------------------------------------

export default function AgentAutonomyTab() {
  const { enqueueSnackbar } = useSnackbar();
  const { data, loading, error, refresh } = useAgentAutonomyPolicies();
  const [saving, setSaving] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

  const groups = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const items = (data?.items ?? []).filter(
      (item) =>
        !kw ||
        item.permission.toLowerCase().includes(kw) ||
        item.endpoints.some((e) => e.toLowerCase().includes(kw)) ||
        (DOMAIN_LABELS[item.permission.split('.')[0]] ?? '').toLowerCase().includes(kw)
    );
    return groupPoliciesByDomain(items);
  }, [data, keyword]);

  const levels = (data?.levels?.length ? data.levels : AUTONOMY_LEVEL_ORDER).filter(
    (l): l is AgentAutonomyLevel => l in AUTONOMY_LEVELS
  );
  const defaultLevel = data?.defaultLevel ?? 'approve';

  const handleChange = async (permission: string, level: AgentAutonomyLevel) => {
    setSaving(permission);
    try {
      await setAgentAutonomyLevel(permission, level);
      await refresh(
        (current: IAgentAutonomyPolicies | undefined) =>
          current && {
            ...current,
            items: current.items.map((item) =>
              item.permission === permission ? { ...item, level, isDefault: false } : item
            ),
          },
        { revalidate: true }
      );
      enqueueSnackbar(`Đã đặt "${permission}": ${AUTONOMY_LEVELS[level].label}`);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu mức tự chủ thất bại'), { variant: 'error' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Agent được tự làm tới đâu
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Áp dụng cho khoá agent ở chế độ &quot;Agent tự chạy — duyệt ở máy chủ&quot; (đặt ở Cài đặt
          cửa hàng › Kết nối MCP &amp; khoá API). Mỗi loại thao tác ghi có một mức; chưa đặt thì là{' '}
          <strong>{AUTONOMY_LEVELS[defaultLevel]?.label ?? defaultLevel}</strong>. Quyền của khoá
          vẫn là giới hạn ngoài cùng — mức tự chủ không mở thêm quyền.
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          }}
        >
          {AUTONOMY_LEVEL_ORDER.map((level) => (
            <Stack key={level} spacing={0.5}>
              <Label color={AUTONOMY_LEVELS[level].color} sx={{ alignSelf: 'flex-start' }}>
                {AUTONOMY_LEVELS[level].label}
              </Label>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {AUTONOMY_LEVELS[level].description}
              </Typography>
            </Stack>
          ))}
        </Box>
      </Card>

      <Card>
        <Stack sx={{ p: 2.5 }}>
          <TextField
            size="small"
            placeholder="Tìm quyền hoặc lệnh…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ maxWidth: 360 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mx: 2.5, mb: 2.5 }}>
            {apiErrorMessage(error, 'Không tải được mức tự chủ')}
          </Alert>
        )}

        {loading && (
          <Stack spacing={1} sx={{ px: 2.5, pb: 2.5 }}>
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
          </Stack>
        )}

        {!loading && !error && (
          <TableContainer>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Quyền</TableCell>
                    <TableCell>Lệnh ghi</TableCell>
                    <TableCell sx={{ width: 220 }}>Mức tự chủ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groups.map((group) => [
                    <TableRow key={`g-${group.domain}`}>
                      <TableCell colSpan={3} sx={{ bgcolor: 'background.neutral', py: 1 }}>
                        <Typography variant="subtitle2" component="span">
                          {DOMAIN_LABELS[group.domain] ?? group.domain}
                        </Typography>
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{ ml: 1, color: 'text.disabled', fontFamily: 'monospace' }}
                        >
                          {group.domain}
                        </Typography>
                      </TableCell>
                    </TableRow>,
                    ...group.items.map((item) => (
                      <TableRow key={item.permission} hover>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {item.permission}
                          </Typography>
                          {item.requiresConfirmation && (
                            <Tooltip title="Lệnh quan trọng — ở chế độ người dùng tự xác nhận, agent phải hỏi người dùng trước">
                              <Label color="warning" variant="soft" sx={{ mt: 0.5 }}>
                                Cần xác nhận
                              </Label>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          {item.endpoints.map((e) => (
                            <Typography
                              key={e}
                              variant="caption"
                              component="div"
                              sx={{
                                fontFamily: 'monospace',
                                color: 'text.secondary',
                                wordBreak: 'break-all',
                              }}
                            >
                              {e}
                            </Typography>
                          ))}
                        </TableCell>
                        <TableCell sx={{ verticalAlign: 'top' }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Select
                              size="small"
                              fullWidth
                              value={item.level}
                              disabled={saving === item.permission}
                              onChange={(e) =>
                                handleChange(item.permission, e.target.value as AgentAutonomyLevel)
                              }
                              inputProps={{ 'aria-label': `Mức tự chủ cho ${item.permission}` }}
                            >
                              {levels.map((level) => (
                                <MenuItem key={level} value={level}>
                                  {AUTONOMY_LEVELS[level].label}
                                </MenuItem>
                              ))}
                            </Select>
                            {saving === item.permission && <CircularProgress size={18} />}
                          </Stack>
                          {item.isDefault && (
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                              mặc định
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    )),
                  ])}
                  {groups.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {keyword ? 'Không có quyền nào khớp' : 'Chưa có lệnh ghi nào cho agent'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>
    </Stack>
  );
}
