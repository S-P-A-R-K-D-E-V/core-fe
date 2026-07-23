'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';
import { useBoolean } from 'src/hooks/use-boolean';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Lightbox, { useLightBox } from 'src/components/lightbox';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import { parseDateStr, toDateStr } from 'src/utils/format-time';
import { getStorageUrl } from 'src/utils/storage';

import type {
  IChatAttachmentMedia,
  ICleaningPhotoMedia,
  IUserAvatarMedia,
  IUserIdCardMedia,
} from 'src/types/corecms-api';
import {
  deleteChatAttachment,
  deleteCleaningPhoto,
  deleteUserAvatar,
  deleteUserIdCard,
  getChatAttachments,
  getCleaningPhotos,
  getUserAvatars,
  getUserIdCards,
} from 'src/api/mediaLibrary';

// ----------------------------------------------------------------------

const PAGE_SIZE = 24;

const BLOCK_LABEL: Record<string, string> = { Morning: 'Sáng', Afternoon: 'Chiều', Evening: 'Tối' };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ----------------------------------------------------------------------

function MediaCard({
  imgSrc,
  onPreview,
  title,
  subtitle,
  caption,
  onDelete,
}: {
  imgSrc?: string;
  onPreview?: () => void;
  title: string;
  subtitle?: string;
  caption?: string;
  onDelete: () => void;
}) {
  return (
    <Card sx={{ overflow: 'hidden' }}>
      <Box
        onClick={onPreview}
        sx={{
          position: 'relative',
          pt: '75%',
          bgcolor: 'background.neutral',
          cursor: imgSrc ? 'pointer' : 'default',
        }}
      >
        {imgSrc ? (
          <Box
            component="img"
            src={imgSrc}
            sx={{ position: 'absolute', inset: 0, width: 1, height: 1, objectFit: 'cover' }}
          />
        ) : (
          <Iconify
            icon="eva:file-text-fill"
            sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 40, height: 40, color: 'text.disabled' }}
          />
        )}
      </Box>
      <Stack spacing={0.25} sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" noWrap title={title}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap title={subtitle}>
            {subtitle}
          </Typography>
        )}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {caption && (
            <Typography variant="caption" color="text.disabled">
              {caption}
            </Typography>
          )}
          <Tooltip title="Xoá vĩnh viễn">
            <IconButton size="small" color="error" onClick={onDelete} sx={{ ml: 'auto' }}>
              <Iconify icon="eva:trash-2-outline" width={18} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Card>
  );
}

function MediaGrid({ children, loading, empty }: { children: React.ReactNode; loading: boolean; empty: boolean }) {
  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }
  if (empty) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
        <Typography variant="body2" color="text.secondary">
          Không có media nào.
        </Typography>
      </Stack>
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(6, 1fr)' },
      }}
    >
      {children}
    </Box>
  );
}

// ----------------------------------------------------------------------

function CleaningPhotosTab() {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useBoolean();
  const [items, setItems] = useState<ICleaningPhotoMedia[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ICleaningPhotoMedia | null>(null);

  const slides = items.map((p) => ({ src: getStorageUrl(p.objectKey) }));
  const lightbox = useLightBox(slides);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCleaningPhotos({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        pageNumber: page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      enqueueSnackbar('Không thể tải ảnh vệ sinh', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, page, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCleaningPhoto(deleteTarget.id);
      enqueueSnackbar('Đã xoá ảnh');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    } finally {
      setDeleteTarget(null);
      confirm.onFalse();
    }
  };

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <DatePicker
          label="Từ ngày"
          value={fromDate ? parseDateStr(fromDate) : null}
          onChange={(val) => { setFromDate(val ? toDateStr(val) : null); setPage(1); }}
          format="dd/MM/yyyy"
          slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } }, field: { clearable: true } }}
        />
        <DatePicker
          label="Đến ngày"
          value={toDate ? parseDateStr(toDate) : null}
          onChange={(val) => { setToDate(val ? toDateStr(val) : null); setPage(1); }}
          format="dd/MM/yyyy"
          slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } }, field: { clearable: true } }}
        />
      </Stack>

      <MediaGrid loading={loading} empty={items.length === 0}>
        {items.map((item) => (
          <MediaCard
            key={item.id}
            imgSrc={getStorageUrl(item.objectKey)}
            onPreview={() => lightbox.onOpen(getStorageUrl(item.objectKey))}
            title={item.taskName}
            subtitle={item.area || undefined}
            caption={`${item.taskDate} · ${BLOCK_LABEL[item.cleaningBlock] || item.cleaningBlock}`}
            onDelete={() => { setDeleteTarget(item); confirm.onTrue(); }}
          />
        ))}
      </MediaGrid>

      {totalCount > PAGE_SIZE && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination
            count={Math.ceil(totalCount / PAGE_SIZE)}
            page={page}
            onChange={(_, v) => setPage(v)}
          />
        </Stack>
      )}

      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />

      <ConfirmDialog
        open={confirm.value}
        onClose={() => { confirm.onFalse(); setDeleteTarget(null); }}
        title="Xoá ảnh minh chứng"
        content="Ảnh sẽ bị xoá vĩnh viễn khỏi hệ thống, không thể khôi phục. Bạn có chắc chắn?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xoá
          </Button>
        }
      />
    </>
  );
}

function ChatAttachmentsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useBoolean();
  const [items, setItems] = useState<IChatAttachmentMedia[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IChatAttachmentMedia | null>(null);

  const imageItems = items.filter((i) => i.kind === 'image');
  const slides = imageItems.map((p) => ({ src: getStorageUrl(p.objectKey) }));
  const lightbox = useLightBox(slides);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getChatAttachments({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        pageNumber: page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      enqueueSnackbar('Không thể tải tệp đính kèm chat', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, page, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChatAttachment(deleteTarget.messageId, deleteTarget.objectKey);
      enqueueSnackbar('Đã xoá tệp đính kèm');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    } finally {
      setDeleteTarget(null);
      confirm.onFalse();
    }
  };

  return (
    <>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <DatePicker
          label="Từ ngày"
          value={fromDate ? parseDateStr(fromDate) : null}
          onChange={(val) => { setFromDate(val ? toDateStr(val) : null); setPage(1); }}
          format="dd/MM/yyyy"
          slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } }, field: { clearable: true } }}
        />
        <DatePicker
          label="Đến ngày"
          value={toDate ? parseDateStr(toDate) : null}
          onChange={(val) => { setToDate(val ? toDateStr(val) : null); setPage(1); }}
          format="dd/MM/yyyy"
          slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } }, field: { clearable: true } }}
        />
      </Stack>

      <MediaGrid loading={loading} empty={items.length === 0}>
        {items.map((item) => (
          <MediaCard
            key={item.messageId + item.objectKey}
            imgSrc={item.kind === 'image' ? getStorageUrl(item.objectKey) : undefined}
            onPreview={
              item.kind === 'image'
                ? () => lightbox.onOpen(getStorageUrl(item.objectKey))
                : undefined
            }
            title={item.fileName}
            subtitle={item.senderName || undefined}
            caption={`${new Date(item.createdAt).toLocaleDateString('vi-VN')} · ${formatBytes(item.sizeBytes)}`}
            onDelete={() => { setDeleteTarget(item); confirm.onTrue(); }}
          />
        ))}
      </MediaGrid>

      {totalCount > PAGE_SIZE && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination
            count={Math.ceil(totalCount / PAGE_SIZE)}
            page={page}
            onChange={(_, v) => setPage(v)}
          />
        </Stack>
      )}

      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />

      <ConfirmDialog
        open={confirm.value}
        onClose={() => { confirm.onFalse(); setDeleteTarget(null); }}
        title="Xoá tệp đính kèm"
        content="Tệp sẽ bị xoá vĩnh viễn khỏi hệ thống và khỏi tin nhắn, không thể khôi phục. Bạn có chắc chắn?"
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xoá
          </Button>
        }
      />
    </>
  );
}

function UserAvatarsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useBoolean();
  const [items, setItems] = useState<IUserAvatarMedia[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<IUserAvatarMedia | null>(null);

  const slides = items.map((p) => ({ src: getStorageUrl(p.objectKey) }));
  const lightbox = useLightBox(slides);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getUserAvatars({ search: search || undefined, pageNumber: page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      enqueueSnackbar('Không thể tải avatar', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, page, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUserAvatar(deleteTarget.userId);
      enqueueSnackbar('Đã xoá avatar');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    } finally {
      setDeleteTarget(null);
      confirm.onFalse();
    }
  };

  return (
    <>
      <TextField
        placeholder="Tìm theo tên nhân viên..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        sx={{ mb: 3, width: { xs: 1, md: 320 } }}
      />

      <MediaGrid loading={loading} empty={items.length === 0}>
        {items.map((item) => (
          <MediaCard
            key={item.userId}
            imgSrc={getStorageUrl(item.objectKey)}
            onPreview={() => lightbox.onOpen(getStorageUrl(item.objectKey))}
            title={item.fullName}
            onDelete={() => { setDeleteTarget(item); confirm.onTrue(); }}
          />
        ))}
      </MediaGrid>

      {totalCount > PAGE_SIZE && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={Math.ceil(totalCount / PAGE_SIZE)} page={page} onChange={(_, v) => setPage(v)} />
        </Stack>
      )}

      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />

      <ConfirmDialog
        open={confirm.value}
        onClose={() => { confirm.onFalse(); setDeleteTarget(null); }}
        title="Xoá avatar"
        content={`Xoá ảnh đại diện của ${deleteTarget?.fullName}? Không thể khôi phục.`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xoá
          </Button>
        }
      />
    </>
  );
}

function UserIdCardsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useBoolean();
  const [items, setItems] = useState<IUserIdCardMedia[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ item: IUserIdCardMedia; side: 'front' | 'back' } | null>(null);

  const allKeys = items.flatMap((i) => [i.frontObjectKey, i.backObjectKey].filter(Boolean) as string[]);
  const slides = allKeys.map((key) => ({ src: getStorageUrl(key) }));
  const lightbox = useLightBox(slides);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getUserIdCards({ search: search || undefined, pageNumber: page, pageSize: PAGE_SIZE });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      enqueueSnackbar('Không thể tải ảnh CCCD', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, page, enqueueSnackbar]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUserIdCard(deleteTarget.item.userId, deleteTarget.side);
      enqueueSnackbar('Đã xoá ảnh CCCD');
      fetchData();
    } catch (error) {
      enqueueSnackbar('Xoá thất bại', { variant: 'error' });
    } finally {
      setDeleteTarget(null);
      confirm.onFalse();
    }
  };

  return (
    <>
      <TextField
        placeholder="Tìm theo tên nhân viên..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        sx={{ mb: 3, width: { xs: 1, md: 320 } }}
      />

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      ) : items.length === 0 ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
          <Typography variant="body2" color="text.secondary">Không có media nào.</Typography>
        </Stack>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
          {items.map((item) => (
            <Card key={item.userId} sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{item.fullName}</Typography>
              <Stack direction="row" spacing={1.5}>
                {(['front', 'back'] as const).map((side) => {
                  const key = side === 'front' ? item.frontObjectKey : item.backObjectKey;
                  return (
                    <Box key={side} sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {side === 'front' ? 'Mặt trước' : 'Mặt sau'}
                      </Typography>
                      {key ? (
                        <Box sx={{ position: 'relative' }}>
                          <Box
                            component="img"
                            src={getStorageUrl(key)}
                            onClick={() => lightbox.onOpen(getStorageUrl(key))}
                            sx={{ width: 1, aspectRatio: '4/3', objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => { setDeleteTarget({ item, side }); confirm.onTrue(); }}
                            sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}
                          >
                            <Iconify icon="eva:trash-2-outline" width={16} />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box sx={{ width: 1, aspectRatio: '4/3', borderRadius: 1, bgcolor: 'background.neutral', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography variant="caption" color="text.disabled">Chưa có</Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Card>
          ))}
        </Box>
      )}

      {totalCount > PAGE_SIZE && (
        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination count={Math.ceil(totalCount / PAGE_SIZE)} page={page} onChange={(_, v) => setPage(v)} />
        </Stack>
      )}

      <Lightbox index={lightbox.selected} slides={slides} open={lightbox.open} close={lightbox.onClose} />

      <ConfirmDialog
        open={confirm.value}
        onClose={() => { confirm.onFalse(); setDeleteTarget(null); }}
        title="Xoá ảnh CCCD"
        content={`Xoá ảnh CCCD (${deleteTarget?.side === 'front' ? 'mặt trước' : 'mặt sau'}) của ${deleteTarget?.item.fullName}? Không thể khôi phục.`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xoá
          </Button>
        }
      />
    </>
  );
}

// ----------------------------------------------------------------------

export default function MediaLibraryView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState<'cleaning' | 'chat' | 'avatars' | 'idCards'>('cleaning');

  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <Container maxWidth={settings.themeStretch ? false : 'xl'}>
        <CustomBreadcrumbs
          heading="Thư viện Media"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Thư viện Media' },
          ]}
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab value="cleaning" label="Ảnh vệ sinh" />
          <Tab value="chat" label="Ảnh/tệp chat" />
          <Tab value="avatars" label="Avatar" />
          <Tab value="idCards" label="CCCD" />
        </Tabs>

        {tab === 'cleaning' && <CleaningPhotosTab />}
        {tab === 'chat' && <ChatAttachmentsTab />}
        {tab === 'avatars' && <UserAvatarsTab />}
        {tab === 'idCards' && <UserIdCardsTab />}
      </Container>
    </RoleBasedGuard>
  );
}
