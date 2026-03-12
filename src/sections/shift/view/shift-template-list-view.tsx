'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  TableNoData,
  TableEmptyRows,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useBoolean } from 'src/hooks/use-boolean';

import { IShiftTemplate } from 'src/types/corecms-api';
import { getAllShiftTemplates, deleteShiftTemplate } from 'src/api/attendance';

import ShiftTemplateTableRow from '../shift-template-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Template Name' },
  { id: 'shiftType', label: 'Type', width: 120 },
  { id: 'color', label: 'Color', width: 80 },
  { id: 'isActive', label: 'Status', width: 100 },
  { id: 'createdAt', label: 'Created', width: 150 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function ShiftTemplateListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const settings = useSettingsContext();
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const templates = await getAllShiftTemplates();
      setTableData(templates);
    } catch (error) {
      console.error('Failed to fetch shift templates:', error);
      enqueueSnackbar('Failed to load shift templates', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const dataInPage = tableData.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const denseHeight = table.dense ? 56 : 76;
  const notFound = !tableData.length;

  const handleDeleteRow = useCallback(
    async (id: string) => {
      try {
        await deleteShiftTemplate(id);
        enqueueSnackbar('Delete success!');
        fetchTemplates();
        table.onUpdatePageDeleteRow(dataInPage.length);
      } catch (error) {
        console.error(error);
        enqueueSnackbar('Delete failed!', { variant: 'error' });
      }
    },
    [dataInPage.length, enqueueSnackbar, table, fetchTemplates]
  );

  const handleEditRow = useCallback(
    (id: string) => {
      router.push(paths.dashboard.shift.templates.edit(id));
    },
    [router]
  );

  const handleViewSchedules = useCallback(
    (id: string) => {
      router.push(paths.dashboard.shift.schedules.byTemplate(id));
    },
    [router]
  );

  return (
    <>
      <Container maxWidth={settings.themeStretch ? false : 'lg'}>
        <CustomBreadcrumbs
          heading="Shift Templates"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Shift', href: paths.dashboard.shift.root },
            { name: 'Templates' },
          ]}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => router.push(paths.dashboard.shift.templates.new)}
            >
              New Template
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={tableData.length}
              onSelectAllRows={(checked) =>
                table.onSelectAllRows(
                  checked,
                  tableData.map((row) => row.id)
                )
              }
              action={
                <Tooltip title="Delete">
                  <IconButton color="primary" onClick={confirm.onTrue}>
                    <Iconify icon="solar:trash-bin-trash-bold" />
                  </IconButton>
                </Tooltip>
              }
            />

            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={tableData.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                  onSelectAllRows={(checked) =>
                    table.onSelectAllRows(
                      checked,
                      tableData.map((row) => row.id)
                    )
                  }
                />

                <TableBody>
                  {dataInPage.map((row) => (
                    <ShiftTemplateTableRow
                      key={row.id}
                      row={row}
                      selected={table.selected.includes(row.id)}
                      onSelectRow={() => table.onSelectRow(row.id)}
                      onDeleteRow={() => handleDeleteRow(row.id)}
                      onEditRow={() => handleEditRow(row.id)}
                      onViewSchedules={() => handleViewSchedules(row.id)}
                    />
                  ))}

                  <TableEmptyRows
                    height={denseHeight}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, tableData.length)}
                  />

                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={tableData.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      </Container>
    </>
  );
}
