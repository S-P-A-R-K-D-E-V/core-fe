'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';


// ------ Summary Row (like KiotViet top row) ------

import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { useBoolean } from 'src/hooks/use-boolean';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

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

import { IProduct, ICategory } from 'src/types/corecms-api';
import { getAllProducts, deleteProduct } from 'src/api/products';
import { getAllCategories } from 'src/api/categories';
import { fCurrency, fNumber } from 'src/utils/format-number';
import ProductTableToolbar from '../product-table-toolbar';
import ProductTableRow from '../product-table-row';

// ----------------------------------------------------------------------

const TABLE_HEAD = [
  { id: 'star', label: '', width: 40 },
  { id: 'image', label: '', width: 40 },
  { id: 'sku', label: 'Mã hàng', width: 140 },
  { id: 'name', label: 'Tên hàng' },
  { id: 'category', label: 'Nhóm hàng', width: 160 },
  { id: 'sellingPrice', label: 'Giá bán', width: 110, align: 'right' as const },
  { id: 'costPrice', label: 'Giá vốn', width: 110, align: 'right' as const },
  { id: 'stock', label: 'Tồn kho', width: 90, align: 'right' as const },
  { id: 'ordered', label: 'Khách đặt', width: 90, align: 'right' as const },
  { id: 'createdAt', label: 'Thời gian tạo', width: 150 },
];

// ----------------------------------------------------------------------

export default function ProductListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable();
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IProduct[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [products, cats] = await Promise.all([
        getAllProducts({ keyword: filterName || undefined, categoryId: filterCategory || undefined }),
        getAllCategories(),
      ]);
      setTableData(products);
      setCategories(cats);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải sản phẩm', { variant: 'error' });
    }
  }, [enqueueSnackbar, filterName, filterCategory]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dataFiltered = tableData;
  const dataInPage = dataFiltered.slice(table.page * table.rowsPerPage, table.page * table.rowsPerPage + table.rowsPerPage);
  const notFound = !dataFiltered.length;

  // Summary stats
  const totalStock = tableData.reduce((sum, p) => sum + p.totalStock, 0);

  const handleFilterName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    table.onResetPage();
    setFilterName(event.target.value);
  }, [table]);

  const handleFilterCategory = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    table.onResetPage();
    setFilterCategory(event.target.value);
  }, [table]);

  const handleDeleteRow = useCallback(async (id: string) => {
    try {
      await deleteProduct(id);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRow(dataInPage.length);
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteProduct(id)));
      enqueueSnackbar('Xóa thành công!');
      fetchData();
      table.onUpdatePageDeleteRows({ totalRowsInPage: dataInPage.length, totalRowsFiltered: dataFiltered.length });
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [dataFiltered.length, dataInPage.length, enqueueSnackbar, fetchData, table]);

  const handleEditRow = useCallback((id: string) => {
    router.push(paths.dashboard.pos.product.edit(id));
  }, [router]);

  const handleAddSameCategory = useCallback((product: IProduct) => {
    router.push(`${paths.dashboard.pos.product.new}?categoryId=${product.categoryId}`);
  }, [router]);

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Sản phẩm"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Kho hàng', href: paths.dashboard.pos.root },
            { name: 'Sản phẩm' },
          ]}
          action={
            <Button component={RouterLink} href={paths.dashboard.pos.product.new} variant="contained" startIcon={<Iconify icon="mingcute:add-line" />}>
              Thêm sản phẩm
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          <ProductTableToolbar
            filterName={filterName}
            onFilterName={handleFilterName}
            filterCategory={filterCategory}
            onFilterCategory={handleFilterCategory}
            categories={categories}
          />
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={dataFiltered.length}
              onSelectAllRows={(checked) => table.onSelectAllRows(checked, dataFiltered.map((row) => row.id))}
              action={<Button color="error" onClick={confirm.onTrue}>Xóa</Button>}
            />
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 1100 }}>
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
                  {/* Summary row */}
                  <SummaryRow totalStock={totalStock} />

                  {dataInPage.map((row) => (
                    <ProductTableRow
                      key={row.id}
                      row={row}
                      selected={table.selected.includes(row.id)}
                      onSelectRow={() => table.onSelectRow(row.id)}
                      onDeleteRow={() => handleDeleteRow(row.id)}
                      onEditRow={() => handleEditRow(row.id)}
                      onAddSameCategory={() => handleAddSameCategory(row)}
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
        content={<>Bạn có chắc muốn xóa <strong>{table.selected.length}</strong> sản phẩm?</>}
        action={<Button variant="contained" color="error" onClick={() => { handleDeleteRows(); confirm.onFalse(); }}>Xóa</Button>}
      />
    </>
  );
}

function SummaryRow({ totalStock }: { totalStock: number }) {
  return (
    <TableRow sx={{ bgcolor: 'background.neutral' }}>
      <TableCell colSpan={8} />
      <TableCell align="right">
        <Typography variant="subtitle2">{fNumber(totalStock)}</Typography>
      </TableCell>
      <TableCell align="right">
        <Typography variant="subtitle2">0</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>---</Typography>
      </TableCell>
    </TableRow>
  );
}
