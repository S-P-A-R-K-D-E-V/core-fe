'use client';

import { useState, useEffect, useCallback } from 'react';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { getInspections } from 'src/api/inspection';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { InspectionType, InspectionStatus, IInspectionSummary } from 'src/types/inspection';
import { INSPECTION_TYPE_LABEL } from 'src/types/inspection';

import { StatusChip, toDateInput } from '../inspection-common';

// ----------------------------------------------------------------------
// Lịch sử lượt kiểm — phân trang và lọc phía server (ngày, loại, trạng thái). Bấm một dòng mở chi tiết (ảnh trước / sau).
// ----------------------------------------------------------------------

export default function InspectionHistoryView() {
  const settings = useSettingsContext();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [from, setFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [type, setType] = useState<InspectionType | ''>('');
  const [status, setStatus] = useState<InspectionStatus | ''>('');
  const [pagination, setPagination] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [rows, setRows] = useState<IInspectionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getInspections({
        from,
        to,
        type: type || undefined,
        status: status || undefined,
        page: pagination.page + 1,
        pageSize: pagination.pageSize,
      });
      setRows(data.items);
      setTotal(data.totalCount);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được lịch sử kiểm'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [from, to, type, status, pagination, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: GridColDef<IInspectionSummary>[] = [
    { field: 'date', headerName: 'Ngày', width: 110, valueFormatter: (v) => fDate(v as string) },
    {
      field: 'shiftName',
      headerName: 'Ca',
      width: 160,
      renderCell: ({ row }) => `${row.shiftName} ${row.startTime}–${row.endTime}`,
    },
    {
      field: 'type',
      headerName: 'Loại',
      width: 150,
      renderCell: ({ row }) => `${INSPECTION_TYPE_LABEL[row.type]}${row.isSpotCheck ? ' (đột xuất)' : ''}`,
    },
    { field: 'inspectorName', headerName: 'Người kiểm', flex: 1, minWidth: 150 },
    {
      field: 'status',
      headerName: 'Trạng thái',
      width: 120,
      renderCell: ({ row }) => <StatusChip status={row.status} />,
    },
    {
      field: 'failCount',
      headerName: 'Kết quả',
      width: 190,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: 1 }}>
          <Chip size="small" color="success" variant="outlined" label={row.passCount} />
          <Chip size="small" color="error" variant="outlined" label={row.failCount} />
          {row.passRate != null && <Chip size="small" label={`${Math.round(row.passRate * 100)}%`} />}
        </Stack>
      ),
    },
    {
      field: 'submittedAt',
      headerName: 'Nộp lúc',
      width: 140,
      valueFormatter: (v) => (v ? fDateTime(v as string, 'HH:mm dd/MM') : '—'),
    },
  ];

  const resetPage = () => setPagination((p) => ({ ...p, page: 0 }));

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Lịch sử kiểm"
        links={[{ name: 'Kiểm tra cửa hàng', href: paths.dashboard.inspection.root }, { name: 'Lịch sử kiểm' }]}
        sx={{ mb: 3 }}
      />
      <Card>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField
            type="date"
            size="small"
            label="Từ ngày"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPage();
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            size="small"
            label="Đến ngày"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPage();
            }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            size="small"
            label="Loại"
            value={type}
            onChange={(e) => {
              setType(e.target.value as InspectionType | '');
              resetPage();
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="ShiftQuick">Kiểm nhanh</MenuItem>
            <MenuItem value="WeeklyFull">Kiểm tuần</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InspectionStatus | '');
              resetPage();
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="Draft">Đang kiểm</MenuItem>
            <MenuItem value="Submitted">Đã nộp</MenuItem>
          </TextField>
        </Stack>
        <DataGrid
          autoHeight
          rows={rows}
          columns={columns}
          loading={loading}
          rowCount={total}
          paginationMode="server"
          paginationModel={pagination}
          onPaginationModelChange={setPagination}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          disableColumnMenu
          onRowClick={({ row }) => router.push(paths.dashboard.inspection.run(row.id))}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          localeText={{ noRowsLabel: 'Không có lượt kiểm nào trong khoảng này' }}
        />
      </Card>
    </Container>
  );
}
