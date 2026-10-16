'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import { apiErrorMessage } from 'src/utils/api-error';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
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

import { IRole, IRoleCatalogStatus } from 'src/types/corecms-api';

import { getAllRoles, deleteRole, getRoleCatalogStatus } from 'src/api/roles';
import RoleTableToolbar from '../role-table-toolbar';
import RoleTableRow from '../role-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  { id: 'permissions', label: 'Permissions', width: 160 },
  { id: 'isActive', label: 'Status', width: 100 },
  { id: 'createdAt', label: 'Created', width: 160 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function RoleListView() {
  const { enqueueSnackbar } = useSnackbar();

  const table = useTable();

  const router = useRouter();

  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IRole[]>([]);

  const [filterName, setFilterName] = useState('');

  const [catalog, setCatalog] = useState<IRoleCatalogStatus | null>(null);

  // Chưa biết (đang hỏi) → ẩn nút sửa cho tới khi chắc, tránh nháy hiện rồi ẩn.
  const editable = catalog?.editable === true;

  useEffect(() => {
    getRoleCatalogStatus().then(setCatalog);
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await getAllRoles();
      setTableData(data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      enqueueSnackbar('Failed to load roles', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const dataFiltered = applyFilter({
    inputData: tableData,
    filterName,
  });

  const dataInPage = dataFiltered.slice(
    table.page * table.rowsPerPage,
    table.page * table.rowsPerPage + table.rowsPerPage
  );

  const notFound = !dataFiltered.length && !!filterName;

  // Vai trò hệ thống không xoá được (Core-be SystemRoles) → không cho chọn để xoá hàng loạt.
  const deletableIds = editable ? dataFiltered.filter((row) => !row.isSystem).map((row) => row.id) : [];

  const handleFilterName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      table.onResetPage();
      setFilterName(event.target.value);
    },
    [table]
  );

  const handleDeleteRow = useCallback(
    async (id: string) => {
      try {
        await deleteRole(id);
        enqueueSnackbar('Delete success!');
        fetchRoles();
        table.onUpdatePageDeleteRow(dataInPage.length);
      } catch (error) {
        console.error('Failed to delete role:', error);
        enqueueSnackbar(apiErrorMessage(error, 'Không xoá được vai trò'), { variant: 'error' });
      }
    },
    [dataInPage.length, enqueueSnackbar, fetchRoles, table]
  );

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteRole(id)));
      enqueueSnackbar('Delete success!');
      fetchRoles();
      table.onUpdatePageDeleteRows({
        totalRowsInPage: dataInPage.length,
        totalRowsFiltered: dataFiltered.length,
      });
    } catch (error) {
      console.error('Failed to delete roles:', error);
      enqueueSnackbar(apiErrorMessage(error, 'Không xoá được vai trò'), { variant: 'error' });
    }
  }, [dataFiltered.length, dataInPage.length, enqueueSnackbar, fetchRoles, table]);

  const handleEditRow = useCallback(
    (id: string) => {
      router.push(paths.dashboard.role.edit(id));
    },
    [router]
  );

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Role List"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Role', href: paths.dashboard.role.root },
            { name: 'List' },
          ]}
          action={
            editable && (
              <Button
                component={RouterLink}
                href={paths.dashboard.role.new}
                variant="contained"
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                New Role
              </Button>
            )
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        {catalog && !catalog.editable && (
          <Alert severity="info" sx={{ mb: 3 }}>
            {catalog.reason || 'Danh mục vai trò của cửa hàng này không sửa được.'} Bạn vẫn gán vai trò cho nhân viên
            trong mục Người dùng.
          </Alert>
        )}

        <Card>
          <RoleTableToolbar filterName={filterName} onFilterName={handleFilterName} />

          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={deletableIds.length}
              onSelectAllRows={(checked) =>
                table.onSelectAllRows(
                  checked,
                  deletableIds
                )
              }
              action={
                <Button color="error" onClick={confirm.onTrue}>
                  Delete
                </Button>
              }
            />

            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={deletableIds.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                  onSelectAllRows={(checked) =>
                    table.onSelectAllRows(
                      checked,
                      deletableIds
                    )
                  }
                />

                <TableBody>
                  {dataFiltered
                    .slice(
                      table.page * table.rowsPerPage,
                      table.page * table.rowsPerPage + table.rowsPerPage
                    )
                    .map((row) => (
                      <RoleTableRow
                        key={row.id}
                        row={row}
                        selected={table.selected.includes(row.id)}
                        canEdit={editable}
                        canDelete={editable && !row.isSystem}
                        onSelectRow={() => table.onSelectRow(row.id)}
                        onDeleteRow={() => handleDeleteRow(row.id)}
                        onEditRow={() => handleEditRow(row.id)}
                      />
                    ))}

                  <TableEmptyRows
                    height={table.dense ? 56 : 76}
                    emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
                  />

                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>

          <TablePaginationCustom
            count={dataFiltered.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.onChangePage}
            onRowsPerPageChange={table.onChangeRowsPerPage}
            dense={table.dense}
            onChangeDense={table.onChangeDense}
          />
        </Card>
      </Container>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Delete"
        content={
          <>
            Are you sure you want to delete <strong>{table.selected.length}</strong> roles?
          </>
        }
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              handleDeleteRows();
              confirm.onFalse();
            }}
          >
            Delete
          </Button>
        }
      />
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, filterName }: { inputData: IRole[]; filterName: string }) {
  if (filterName) {
    inputData = inputData.filter(
      (role) =>
        role.name.toLowerCase().indexOf(filterName.toLowerCase()) !== -1 ||
        (role.description && role.description.toLowerCase().indexOf(filterName.toLowerCase()) !== -1)
    );
  }

  return inputData;
}
