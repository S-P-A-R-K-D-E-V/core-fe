'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';
import { useSnackbar } from 'src/components/snackbar';

import type { ICleaningWeekCell } from 'src/types/corecms-api';
import { getCleaningWeekOverview } from 'src/api/cleaning';

import CleaningReviewDialog from '../cleaning-review-dialog';

// ----------------------------------------------------------------------

const BLOCKS = [
  { value: 'Morning', label: 'Sáng' },
  { value: 'Afternoon', label: 'Chiều' },
  { value: 'Evening', label: 'Tối' },
];

// ----------------------------------------------------------------------

export default function CleaningWeekOverviewView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cells, setCells] = useState<ICleaningWeekCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; date: Date; block: string }>({
    open: false,
    date: new Date(),
    block: 'Morning',
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const fromDate = format(weekStart, 'yyyy-MM-dd');
      const toDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const data = await getCleaningWeekOverview(fromDate, toDate);
      setCells(data);
    } catch (error) {
      console.error('Error fetching cleaning week overview:', error);
      enqueueSnackbar('Không thể tải lịch theo dõi tuần', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [weekStart, enqueueSnackbar]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const cellFor = (date: Date, block: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return cells.find((c) => c.date === dateStr && c.cleaningBlock === block);
  };

  const handleOpenReview = (date: Date, block: string) => {
    setReviewDialog({ open: true, date, block });
  };

  const handleCloseReview = () => setReviewDialog((d) => ({ ...d, open: false }));

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Theo dõi tuần"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Theo dõi tuần' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <IconButton onClick={() => setWeekStart((d) => addDays(d, -7))}>
            <Iconify icon="eva:arrow-ios-back-fill" />
          </IconButton>
          <Typography variant="subtitle1" className="capitalize">
            {format(weekStart, 'dd/MM/yyyy')} – {format(addDays(weekStart, 6), 'dd/MM/yyyy')}
          </Typography>
          <IconButton onClick={() => setWeekStart((d) => addDays(d, 7))}>
            <Iconify icon="eva:arrow-ios-forward-fill" />
          </IconButton>
        </Stack>
      </Card>

      <Card>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 10 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer sx={{ position: 'relative', overflow: 'unset' }}>
            <Scrollbar>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 90 }}>Ca</TableCell>
                    {days.map((d) => (
                      <TableCell key={d.toISOString()} align="center">
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }} className="capitalize">
                          {format(d, 'EEEE', { locale: viLocale })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(d, 'dd/MM')}
                        </Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {BLOCKS.map((block) => (
                    <TableRow key={block.value}>
                      <TableCell sx={{ fontWeight: 600 }}>{block.label}</TableCell>
                      {days.map((d) => {
                        const cell = cellFor(d, block.value);
                        const total = cell
                          ? cell.pendingCount + cell.doneCount + cell.passedCount + cell.failedCount
                          : 0;
                        return (
                          <TableCell
                            key={`${d.toISOString()}-${block.value}`}
                            onClick={() => handleOpenReview(d, block.value)}
                            sx={{
                              cursor: 'pointer',
                              verticalAlign: 'top',
                              minWidth: 130,
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            {cell && cell.staffNames.length > 0 ? (
                              <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                {cell.staffNames.join(', ')}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.5 }}>
                                Chưa có ai
                              </Typography>
                            )}
                            {total > 0 && (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {cell!.passedCount > 0 && (
                                  <Chip size="small" color="success" label={`${cell!.passedCount} đạt`} />
                                )}
                                {cell!.failedCount > 0 && (
                                  <Chip size="small" color="error" label={`${cell!.failedCount} không đạt`} />
                                )}
                                {cell!.doneCount > 0 && (
                                  <Chip size="small" color="info" label={`${cell!.doneCount} chờ chấm`} />
                                )}
                                {cell!.pendingCount > 0 && (
                                  <Chip size="small" label={`${cell!.pendingCount} chưa làm`} />
                                )}
                              </Stack>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        )}
      </Card>

      <CleaningReviewDialog
        open={reviewDialog.open}
        date={reviewDialog.date}
        block={reviewDialog.block}
        onClose={handleCloseReview}
        onChanged={fetchOverview}
      />
    </Container>
  );
}
