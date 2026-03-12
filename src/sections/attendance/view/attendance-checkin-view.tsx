'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';

import { paths } from 'src/routes/paths';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import Iconify from 'src/components/iconify';
import Label from 'src/components/label';

import { useAuthContext } from 'src/auth/hooks';

import { IShiftAssignment, IAttendanceLog } from 'src/types/corecms-api';
import {
  getMySchedule,
  getMyAttendanceLogs,
  checkIn,
  checkOut,
} from 'src/api/attendance';

// ----------------------------------------------------------------------

export default function AttendanceCheckinView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();

  const [todayAssignments, setTodayAssignments] = useState<IShiftAssignment[]>([]);
  const [todayLogs, setTodayLogs] = useState<IAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [geoLocation, setGeoLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Get geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          setGeoError('Unable to get GPS location. Check browser permissions.');
          console.error('Geolocation error:', error);
        }
      );
    } else {
      setGeoError('Geolocation is not supported by this browser.');
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignments, logs] = await Promise.all([
        getMySchedule(today, today),
        getMyAttendanceLogs(today, today),
      ]);
      setTodayAssignments(assignments);
      setTodayLogs(logs);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getLogForAssignment = (assignmentId: string) =>
    todayLogs.find((log) => log.shiftAssignmentId === assignmentId && !log.checkOutTime);

  const getCompletedLogs = (assignmentId: string) =>
    todayLogs.filter((log) => log.shiftAssignmentId === assignmentId);

  const handleCheckIn = async (assignmentId: string, isOvertime: boolean = false) => {
    console.log('Check-in data:', {
      assignmentId,
      isOvertime,
      geoLocation,
    });
    try {
      setActionLoading(assignmentId || 'overtime');
      await checkIn({
        shiftAssignmentId: isOvertime ? undefined : assignmentId,
        isOvertime,
        latitude: geoLocation?.lat,
        longitude: geoLocation?.lng,
        ipAddress: undefined,
        wifiName: undefined,
        faceVerified: false,
      });
      enqueueSnackbar(
        isOvertime ? 'Overtime check-in successful!' : 'Check-in successful!',
        { variant: 'success' }
      );
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Check-in failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckOut = async (logId: string) => {
    try {
      setActionLoading(logId);
      await checkOut({
        attendanceLogId: logId,
        latitude: geoLocation?.lat,
        longitude: geoLocation?.lng,
        ipAddress: undefined,
        wifiName: undefined,
        faceVerified: false,
      });
      enqueueSnackbar('Check-out successful!', { variant: 'success' });
      fetchData();
    } catch (error: any) {
      console.error(error);
      const msg = error?.title || error?.message || 'Check-out failed!';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Check In / Check Out"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Attendance' },
          { name: 'Check In/Out' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {/* GPS Status */}
      {geoError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {geoError}
        </Alert>
      )}

      {geoLocation && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<Iconify icon="mdi:map-marker" />}>
          GPS Location: {geoLocation.lat.toFixed(6)}, {geoLocation.lng.toFixed(6)}
        </Alert>
      )}

      {/* Current Time */}
      <Card sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="h4">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Typography>
        <Typography variant="h2" color="primary" sx={{ mt: 1 }}>
          <CurrentTime />
        </Typography>
      </Card>

      {loading && (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      )}

      {!loading && todayAssignments.length === 0 && (
        <Stack spacing={2}>
          <Alert severity="info">No shifts assigned to you for today.</Alert>

          {/* Overtime Check-in */}
          <Card sx={{ p: 3, bgcolor: 'warning.lighter' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6" color="warning.darker">
                  Check In as Overtime
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  For work outside scheduled shifts (overtime will be paid at 1.5x rate)
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={
                  actionLoading === 'overtime' ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Iconify icon="mdi:clock-plus-outline" />
                  )
                }
                onClick={() => handleCheckIn('', true)}
                disabled={!!actionLoading}
              >
                Overtime Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}

      {!loading && todayAssignments.length > 0 && (
        <Stack spacing={3}>
          {todayAssignments.map((assignment) => {
            const openLog = getLogForAssignment(assignment.assignmentId);
            const completedLogs = getCompletedLogs(assignment.assignmentId);
            const isLoading = actionLoading === assignment.assignmentId || actionLoading === openLog?.id;

            return (
              <Card key={assignment.id} sx={{ p: 3 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                  <Box>
                    <Typography variant="h6">{assignment.shiftName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignment.startTime} - {assignment.endTime}
                    </Typography>
                    {assignment.note && (
                      <Typography variant="caption" color="text.secondary">
                        Note: {assignment.note}
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Label variant="soft" color={assignment.shiftType === 'Extra' ? 'warning' : 'info'}>
                      {assignment.shiftType}
                    </Label>

                    {openLog ? (
                      <Button
                        variant="contained"
                        color="error"
                        size="large"
                        startIcon={
                          isLoading ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Iconify icon="mdi:logout" />
                          )
                        }
                        onClick={() => handleCheckOut(openLog.id)}
                        disabled={!!isLoading}
                      >
                        Check Out
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        size="large"
                        startIcon={
                          isLoading ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <Iconify icon="mdi:login" />
                          )
                        }
                        onClick={() => handleCheckIn(assignment.assignmentId)}
                        disabled={!!isLoading}
                      >
                        Check In
                      </Button>
                    )}
                  </Stack>
                </Stack>

                {/* Show logs for this assignment */}
                {completedLogs.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Attendance History:
                    </Typography>
                    <Stack spacing={1}>
                      {completedLogs.map((log) => (
                        <Stack
                          key={log.id}
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ pl: 2 }}
                        >
                          <Chip
                            size="small"
                            label={`In: ${log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('vi-VN') : '-'}`}
                            color="success"
                            variant="soft"
                          />
                          <Chip
                            size="small"
                            label={`Out: ${log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString('vi-VN') : 'Pending'}`}
                            color={log.checkOutTime ? 'info' : 'warning'}
                            variant="soft"
                          />
                          {log.isLate && (
                            <Chip
                              size="small"
                              label={`Late ${log.lateMinutes}m`}
                              color="error"
                              variant="soft"
                            />
                          )}
                          {log.isAutoClosedBySystem && (
                            <Chip size="small" label="Auto-closed" color="warning" variant="soft" />
                          )}
                          {log.workedHours != null && log.checkOutTime && (
                            <Chip
                              size="small"
                              label={`${log.workedHours.toFixed(1)}h`}
                              variant="soft"
                            />
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Card>
            );
          })}

          {/* Overtime Check-in - Always available */}
          <Card sx={{ p: 3, bgcolor: 'warning.lighter' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="h6" color="warning.darker">
                  Check In as Overtime
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  For work outside scheduled shifts (overtime will be paid at 1.5x rate)
                </Typography>
              </Box>

              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={
                  actionLoading === 'overtime' ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Iconify icon="mdi:clock-plus-outline" />
                  )
                }
                onClick={() => handleCheckIn('', true)}
                disabled={!!actionLoading}
              >
                Overtime Check In
              </Button>
            </Stack>
          </Card>
        </Stack>
      )}
    </Container>
  );
}

// Helper: live clock
function CurrentTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{time.toLocaleTimeString('vi-VN')}</>;
}
