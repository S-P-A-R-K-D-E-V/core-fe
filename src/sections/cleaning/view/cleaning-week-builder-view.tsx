'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { addDays, format, startOfWeek } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
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

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [definitions, setDefinitions] = useState<ICleaningTaskDefinition[]>([]);
  const [cells, setCells] = useState<ICleaningTemplateWeekCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

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
          <Button
            variant="outlined"
            startIcon={<Iconify icon="eva:copy-outline" />}
            loading={duplicating}
            onClick={handleDuplicate}
          >
            Nhân bản sang tuần sau
          </Button>
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
                    <Stack ref={provided.innerRef} {...provided.droppableProps} spacing={1}>
                      {definitions.map((definition, index) => (
                        <Draggable key={definition.id} draggableId={definition.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <Box
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: snapshot.isDragging ? 'action.selected' : 'background.paper',
                                cursor: 'grab',
                              }}
                            >
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {definition.name}
                              </Typography>
                              {definition.area && (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {definition.area}
                                </Typography>
                              )}
                            </Box>
                          )}
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
                <Box sx={{ display: 'grid', gridTemplateColumns: '70px repeat(7, minmax(140px, 1fr))', gap: 1, minWidth: 1000 }}>
                  <Box />
                  {days.map((day) => (
                    <Box key={day.toISOString()} sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" fontWeight={600} className="capitalize" sx={{ display: 'block' }}>
                        {format(day, 'EEEE', { locale: viLocale })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(day, 'dd/MM')}
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
                        return (
                          <Droppable key={`${dateStr}-${block}`} droppableId={`cell:${dateStr}:${block}`} type="TASK">
                            {(provided, snapshot) => (
                              <Box
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                sx={{
                                  minHeight: 90,
                                  p: 1,
                                  borderRadius: 1,
                                  border: '2px dashed',
                                  borderColor: snapshot.isDraggingOver ? 'primary.main' : 'divider',
                                  bgcolor: snapshot.isDraggingOver ? alpha('#00A76F', 0.08) : 'transparent',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <Stack spacing={0.5}>
                                  {(cell?.templates || []).map((template) => (
                                    <Chip
                                      key={template.id}
                                      size="small"
                                      label={template.name}
                                      onDelete={() => handleRemove(template.id)}
                                      sx={{ justifyContent: 'flex-start', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                                    />
                                  ))}
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
