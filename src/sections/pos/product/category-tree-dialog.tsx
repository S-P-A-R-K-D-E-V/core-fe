'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { ICategory, ICreateCategoryRequest } from 'src/types/corecms-api';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from 'src/api/categories';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: () => void;
  selectedId: string;
  onSelect: (id: string, name: string) => void;
};

export default function CategoryTreeDialog({ open, onClose, selectedId, onSelect }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [categories, setCategories] = useState<ICategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addingParentId, setAddingParentId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getAllCategories(true);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (open) loadCategories();
  }, [open, loadCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      const req: ICreateCategoryRequest = {
        name: newName.trim(),
        parentCategoryId: addingParentId || undefined,
      };
      await createCategory(req);
      enqueueSnackbar('Thêm nhóm hàng thành công');
      setNewName('');
      setAddingParentId(undefined);
      loadCategories();
    } catch (err) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await updateCategory(id, { name: editName.trim() });
      enqueueSnackbar('Cập nhật thành công');
      setEditingId(null);
      loadCategories();
    } catch (err) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      enqueueSnackbar('Xóa thành công');
      loadCategories();
    } catch (err) {
      enqueueSnackbar('Không thể xóa nhóm hàng này', { variant: 'error' });
    }
  };

  const renderTree = (nodes: ICategory[]) =>
    nodes.map((node) => (
      <TreeItem
        key={node.id}
        nodeId={node.id}
        label={
          <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
            {editingId === node.id ? (
              <>
                <TextField
                  size="small"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdate(node.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  sx={{ width: 160 }}
                />
                <IconButton
                  size="small"
                  color="success"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate(node.id);
                  }}
                >
                  <Iconify icon="mdi:check" width={16} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(null);
                  }}
                >
                  <Iconify icon="mdi:close" width={16} />
                </IconButton>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    flexGrow: 1,
                    fontWeight: selectedId === node.id ? 700 : 400,
                    color: selectedId === node.id ? 'primary.main' : 'text.primary',
                    cursor: 'pointer',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(node.id, node.name);
                  }}
                >
                  {node.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddingParentId(node.id);
                    setNewName('');
                  }}
                  title="Thêm nhóm con"
                >
                  <Iconify icon="mingcute:add-line" width={16} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(node.id);
                    setEditName(node.name);
                  }}
                  title="Sửa"
                >
                  <Iconify icon="solar:pen-bold" width={16} />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(node.id);
                  }}
                  title="Xóa"
                >
                  <Iconify icon="solar:trash-bin-trash-bold" width={16} />
                </IconButton>
              </>
            )}
          </Stack>
        }
      >
        {node.subCategories && node.subCategories.length > 0
          ? renderTree(node.subCategories)
          : null}
      </TreeItem>
    ));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nhóm hàng</DialogTitle>

      <DialogContent dividers>
        {/* Add new category */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder={
              addingParentId === null ? 'Tên nhóm hàng gốc...' : 'Tên nhóm con...'
            }
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            fullWidth
          />
          <Button variant="contained" size="small" onClick={handleAdd} disabled={!newName.trim()}>
            Thêm
          </Button>
          {addingParentId !== undefined && addingParentId !== null && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setAddingParentId(undefined)}
            >
              Hủy
            </Button>
          )}
        </Stack>

        {addingParentId && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Đang thêm nhóm con...
          </Typography>
        )}

        <Box sx={{ minHeight: 200, maxHeight: 400, overflow: 'auto' }}>
          {categories.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
              Chưa có nhóm hàng nào
            </Typography>
          ) : (
            <TreeView
              defaultCollapseIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}
              defaultExpandIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
              sx={{ flexGrow: 1 }}
            >
              {renderTree(categories)}
            </TreeView>
          )}
        </Box>

        {/* Add root category button */}
        <Button
          size="small"
          variant="soft"
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => {
            setAddingParentId(null);
            setNewName('');
          }}
          sx={{ mt: 1 }}
        >
          Thêm nhóm hàng gốc
        </Button>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
