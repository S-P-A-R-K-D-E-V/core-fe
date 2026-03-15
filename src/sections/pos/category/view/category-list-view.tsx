'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { ICategory } from 'src/types/corecms-api';
import { getAllCategories, deleteCategory, updateCategory } from 'src/api/categories';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface TreeNode extends ICategory {
  children: TreeNode[];
}

// ----------------------------------------------------------------------
// Tree helpers
// ----------------------------------------------------------------------

function buildTree(flat: ICategory[], parentId: string | null = null): TreeNode[] {
  return flat
    .filter((c) => (c.parentCategoryId ?? null) === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ ...c, children: buildTree(flat, c.id) }));
}

function flattenTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

function removeNodeFromTree(nodes: TreeNode[], id: string): { tree: TreeNode[]; removed: TreeNode | null } {
  let removed: TreeNode | null = null;
  function remove(items: TreeNode[]): TreeNode[] {
    return items
      .filter((n) => { if (n.id === id) { removed = n; return false; } return true; })
      .map((n) => ({ ...n, children: remove(n.children) }));
  }
  return { tree: remove(nodes), removed };
}

function insertNodeIntoTree(nodes: TreeNode[], node: TreeNode, parentId: string | null, index: number): TreeNode[] {
  if (parentId === null) {
    const result = [...nodes];
    result.splice(index, 0, node);
    return result.map((n, i) => ({ ...n, sortOrder: i }));
  }
  return nodes.map((n) => {
    if (n.id === parentId) {
      const newChildren = [...n.children];
      newChildren.splice(index, 0, node);
      return { ...n, children: newChildren.map((c, i) => ({ ...c, sortOrder: i })) };
    }
    return { ...n, children: insertNodeIntoTree(n.children, node, parentId, index) };
  });
}

// ----------------------------------------------------------------------
// Tree Node (Draggable row + nested Droppable for children)
// ----------------------------------------------------------------------

type NodeProps = {
  node: TreeNode;
  index: number;
  depth: number;
  isDragDisabled: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

function CategoryDraggableNode({ node, index, depth, isDragDisabled, expandedIds, onToggle, onEdit, onDelete }: NodeProps) {
  const isExpanded = expandedIds.has(node.id);

  return (
    <Draggable draggableId={node.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps}>
          <Stack
            direction="row"
            alignItems="center"
            gap={0.5}
            sx={{
              pl: depth * 3 + 1,
              pr: 1,
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: snapshot.isDragging ? 'primary.lighter' : 'background.paper',
              boxShadow: snapshot.isDragging ? 4 : 0,
              borderRadius: snapshot.isDragging ? 1 : 0,
              transition: 'background-color 0.15s',
              '&:hover': { bgcolor: snapshot.isDragging ? 'primary.lighter' : 'action.hover' },
            }}
          >
            {/* Drag handle */}
            <Box
              {...provided.dragHandleProps}
              component="span"
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: isDragDisabled ? 'default' : 'grab',
                color: isDragDisabled ? 'transparent' : 'text.disabled',
                flexShrink: 0,
              }}
            >
              <Iconify icon="eva:menu-2-fill" width={18} />
            </Box>

            {/* Expand toggle */}
            <IconButton size="small" onClick={() => onToggle(node.id)} sx={{ flexShrink: 0 }}>
              {node.children.length > 0 ? (
                <Iconify
                  icon={isExpanded ? 'eva:arrow-ios-downward-fill' : 'eva:arrow-ios-forward-fill'}
                  width={16}
                />
              ) : (
                <Box sx={{ width: 16 }} />
              )}
            </IconButton>

            {/* Name */}
            <Typography
              variant="body2"
              sx={{ flex: 1, fontWeight: node.children.length > 0 ? 600 : 400 }}
            >
              {node.name}
            </Typography>

            {node.description && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mr: 1, display: { xs: 'none', md: 'block' } }}
              >
                {node.description}
              </Typography>
            )}

            {node.children.length > 0 && (
              <Label variant="soft" color="default" sx={{ mr: 0.5 }}>
                {node.children.length}
              </Label>
            )}

            <Label variant="soft" color={node.isActive ? 'success' : 'error'}>
              {node.isActive ? 'Hoạt động' : 'Ẩn'}
            </Label>

            <Tooltip title="Sửa">
              <IconButton size="small" onClick={() => onEdit(node.id)}>
                <Iconify icon="solar:pen-bold" width={16} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Xóa">
              <IconButton size="small" color="error" onClick={() => onDelete(node.id)}>
                <Iconify icon="solar:trash-bin-trash-bold" width={16} />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Children drop zone */}
          {isExpanded && (
            <CategoryTreeLevel
              nodes={node.children}
              droppableId={node.id}
              depth={depth + 1}
              isDragDisabled={isDragDisabled}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
        </div>
      )}
    </Draggable>
  );
}

