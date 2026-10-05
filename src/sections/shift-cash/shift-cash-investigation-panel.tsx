'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import { alpha, useTheme } from '@mui/material/styles';
import type { Theme, SxProps } from '@mui/material/styles';
import TableContainer from '@mui/material/TableContainer';

import { useSearchParams } from 'src/routes/hooks';

import { isShiftCashBypass } from 'src/utils/shift-cash-access';

import { useAuthContext } from 'src/auth/hooks';
import { getShiftCashInvestigation } from 'src/api/shiftCash';

import Iconify from 'src/components/iconify';

import type {
  IShiftCashFinding,
  IShiftCashSummary,
  ShiftCashCheckpointKind,
  ShiftCashFindingStrength,
  IShiftCashInvestigationResult,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Kiểm tra chênh lệch" ở trang Kiểm tiền quầy — chỉ Admin, chỉ đọc. Hiện kết quả
// GET /shift-cash/investigation của ngày đang chọn: chênh lệch, thời điểm phát sinh lệch, các
// nguyên nhân CÓ THỂ (mạnh → yếu) và các mốc đếm.
//  - Thu gọn mặc định; chỉ gọi API khi bấm "Kiểm tra", hoặc đúng 1 lần khi mở trang bằng
//    ?investigate=1 (link từ thông báo).
//  - Đổi ngày → về thu gọn. BE trả 403 → ẩn hẳn.
// Chữ và quy ước (thừa / thiếu, dung sai, giờ Việt Nam) theo ShiftCashInvestigationRenderer của
// core-be để khớp với thông báo Admin đã nhận.
// ----------------------------------------------------------------------

// Cùng dạng số với trang ("1.234.567"); làm tròn tới đồng như Vnd() của BE để khớp chữ diễn giải.
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

function formatVnd(value: number): string {
  return `${formatCurrency(value)}đ`;
}

// "thiếu 150.000đ" / "thừa 150.000đ" / "khớp quỹ" (lệch dưới dung sai coi như khớp)
function differenceText(difference: number, tolerance = 1): string {
  if (Math.abs(difference) < Math.max(1, tolerance)) return 'khớp quỹ';
  return `${difference > 0 ? 'thừa' : 'thiếu'} ${formatVnd(Math.abs(difference))}`;
}

// Thiếu = màu lỗi, thừa = màu cảnh báo, khớp = xanh
function differenceColor(difference: number, tolerance = 1): 'error' | 'warning' | 'success' {
  if (Math.abs(difference) < Math.max(1, tolerance)) return 'success';
  return difference < 0 ? 'error' : 'warning';
}

// Mốc thời gian UTC của BE → giờ Việt Nam "HH:mm" (UTC+7, không có giờ mùa hè — cùng cách tính với
// vnToday). Mốc rơi vào ngày khác ngày đang kiểm tra (chốt bù hôm sau, sửa sau nửa đêm) thì kèm
// "dd/MM".
function formatTimeVN(iso: string, day: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  // Cộng 7 giờ rồi đọc chuỗi ISO: "yyyy-MM-ddTHH:mm:ss.sssZ" lúc này là giờ Việt Nam
  const vn = new Date(ms + 7 * 60 * 60 * 1000).toISOString();
  const time = vn.slice(11, 16);
  return vn.slice(0, 10) === day ? time : `${time} ${vn.slice(8, 10)}/${vn.slice(5, 7)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Trang đã biết ngày đang chọn chốt rồi và quỹ khớp — cả số lưu lúc chốt lẫn số tính lại đều bằng 0
// (chỉ một trong hai bằng 0 thì vẫn còn điều để kiểm tra: số liệu đã đổi sau khi chốt). So
// summary.date để không dùng nhầm số của ngày trước khi trang vừa đổi ngày và chưa tải xong.
function isTillBalanced(summary: IShiftCashSummary | null | undefined, date: string): boolean {
  return (
    !!summary &&
    summary.date === date &&
    summary.isFinalized &&
    summary.difference === 0 &&
    (summary.finalizations?.[0]?.difference ?? 0) === 0
  );
}

const STRENGTH: Record<
  ShiftCashFindingStrength,
  { label: string; color: 'error' | 'warning' | 'default' }
> = {
  Strong: { label: 'Khả năng cao', color: 'error' },
  Medium: { label: 'Có thể', color: 'warning' },
  Weak: { label: 'Gợi ý', color: 'default' },
};

const CHECKPOINT_KIND: Record<ShiftCashCheckpointKind, string> = {
  Open: 'Mở quầy',
  Count: 'Đếm',
  Finalize: 'Chốt',
  AutoFinalize: 'Tự chốt',
};

// Ô số tiền của bảng mốc đếm: không xuống dòng; chữ nhỏ hơn trên màn hình hẹp
const NUMBER_CELL_SX = { whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } };

// ----------------------------------------------------------------------

type PanelView =
  | { step: 'idle' }
  | { step: 'result'; result: IShiftCashInvestigationResult }
  | { step: 'not-finalized' }
  | { step: 'unavailable' }
  | { step: 'error' };

// loading = mã của lời gọi đang chờ (null = không gọi); view giữ nguyên trong lúc tải lại.
type PanelState = { date: string; view: PanelView; loading: number | null };

const IDLE: PanelView = { step: 'idle' };

const STATUS_TEXT: Record<Exclude<PanelView['step'], 'result'>, string> = {
  idle: 'Tìm nguyên nhân có thể và thời điểm phát sinh lệch của lần chốt quầy mới nhất trong ngày.',
  'not-finalized': 'Ngày này chưa chốt quầy nên chưa có gì để kiểm tra.',
  unavailable: 'Tính năng kiểm tra chênh lệch chưa sẵn sàng trên máy chủ.',
  error: 'Không kiểm tra được chênh lệch. Vui lòng thử lại.',
};

type Props = {
  // Ngày đang chọn ở trang Kiểm tiền quầy (yyyy-MM-dd)
  date: string;
  // Tổng hợp trang đang hiện (nếu đã tải): ngày đã chốt và quỹ khớp → hàng mờ, không có nút
  summary?: IShiftCashSummary | null;
  sx?: SxProps<Theme>;
};

export default function ShiftCashInvestigationPanel({ date, summary, sx }: Props) {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();

  // Cùng luật với trang: chỉ Admin (BE: [Authorize(Roles = "Admin")]) — vai trò khác không thấy gì,
  // không gọi API.
  const isAdmin = isShiftCashBypass(user);
  const autoRun = searchParams.get('investigate') === '1';
  // Link từ thông báo có thể kèm ?date=yyyy-MM-dd (trang tự chuyển sang ngày đó): chờ trang đổi ngày
  // xong rồi mới tự kiểm tra — không thì chạy nhầm cho hôm nay.
  const urlDateParam = searchParams.get('date');
  const urlDate = urlDateParam && /^\d{4}-\d{2}-\d{2}$/.test(urlDateParam) ? urlDateParam : null;

  const [forbidden, setForbidden] = useState(false);
  const [state, setState] = useState<PanelState>({ date, view: IDLE, loading: null });
  const tokenRef = useRef(0);
  const autoRanRef = useRef(false);

  // Đổi ngày → về thu gọn ngay trong lần render này (không nháy kết quả của ngày cũ); lời gọi đang
  // chờ của ngày cũ bị bỏ.
  if (state.date !== date) {
    setState({ date, view: IDLE, loading: null });
  }
  const { view, loading: pendingToken } =
    state.date === date ? state : { view: IDLE, loading: null };
  const loading = pendingToken !== null;

  const run = useCallback(async (forDate: string) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    // Chỉ nhận câu trả lời khi vẫn đang chờ đúng lời gọi này (chưa đổi ngày / thu gọn / gọi lại).
    const settle = (next: PanelView) =>
      setState((prev) =>
        prev.date === forDate && prev.loading === token
          ? { date: forDate, view: next, loading: null }
          : prev
      );

    setState((prev) => ({
      date: forDate,
      view: prev.date === forDate ? prev.view : IDLE,
      loading: token,
    }));

    try {
      const outcome = await getShiftCashInvestigation(forDate);
      if (outcome.status === 'forbidden') {
        setForbidden(true);
      } else if (outcome.status === 'ok') {
        settle({ step: 'result', result: outcome.result });
      } else {
        settle({ step: outcome.status });
      }
    } catch (error) {
      console.error('Shift-cash investigation error:', error);
      settle({ step: 'error' });
    }
  }, []);

  // Mở trang bằng ?investigate=1 → tự kiểm tra đúng 1 lần cho ngày đang chọn; đổi ngày sau đó không
  // tự chạy lại.
  useEffect(() => {
    if (!autoRun) {
      autoRanRef.current = false;
      return;
    }
    if (!isAdmin || !date || autoRanRef.current) return;
    if (urlDate && date !== urlDate) return;
    autoRanRef.current = true;
    run(date);
  }, [autoRun, isAdmin, date, urlDate, run]);

  if (!isAdmin || forbidden) return null;

  const muted = view.step === 'idle' && !loading && isTillBalanced(summary, date);

  let status: string | null = null;
  if (muted) status = 'Quỹ khớp — không có gì để kiểm tra';
  else if (view.step !== 'result') status = loading ? 'Đang kiểm tra…' : STATUS_TEXT[view.step];

  let actionLabel = 'Tải lại';
  if (view.step === 'idle') actionLabel = 'Kiểm tra';
  else if (view.step === 'error') actionLabel = 'Thử lại';

  return (
    <Card sx={[{ p: 2.5 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1.5}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
          <Typography variant="subtitle1" color={muted ? 'text.secondary' : 'text.primary'}>
            <Iconify
              icon="solar:magnifer-bold-duotone"
              width={22}
              sx={{ mr: 1, verticalAlign: 'middle' }}
            />
            Kiểm tra chênh lệch
          </Typography>
          {status && (
            <Typography
              variant="body2"
              color={
                (muted && 'text.disabled') ||
                (view.step === 'error' && !loading && 'error.main') ||
                'text.secondary'
              }
              sx={{ mt: 0.5 }}
            >
              {status}
            </Typography>
          )}
        </Box>

        {!muted && (
          <Stack direction="row" spacing={1} alignItems="center">
            <LoadingButton
              variant="outlined"
              size="small"
              loading={loading}
              disabled={!date}
              onClick={() => run(date)}
              startIcon={
                <Iconify
                  icon={view.step === 'idle' ? 'solar:magnifer-bold-duotone' : 'solar:refresh-bold'}
                />
              }
            >
              {actionLabel}
            </LoadingButton>
            {view.step === 'result' && (
              <Button
                size="small"
                color="inherit"
                onClick={() => setState({ date, view: IDLE, loading: null })}
                startIcon={<Iconify icon="solar:alt-arrow-up-bold" />}
              >
                Thu gọn
              </Button>
            )}
          </Stack>
        )}
      </Stack>

      {view.step === 'result' && (
        <>
          <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
          <Box sx={{ opacity: loading ? 0.48 : 1 }}>
            <InvestigationResult result={view.result} />
          </Box>
        </>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------

function InvestigationResult({ result }: { result: IShiftCashInvestigationResult }) {
  const theme = useTheme();
  const { numbers, driftWindow, driftNote, findings, checkpoints } = result;

  const tolerance = Math.max(1, numbers.tolerance);
  const time = (iso: string) => formatTimeVN(iso, result.date);

  const color = differenceColor(numbers.difference);
  const balancedNow = Math.abs(numbers.difference) < tolerance;
  // Số liệu đã đổi sau khi chốt → nói rõ cả hai con số; dòng diễn giải bên dưới là số tính lại.
  const changedAfterFinalize =
    Math.abs(numbers.difference - numbers.differenceAtFinalize) >= tolerance;
  // Khoanh được giữa hai mốc đếm: mốc "từ" là lần đếm thật còn khớp (không phải số chép sang lúc
  // mở quầy).
  const driftFrom = driftWindow && !driftWindow.fromOpening ? driftWindow.from : null;

  return (
    <Stack spacing={2.5}>
      {/* Chênh lệch + dòng số liệu */}
      <Box sx={{ p: 2, borderRadius: 1, bgcolor: alpha(theme.palette[color].main, 0.08) }}>
        <Typography variant="h5" color={`${color}.main`}>
          {capitalize(differenceText(numbers.difference))}
        </Typography>
        {changedAfterFinalize && (
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Lúc chốt {differenceText(numbers.differenceAtFinalize)}; con số trên là tính lại theo số
            liệu hiện tại.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Đếm {formatVnd(numbers.countedCash)} / dự kiến {formatVnd(numbers.expectedCash)} (= tồn
          đầu {formatVnd(numbers.openingBalance)} + bán tiền mặt {formatVnd(numbers.cashFromSales)}{' '}
          + thu {formatVnd(numbers.manualIncome)} − chi {formatVnd(numbers.manualExpense)})
        </Typography>
        {result.finalizedAt && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            Lần chốt được kiểm tra: {time(result.finalizedAt)}
            {result.finalizedByName ? ` · ${result.finalizedByName}` : ''}
          </Typography>
        )}
      </Box>

      {/* Thời điểm phát sinh lệch: khoảng giờ + người có ca, hoặc lời giải thích của BE */}
      {(driftWindow || driftNote) && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Thời điểm phát sinh lệch
          </Typography>
          {driftWindow &&
            (driftFrom ? (
              <>
                <Typography variant="subtitle1">
                  {time(driftFrom)} → {time(driftWindow.to)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {time(driftFrom)} {differenceText(driftWindow.differenceAtFrom ?? 0, tolerance)},{' '}
                  {time(driftWindow.to)} {differenceText(driftWindow.differenceAtTo, tolerance)}.
                </Typography>
              </>
            ) : (
              <Typography variant="body2">
                Lệch đã có ở lần đếm đầu tiên trong ngày ({time(driftWindow.to)}:{' '}
                {differenceText(driftWindow.differenceAtTo, tolerance)}) — phát sinh trước lần đếm
                đó, hoặc tiền đầu ngày đã không khớp tồn đầu.
              </Typography>
            ))}
          {driftWindow && driftWindow.staffOnShift.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              Có ca trong khoảng này: {driftWindow.staffOnShift.join(', ')}.
            </Typography>
          )}
          {driftNote && (
            <Typography variant="body2" color={driftWindow ? 'text.secondary' : 'text.primary'}>
              {driftNote}
            </Typography>
          )}
        </Box>
      )}

      {/* Nguyên nhân có thể — đúng thứ tự BE trả về (mạnh → yếu) */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Nguyên nhân có thể{findings.length > 0 ? ` (${findings.length})` : ''}
        </Typography>
        {findings.length > 0 ? (
          <Stack
            component="ol"
            aria-label="Nguyên nhân có thể"
            spacing={1.5}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {findings.map((finding, index) => (
              <FindingItem key={`${finding.code}-${index}`} finding={finding} />
            ))}
          </Stack>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              {balancedNow
                ? 'Tính lại theo số liệu hiện tại thì quỹ khớp — không có chênh lệch cần giải thích.'
                : 'Chưa tìm thấy nguyên nhân rõ ràng từ dữ liệu trong hệ thống. Nên đếm lại quầy và đối chiếu từng hoá đơn tiền mặt trong ngày.'}
            </Typography>
            {!balancedNow && result.checked.length > 0 && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                Đã kiểm tra: {result.checked.join('; ')}.
              </Typography>
            )}
          </>
        )}
      </Box>

      {/* Các mốc đếm trong ngày */}
      {checkpoints.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Các mốc đếm trong ngày
          </Typography>
          <TableContainer>
            {/* Màn hình nhỏ: lề ô hẹp + chữ số nhỏ để đủ 4 cột mà không phải cuộn ngang */}
            <Table
              size="small"
              aria-label="Các mốc đếm trong ngày"
              sx={{ '& .MuiTableCell-root': { px: { xs: 0.75, sm: 2 } } }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Thời điểm</TableCell>
                  <TableCell align="right">Đếm</TableCell>
                  <TableCell align="right">Dự kiến</TableCell>
                  <TableCell align="right">Chênh lệch</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {checkpoints.map((checkpoint, index) => (
                  <TableRow key={`${checkpoint.at}-${index}`}>
                    <TableCell>
                      <Typography variant="subtitle2">{time(checkpoint.at)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[
                          CHECKPOINT_KIND[checkpoint.kind] ?? checkpoint.kind,
                          ...checkpoint.actors,
                        ].join(' · ')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={NUMBER_CELL_SX}>
                      {formatCurrency(checkpoint.counted)}
                    </TableCell>
                    <TableCell align="right" sx={NUMBER_CELL_SX}>
                      {formatCurrency(checkpoint.expected)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        ...NUMBER_CELL_SX,
                        fontWeight: 600,
                        color: `${differenceColor(checkpoint.difference, tolerance)}.main`,
                      }}
                    >
                      {checkpoint.difference > 0 ? '+' : ''}
                      {formatCurrency(checkpoint.difference)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Typography variant="caption" color="text.secondary">
        Đây là các khả năng để kiểm tra lại, chưa phải kết luận.
      </Typography>
    </Stack>
  );
}

// ----------------------------------------------------------------------

function FindingItem({ finding }: { finding: IShiftCashFinding }) {
  const strength = STRENGTH[finding.strength] ?? STRENGTH.Weak;

  return (
    <Box
      component="li"
      sx={{ p: 1.5, borderRadius: 1, border: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Chip size="small" variant="soft" color={strength.color} label={strength.label} />
        {finding.amount > 0 && (
          <Typography variant="subtitle2" noWrap>
            {formatVnd(finding.amount)}
          </Typography>
        )}
      </Stack>

      <Typography variant="subtitle2" sx={{ mt: 0.75 }}>
        {finding.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {finding.detail}
      </Typography>

      {(finding.inDriftWindow || finding.refs.length > 0) && (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5} sx={{ mt: 1 }}>
          {finding.inDriftWindow && (
            <Chip
              size="small"
              variant="soft"
              color="info"
              icon={<Iconify icon="solar:clock-circle-bold" width={14} />}
              label="Trong khoảng phát sinh lệch"
            />
          )}
          {finding.refs.map((code, index) => (
            <Chip key={`${code}-${index}`} size="small" variant="outlined" label={code} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
