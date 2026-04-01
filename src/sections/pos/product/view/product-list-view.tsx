'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';

import Stack from '@mui/material/Stack';
import { useBoolean } from 'src/hooks/use-boolean';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import {
  useTable,
  TableNoData,
  TableHeadCustom,
  TableSelectedAction,
  TablePaginationCustom,
} from 'src/components/table';

import { useContext } from 'react';

import { IProductListItem, ICategory } from 'src/types/corecms-api';
import { getAllProducts, deleteProduct } from 'src/api/products';
import { SyncNotificationContext } from 'src/hooks/use-sync-notification';
import { getAllCategories } from 'src/api/categories';
import ProductTableToolbar from '../product-table-toolbar';
import ProductTableRow from '../product-table-row';
import ProductEditDialog from '../product-edit-dialog';

// ----------------------------------------------------------------------

export type ColumnKey =
  | 'image'
  | 'code'
  | 'barCode'
  | 'name'
  | 'category'
  | 'productType'
  | 'basePrice'
  | 'cost'
  | 'tradeMarkName'
  | 'stock'
  | 'reserved'
  | 'createdDate'
  | 'estimatedOutOfStock'
  | 'minQuantity'
  | 'maxQuantity'
  | 'status'
  | 'isRewardPoint';

export interface ColumnConfig {
  id: ColumnKey;
  label: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  defaultVisible: boolean;
}

export const ALL_COLUMNS: ColumnConfig[] = [
  { id: 'image', label: 'Hình ảnh', width: 40, defaultVisible: true },
  { id: 'code', label: 'Mã hàng', width: 140, defaultVisible: true },
  { id: 'barCode', label: 'Mã vạch', width: 140, defaultVisible: false },
  { id: 'name', label: 'Tên hàng', defaultVisible: true },
  { id: 'category', label: 'Nhóm hàng', width: 160, defaultVisible: false },
  { id: 'productType', label: 'Loại hàng', width: 110, defaultVisible: false },
  { id: 'basePrice', label: 'Giá bán', width: 120, align: 'right', defaultVisible: true },
  { id: 'cost', label: 'Giá vốn', width: 120, align: 'right', defaultVisible: true },
  { id: 'tradeMarkName', label: 'Thương hiệu', width: 130, defaultVisible: false },
  { id: 'stock', label: 'Tồn kho', width: 90, align: 'right', defaultVisible: true },
  { id: 'reserved', label: 'Khách đặt', width: 90, align: 'right', defaultVisible: true },
  { id: 'createdDate', label: 'Thời gian tạo', width: 150, defaultVisible: true },
  { id: 'estimatedOutOfStock', label: 'Dự kiến hết hàng', width: 140, defaultVisible: true },
  { id: 'minQuantity', label: 'Định mức tồn ít nhất', width: 140, align: 'right', defaultVisible: false },
  { id: 'maxQuantity', label: 'Định mức tồn nhiều nhất', width: 140, align: 'right', defaultVisible: false },
  { id: 'status', label: 'Trạng thái', width: 110, defaultVisible: false },
  { id: 'isRewardPoint', label: 'Tích điểm', width: 90, defaultVisible: false },
];

const STORAGE_KEY = 'product-list-visible-columns';

function getInitialVisibleColumns(): ColumnKey[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
  }
  return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id);
}

// ----------------------------------------------------------------------