// ----------------------------------------------------------------------
// Tree Level (Droppable list)
// ----------------------------------------------------------------------

type LevelProps = {
  nodes: TreeNode[];
  droppableId: string;
  depth: number;
  isDragDisabled: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

function CategoryTreeLevel({ nodes, droppableId, depth, isDragDisabled, expandedIds, onToggle, onEdit, onDelete }: LevelProps) {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          style={{
            minHeight: snapshot.isDraggingOver ? 40 : undefined,
            backgroundColor: snapshot.isDraggingOver ? 'rgba(22, 119, 255, 0.06)' : undefined,
            transition: 'background-color 0.15s',
          }}
        >
          {nodes.map((node, i) => (
            <CategoryDraggableNode
              key={node.id}
              node={node}
              index={i}
              depth={depth}
              isDragDisabled={isDragDisabled}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

// ----------------------------------------------------------------------
// Main view
// ----------------------------------------------------------------------

export default function CategoryListView() {
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const [flatData, setFlatData] = useState<ICategory[]>([]);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [filterName, setFilterName] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getAllCategories();
      setFlatData(data);
      setTreeData(buildTree(data));
      setExpandedIds(new Set(data.map((c) => c.id)));
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Không thể tải danh mục', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // When searching, show a filtered tree (ancestors preserved, drag disabled)
  const displayTree = filterName
    ? buildTree(
        (() => {
          const lc = filterName.toLowerCase();
          const matchIds = new Set(flatData.filter((c) => c.name.toLowerCase().includes(lc)).map((c) => c.id));
          // include ancestors
          let changed = true;
          while (changed) {
            changed = false;
            flatData.forEach((c) => {
              if (matchIds.has(c.id) && c.parentCategoryId && !matchIds.has(c.parentCategoryId)) {
                matchIds.add(c.parentCategoryId);
                changed = true;
              }
            });
          }
          return flatData.filter((c) => matchIds.has(c.id));
        })()
      )
    : treeData;

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleEdit = useCallback(
    (id: string) => router.push(paths.dashboard.pos.category.edit(id)),
    [router]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteCategory(pendingDeleteId);
      enqueueSnackbar('Xóa thành công!');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xóa thất bại', { variant: 'error' });
    } finally {
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, enqueueSnackbar, fetchData]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newParentId = destination.droppableId === 'root' ? null : destination.droppableId;
    const draggedNode = flattenTree(treeData).find((n) => n.id === draggableId);
    if (!draggedNode) return;

    // Optimistic update
    const { tree: withoutNode, removed } = removeNodeFromTree(treeData, draggableId);
    if (!removed) return;
    const updatedNode = { ...removed, parentCategoryId: newParentId ?? undefined };
    setTreeData(insertNodeIntoTree(withoutNode, updatedNode, newParentId, destination.index));

    try {
      await updateCategory(draggableId, {
        name: draggedNode.name,
        description: draggedNode.description,
        parentCategoryId: newParentId ?? undefined,
        sortOrder: destination.index,
        imageUrl: draggedNode.imageUrl,
        isActive: draggedNode.isActive,
      });
      enqueueSnackbar('Đã cập nhật!');
      fetchData();
    } catch {
      enqueueSnackbar('Cập nhật thất bại', { variant: 'error' });
      fetchData();
    }
  }, [treeData, enqueueSnackbar, fetchData]);

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
            <Button
              component={RouterLink}
              href={paths.dashboard.pos.category.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Thêm danh mục
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Card>
          {/* Toolbar */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <TextField
              size="small"
              placeholder="Tìm danh mục..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 260 }}
            />
            <Box sx={{ flexGrow: 1 }} />
            {filterName && (
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Kéo thả bị tắt khi đang tìm kiếm
              </Typography>
            )}
            <Tooltip title="Mở rộng tất cả">
              <IconButton size="small" onClick={() => setExpandedIds(new Set(flatData.map((c) => c.id)))}>
                <Iconify icon="eva:expand-fill" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Thu gọn tất cả">
              <IconButton size="small" onClick={() => setExpandedIds(new Set())}>
                <Iconify icon="eva:collapse-fill" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Tree */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <CategoryTreeLevel
              nodes={displayTree}
              droppableId="root"
              depth={0}
              isDragDisabled={!!filterName}
              expandedIds={expandedIds}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={(id) => setPendingDeleteId(id)}
            />
          </DragDropContext>

          {displayTree.length === 0 && (
            <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
              <Typography variant="body2">Không có danh mục nào</Typography>
            </Box>
          )}
        </Card>
      </Container>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        title="Xóa danh mục"
        content="Bạn có chắc muốn xóa danh mục này?"
        action={
          <Button variant="contained" color="error" onClick={handleConfirmDelete}>
            Xóa
          </Button>
        }
      />
    </>
  );
}
