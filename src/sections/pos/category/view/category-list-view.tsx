'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

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

import { ICategory } from 'src/types/corecms-api';
import { getAllCategories, deleteCategory } from 'src/api/categories';
import CategoryTableToolbar from '../category-table-toolbar';
import CategoryTableRow from '../category-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'name', label: 'Tên' },
  { id: 'description', label: 'Mô tả' },
  { id: 'parent', label: 'Danh mục cha', width: 160 },
  { id: 'sortOrder', label: 'Thứ tự', width: 100, align: 'center' as const },
  { id: 'isActive', label: 'Trạng thái', width: 120 },
  { id: 'createdAt', label: 'Ngày tạo', width: 140 },
  { id: '', width: 88 },
];

// ----------------------------------------------------------------------

export default function CategoryListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<ICategory[]>([]);
  const [filterName, setFilterName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const data = await getAllCategories();
      setTableData(data);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh mục', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataFiltered = applyFilter({ inputData: tableData, filterName });
  const dataInPage = dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage);
  const notFound = !dataFiltered.length && !!filterName;

  const handleFilterName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    table.onResetPage();
    setFilterName(event.target.value);
  }, [table]);

  const handleDeleteRow = useCallback(async (id: string) => {
    try {
      await deleteCategory(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRow(dataInPage.length);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteCategory(id)));
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRows({ totalRowsInPage: dataInPage.length, totalRowsFiltered: dataFiltered.length });
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataFiltered.length, dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleEditRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.category.edit(id));
  }, [router]);

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Danh mục sản phẩm"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kho hàng', href: paths.dashboard.pos.root },
            { name: 'Danh mục' },
          ]}
          action={
            <Button component={RouterLink} href={paths.dashboard.pos.category.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
              Thêm danh mục
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <CategoryTableToolbar filterName={filterName} onFilterName={handleFilterName} />
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={dataFiltered.length}
              onSelectAllRows={(checked) => table.onSelectAllRows(checked, dataFiltered.map((row) => row.id))}
              action={<Button color="error" onClick={confirm.onTrue}>Xóa</Button>}
            />
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={TABLE_HEAD}
                  rowCount={dataFiltered.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                  onSelectAllRows={(checked) => table.onSelectAllRows(checked, dataFiltered.map((row) => row.id))}
                />
                <TableBody>
                  {dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage).map((row) => (
                    <CategoryTableRow
                      key={row.id}
                      row={row}
                      selected={table.selected.includes(row.id)}
                      onSelectRow={() => table.onSelectRow(row.id)}
                      onDeleteRow={() => handleDeleteRow(row.id)}
                      onEditRow={() => handleEditRow(row.id)}
                    />
                  ))}
                  <TableEmptyRows height={table.dense ? 56 : 76} emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)} />
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
        title="Xóa"
        content={<>Bạn có chắc muốn xóa <strong>{table.selected.length}</strong> danh mục?</>}
        action={<Button variant="contained" color="error" onClick={() => { handleDeleteRows(); confirm.onFalse(); }}>Xóa</Button>}
      />
    </>
  );
}

function applyFilter({ inputData, filterName }: { inputData: ICategory[]; filterName: string }) {
  if (filterName) {
    inputData = inputData.filter(
      (item) => item.name.toLowerCase().indexOf(filterName.toLowerCase()) !== -1
    );
  }
  return inputData;
}