export default function ProductListView() {
  const { enqueueSnackbar } = useSnackbar();
  const table = useTable({ defaultRowsPerPage: 25 });
  const router = useRouter();
  const confirm = useBoolean();

  const [tableData, setTableData] = useState<IProductListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(getInitialVisibleColumns);
  const editDialog = useBoolean();
  const [editProductId, setEditProductId] = useState<string | undefined>(undefined);

  const handleToggleColumn = useCallback((columnId: ColumnKey) => {
    setVisibleColumns((prev) => {
      const nextSet = new Set(
        prev.includes(columnId) ? prev.filter((c) => c !== columnId) : [...prev, columnId]
      );
      // Always maintain ALL_COLUMNS order
      const next = ALL_COLUMNS.map((c) => c.id).filter((id) => nextSet.has(id));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const visibleHeadLabels = ALL_COLUMNS
    .filter((c) => visibleColumns.includes(c.id))
    .map(({ id, label, width, align }) => ({ id, label, width, align: align as 'left' | 'right' | 'center' | undefined }));

  const fetchData = useCallback(async () => {
    try {
      const [pagedResult, cats] = await Promise.all([
        getAllProducts({
          keyword: filterName || undefined,
          categoryId: filterCategory || undefined,
          page: table.page + 1,
          pageSize: table.rowsPerPage,
        }),
        getAllCategories(),
      ]);
      setTableData(pagedResult.items);
      setTotalCount(pagedResult.totalCount);
      setCategories(cats);
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải sản phẩm', { variant: 'error' });
    }
  }, [enqueueSnackbar, filterName, filterCategory, table.page, table.rowsPerPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const notFound = !tableData.length;

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
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchData]);

  const handleDeleteRows = useCallback(async () => {
    try {
      await Promise.all(table.selected.map((id) => deleteProduct(id)));
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    }
  }, [enqueueSnackbar, fetchData, table]);

  const handleEditRow = useCallback((id: string) => {
    setEditProductId(id);
    editDialog.onTrue();
  }, [editDialog]);

  const handleCreateProduct = useCallback(() => {
    setEditProductId(undefined);
    editDialog.onTrue();
  }, [editDialog]);

  const handleDialogClose = useCallback(() => {
    editDialog.onFalse();
    setEditProductId(undefined);
  }, [editDialog]);

  const handleDialogSaved = useCallback(() => {
    handleDialogClose();
    fetchData();
  }, [handleDialogClose, fetchData]);

  const handleAddSameCategory = useCallback((product: IProductListItem) => {
    router.push(`${paths.dashboard.pos.product.new}?categoryId=${product.id}`);
  }, [router]);

  const { startSync } = useContext(SyncNotificationContext);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const jobId = await startSync('all');
      if (jobId) {
        enqueueSnackbar('Đã gửi yêu cầu đồng bộ KiotViet. Xem tiến trình tại Notifications.', { variant: 'info' });
      } else {
        enqueueSnackbar('Gửi yêu cầu đồng bộ thất bại', { variant: 'error' });
      }
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Đồng bộ thất bại', { variant: 'error' });
    } finally {
      setSyncing(false);
    }
  }, [enqueueSnackbar, startSync]);

  // Total column count = visible columns + checkbox column
  const totalColSpan = visibleHeadLabels.length + 1;

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
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<Iconify icon="mdi:sync" />}
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ KiotViet'}
              </Button>
              <Button variant="contained" startIcon={<Iconify icon="mingcute:add-line" />} onClick={handleCreateProduct}>
                Thêm sản phẩm
              </Button>
            </Stack>
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
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
          />
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <TableSelectedAction
              dense={table.dense}
              numSelected={table.selected.length}
              rowCount={tableData.length}
              onSelectAllRows={(checked) => table.onSelectAllRows(checked, tableData.map((row) => row.id))}
              action={<Button color="error" onClick={confirm.onTrue}>Xóa</Button>}
            />
            <Scrollbar>
              <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 960 }}>
                <TableHeadCustom
                  order={table.order}
                  orderBy={table.orderBy}
                  headLabel={visibleHeadLabels}
                  rowCount={tableData.length}
                  numSelected={table.selected.length}
                  onSort={table.onSort}
                  onSelectAllRows={(checked) => table.onSelectAllRows(checked, tableData.map((row) => row.id))}
                />
                <TableBody>
                  {tableData.map((row) => (
                    <ProductTableRow
                      key={row.id}
                      row={row}
                      selected={table.selected.includes(row.id)}
                      onSelectRow={() => table.onSelectRow(row.id)}
                      onDeleteRow={() => handleDeleteRow(row.id)}
                      onEditRow={handleEditRow}
                      onAddSameCategory={() => handleAddSameCategory(row)}
                      visibleColumns={visibleColumns}
                      totalColSpan={totalColSpan}
                    />
                  ))}
                  <TableNoData notFound={notFound} />
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
          <TablePaginationCustom
            count={totalCount}
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

      <ProductEditDialog
        open={editDialog.value}
        onClose={handleDialogClose}
        productId={editProductId}
        onSaved={handleDialogSaved}
      />
    </>
  );
}
