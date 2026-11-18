import { useMemo, useState } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import Skeleton from '@mui/material/Skeleton';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import TableContainer from '@mui/material/TableContainer';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { fNumber } from 'src/utils/format-number';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAgentUsage } from 'src/api/agent-center';

import Scrollbar from 'src/components/scrollbar';
import EmptyContent from 'src/components/empty-content';
import Chart, { useChart } from 'src/components/chart';

import { shortTokens, usageChartData, usageTotalsByAgent } from './agent-center-utils';

// ----------------------------------------------------------------------
// Chi phí (agent.manage): token theo ngày theo agent từ GET agent-center/usage?days=N — cột chồng + bảng tổng.
// ----------------------------------------------------------------------

const DAY_OPTIONS = [7, 30, 90];

/** fNumber(0) trả chuỗi rỗng. */
const num = (v: number) => (v ? fNumber(v) : '0');

export default function AgentUsageTab() {
  const [days, setDays] = useState(30);
  const { rows, loading, error } = useAgentUsage(days, true);

  const { dates, series } = useMemo(() => usageChartData(rows, days), [rows, days]);
  const totals = useMemo(() => usageTotalsByAgent(rows), [rows]);
  const grand = totals.reduce(
    (acc, t) => ({
      input: acc.input + t.inputTokens,
      output: acc.output + t.outputTokens,
      tasks: acc.tasks + t.tasks,
    }),
    { input: 0, output: 0, tasks: 0 }
  );

  const chartOptions = useChart({
    chart: { stacked: true },
    plotOptions: { bar: { columnWidth: days > 30 ? '70%' : '50%' } },
    stroke: { show: false },
    legend: { show: true, position: 'top', horizontalAlign: 'right' },
    xaxis: {
      categories: dates.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
      labels: { rotate: -45, hideOverlappingLabels: true },
    },
    yaxis: { labels: { formatter: (v: number) => shortTokens(Math.round(v)) } },
    tooltip: { y: { formatter: (v: number) => `${num(v)} token` } },
  });

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="body2" sx={{ color: 'text.secondary', flexGrow: 1 }}>
          Token mỗi agent dùng theo ngày (giờ Việt Nam), gồm token vào và ra của mọi việc.
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, v: number | null) => v && setDays(v)}
        >
          {DAY_OPTIONS.map((d) => (
            <ToggleButton key={d} value={d}>
              {d} ngày
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {!!error && (
        <Alert severity="error">{apiErrorMessage(error, 'Không tải được chi phí')}</Alert>
      )}

      {loading && <Skeleton variant="rounded" height={380} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyContent
          filled
          title="Chưa có số liệu"
          description="Agent chưa chạy việc nào trong khoảng này."
          sx={{ py: 10 }}
        />
      )}

      {!loading && rows.length > 0 && (
        <>
          <Card>
            <CardHeader
              title="Token theo ngày"
              subheader={`${num(grand.input + grand.output)} token · ${num(grand.tasks)} việc trong ${days} ngày`}
            />
            <Chart
              dir="ltr"
              type="bar"
              series={series}
              options={chartOptions}
              height={360}
              sx={{ px: 1 }}
            />
          </Card>

          <Card>
            <TableContainer>
              <Scrollbar>
                <Table sx={{ minWidth: 560 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell align="right">Token vào</TableCell>
                      <TableCell align="right">Token ra</TableCell>
                      <TableCell align="right">Tổng</TableCell>
                      <TableCell align="right">Số việc</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {totals.map((t) => (
                      <TableRow key={t.agentId} hover>
                        <TableCell>{t.agentName}</TableCell>
                        <TableCell align="right">{num(t.inputTokens)}</TableCell>
                        <TableCell align="right">{num(t.outputTokens)}</TableCell>
                        <TableCell align="right">
                          <strong>{num(t.inputTokens + t.outputTokens)}</strong>
                        </TableCell>
                        <TableCell align="right">{num(t.tasks)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell>
                        <strong>Cộng</strong>
                      </TableCell>
                      <TableCell align="right">{num(grand.input)}</TableCell>
                      <TableCell align="right">{num(grand.output)}</TableCell>
                      <TableCell align="right">
                        <strong>{num(grand.input + grand.output)}</strong>
                      </TableCell>
                      <TableCell align="right">{num(grand.tasks)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Scrollbar>
            </TableContainer>
          </Card>
        </>
      )}
    </Stack>
  );
}
