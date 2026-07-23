'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { addDays, format, startOfWeek } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import type { CleaningShiftBlock, ICleaningTaskDefinition, ICleaningTemplateWeekCell } from 'src/types/corecms-api';
import {
  createCleaningTaskTemplate,
  deleteCleaningTaskTemplate,
  duplicateCleaningWeek,
  getCleaningTaskDefinitions,
  getCleaningTemplateWeek,
} from 'src/api/cleaning';

// ----------------------------------------------------------------------

const BLOCKS: CleaningShiftBlock[] = ['Morning', 'Afternoon', 'Evening'];
const BLOCK_LABEL: Record<CleaningShiftBlock, string> = { Morning: 'Sáng', Afternoon: 'Chiều', Evening: 'Tối' };

// ----------------------------------------------------------------------

export default function CleaningWeekBuilderView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [definitions, setDefinitions] = useState<ICleaningTaskDefinition[]>([]);
  const [cells, setCells] = useState<ICleaningTemplateWeekCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isPastDay = (day: Date) => format(day, 'yyyy-MM-dd') < todayStr;
  // Tuần kế tiếp (WeekStart+7..+13) hoàn toàn nằm ở quá khứ - không còn gì để nhân bản.
  const nextWeekEntirelyPast = format(addDays(weekStart, 13), 'yyyy-MM-dd') < todayStr;

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [defs, week] = await Promise.all([
        getCleaningTaskDefinitions(),
        getCleaningTemplateWeek(weekStartStr),
      ]);
      setDefinitions(defs.filter((d) => d.isActive));
      setCells(week);
    } catch (error) {
      console.error('Error loading week builder:', error);
      enqueueSnackbar('Không thể tải dữ liệu checklist tuần', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [weekStartStr, enqueueSnackbar]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const cellFor = (date: Date, block: CleaningShiftBlock) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return cells.find((c) => c.date === dateStr && c.cleaningBlock === block);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination || !destination.droppableId.startsWith('cell:')) return;

    const [, dateStr, block] = destination.droppableId.split(':');
    const definition = definitions.find((d) => d.id === draggableId);
    if (!definition) return;

    const day = new Date(`${dateStr}T00:00:00`);
    if (isPastDay(day)) return; // an toàn thứ 2 - Droppable của ngày quá khứ đã bị vô hiệu hoá

    const existing = cellFor(day, block as CleaningShiftBlock);
    const nextSortOrder = existing ? existing.templates.length : 0;

    try {
      await createCleaningTaskTemplate({
        dayOfWeek: format(day, 'EEEE'),
        cleaningBlock: block,
        name: definition.name,
        area: definition.area || undefined,
        sortOrder: nextSortOrder,
        fromDate: weekStartStr,
      });
      fetchAll();
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Không thể thêm đầu việc vào ca này', { variant: 'error' });
    }
  };

  const handleRemove = async (templateId: string) => {
    try {
      await deleteCleaningTaskTemplate(templateId);
      fetchAll();
    } catch (error: any) {
      enqueueSnackbar(
        error?.title || 'Không thể xoá — đầu việc đã có lịch sử, hãy vào trang Checklist để chuyển sang Ngưng áp dụng',
        { variant: 'error' }
      );
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const { createdCount } = await duplicateCleaningWeek(weekStartStr);
      enqueueSnackbar(
        createdCount > 0
          ? `Đã nhân bản ${createdCount} đầu việc sang tuần sau`
          : 'Tuần sau đã có đủ checklist (các đầu việc lặp vô thời hạn không cần nhân bản)'
      );
    } catch (error: any) {
      enqueueSnackbar(error?.title || 'Không thể nhân bản', { variant: 'error' });
    } finally {
      setDuplicating(false);
    }
  };

  const handleCapture = async () => {
    if (!gridRef.current) return;
    setCapturing(true);
    try {
      // Chụp thẳng node lưới (không phải Card bọc overflow:auto) để luôn ra đủ Thứ Hai → Chủ nhật
      // và đủ 3 ca dù đang cuộn ngang tới đâu trên màn hình.
      const dataUrl = await toPng(gridRef.current, {
        backgroundColor: theme.palette.background.paper,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `checklist-ve-sinh-${weekStartStr}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error capturing week checklist:', error);
      enqueueSnackbar('Không thể chụp lịch tuần', { variant: 'error' });
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Xây dựng checklist tuần"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Xây dựng checklist' },
        ]}
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="solar:camera-bold" />}
              loading={capturing}
              onClick={handleCapture}
            >
              Chụp lịch tuần
            </Button>
            <Button
              variant="outlined"
              startIcon={<Iconify icon="eva:copy-outline" />}
              loading={duplicating}
              disabled={nextWeekEntirelyPast}
              onClick={handleDuplicate}
            >
              Nhân bản sang tuần sau
            </Button>
          </Stack>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton onClick={() => setWeekStart((d) => addDays(d, -7))}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>
          <Typography variant="subtitle1">
            {format(weekStart, 'dd/MM/yyyy')} – {format(addDays(weekStart, 6), 'dd/MM/yyyy')}
          </Typography>
          <IconButton onClick={() => setWeekStart((d) => addDays(d, 7))}>
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>
        </Stack>
      </Card>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Thư viện đầu việc
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Kéo 1 đầu việc vào ô ca bên phải để gán cho tuần này (và các tuần sau).
                </Typography>
                <Droppable droppableId="library" type="TASK" isDropDisabled>
                  {(provided) => (
                    <Stack
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      spacing={1}
                      sx={{ maxHeight: { xs: 400, md: 'calc(100vh - 320px)' }, overflowY: 'auto', pr: 0.5 }}
                    >
                      {definitions.map((definition, index) => (
                        <Draggable key={definition.id} draggableId={definition.id} index={index}>
                          {(dragProvided, snapshot) => {
                            const content = (
                              <Box
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  p: 1,
                                  borderRadius: 1,
                                  border: '1px solid',
                                  borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
                                  bgcolor: 'background.paper',
                                  boxShadow: snapshot.isDragging ? '0 12px 24px rgba(0,0,0,0.2)' : 'none',
                                  cursor: 'grab',
                                }}
                              >
                                <Iconify icon="mdi:drag" width={16} sx={{ color: 'text.disabled', flexShrink: 0 }} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                                    {definition.name}
                                  </Typography>
                                  {definition.area && (
                                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                      {definition.area}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                            // Kéo qua Card có overflow:auto (lưới bên phải) sẽ bị clip nếu render tại chỗ -
                            // thoát ra document.body trong lúc đang kéo để preview luôn hiển thị đúng.
                            return snapshot.isDragging ? createPortal(content, document.body) : content;
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {definitions.length === 0 && (
                        <Typography variant="caption" color="text.disabled">
                          Thư viện trống — vào trang "Thư viện đầu việc" để thêm.
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Droppable>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 9 }}>
              <Card sx={{ p: 2, overflow: 'auto' }}>
                <Box
                  ref={gridRef}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '70px repeat(7, minmax(170px, 1fr))',
                    gap: 1,
                    minWidth: 1300,
                    bgcolor: 'background.paper',
                    p: 1,
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{ gridColumn: '1 / -1', textAlign: 'center', mb: 1 }}
                  >
                    Checklist vệ sinh: {format(weekStart, 'dd/MM/yyyy')} – {format(addDays(weekStart, 6), 'dd/MM/yyyy')}
                  </Typography>
                  <Box />
                  {days.map((day) => (
                    <Box key={day.toISOString()} sx={{ textAlign: 'center', opacity: isPastDay(day) ? 0.5 : 1 }}>
                      <Typography variant="caption" fontWeight={600} className="capitalize" sx={{ display: 'block' }}>
                        {format(day, 'EEEE', { locale: viLocale })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(day, 'dd/MM')}
                        {isPastDay(day) ? ' (đã qua)' : ''}
                      </Typography>
                    </Box>
                  ))}

                  {BLOCKS.map((block) => (
                    <Box key={block} sx={{ display: 'contents' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 1 }}>
                        <Typography variant="subtitle2">{BLOCK_LABEL[block]}</Typography>
                      </Box>
                      {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const cell = cellFor(day, block);
                        const past = isPastDay(day);
                        return (
                          <Droppable
                            key={`${dateStr}-${block}`}
                            droppableId={`cell:${dateStr}:${block}`}
                            type="TASK"
                            isDropDisabled={past}
                          >
                            {(provided, snapshot) => (
                              <Box
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                sx={{
                                  minHeight: 96,
                                  p: 0.75,
                                  borderRadius: 1,
                                  border: '2px dashed',
                                  borderColor: snapshot.isDraggingOver ? 'primary.main' : 'divider',
                                  bgcolor: past
                                    ? 'action.disabledBackground'
                                    : snapshot.isDraggingOver
                                      ? alpha('#00A76F', 0.08)
                                      : 'transparent',
                                  opacity: past ? 0.6 : 1,
                                  transition: 'all 0.15s',
                                }}
                              >
                                <Stack spacing={0.5}>
                                  {(cell?.templates || []).map((template) => (
                                    <Box
                                      key={template.id}
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 0.5,
                                        p: 0.75,
                                        borderRadius: 1,
                                        bgcolor: (theme) => alpha(theme.palette.info.main, 0.12),
                                        border: '1px solid',
                                        borderColor: (theme) => alpha(theme.palette.info.main, 0.24),
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.3, color: 'info.darker' }}
                                      >
                                        {template.name}
                                      </Typography>
                                      {!past && (
                                        <Tooltip title="Bỏ khỏi ca này">
                                          <IconButton
                                            size="small"
                                            onClick={() => handleRemove(template.id)}
                                            sx={{ p: 0.25, color: 'info.dark', flexShrink: 0 }}
                                          >
                                            <Iconify icon="eva:close-fill" width={14} />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                  ))}
                                  {(cell?.templates || []).length === 0 && !past && (
                                    <Typography
                                      variant="caption"
                                      color="text.disabled"
                                      sx={{ textAlign: 'center', py: 1.5 }}
                                    >
                                      Kéo đầu việc vào đây
                                    </Typography>
                                  )}
                                </Stack>
                                {provided.placeholder}
                              </Box>
                            )}
                          </Droppable>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Card>
            </Grid>
          </Grid>
        </DragDropContext>
      )}
    </Container>
  );
}
