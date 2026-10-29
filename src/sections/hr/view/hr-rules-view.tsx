'use client';

import { useState, useEffect, type ReactNode } from 'react';

import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { shortTime, getHrRuleSettings, saveHrRuleSettings, resetActiveHrRules } from 'src/api/hr-rules';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IHrRules } from 'src/types/hr-rules';

// ----------------------------------------------------------------------
// Luật nhân sự riêng của cửa hàng (chỉ Admin — hr.rule.manage). Mỗi luật có công tắc: tắt = phần mềm không áp luật đó. Số
// liệu do cửa hàng tự đặt theo quy định của mình; phần mềm không giải thích quy chế.
// ----------------------------------------------------------------------

type NumberKey = {
  [K in keyof IHrRules]: IHrRules[K] extends number | null ? K : never;
}[keyof IHrRules];

const toNumber = (v: string): number | null => {
  const n = Number(v.replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
};

function Rule({
  title,
  on,
  onToggle,
  children,
}: {
  title: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <Stack spacing={1.5} sx={{ py: 1.5 }}>
      <FormControlLabel
        control={<Switch checked={on} onChange={(e) => onToggle(e.target.checked)} />}
        label={<Typography variant="subtitle2">{title}</Typography>}
      />
      {on && children ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pl: { sm: 6 } }} flexWrap="wrap" useFlexGap>
          {children}
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function HrRulesView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const [rules, setRules] = useState<IHrRules | null>(null);
  // Luật dạng số bật / tắt riêng với giá trị: xoá trắng ô để gõ lại không làm tắt luật.
  const [numberOn, setNumberOn] = useState<Partial<Record<NumberKey | 'supportShiftLatestEnd', boolean>>>({});
  const [customized, setCustomized] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHrRuleSettings()
      .then((s) => {
        setRules(s.rules);
        setNumberOn(
          Object.fromEntries(
            (Object.keys(s.rules) as (keyof IHrRules)[])
              .filter((k) => typeof s.rules[k] !== 'boolean')
              .map((k) => [k, s.rules[k] != null])
          )
        );
        setCustomized(s.customized);
        setUpdatedAt(s.updatedAt);
      })
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được cấu hình'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  if (!rules) {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const set = <K extends keyof IHrRules>(key: K, value: IHrRules[K]) => setRules((r) => (r ? { ...r, [key]: value } : r));

  const num = (key: NumberKey, label: string, width = 200) => (
    <TextField
      size="small"
      label={label}
      value={rules[key] ?? ''}
      onChange={(e) => set(key, toNumber(e.target.value))}
      inputProps={{ inputMode: 'decimal' }}
      sx={{ width }}
    />
  );

  const isOn = (key: NumberKey | 'supportShiftLatestEnd') => !!numberOn[key];

  /** Bật một luật số: khi bật mà chưa có số thì điền giá trị gợi ý để Admin sửa. */
  const toggleNumber = (key: NumberKey, on: boolean, suggested: number) => {
    setNumberOn((s) => ({ ...s, [key]: on }));
    set(key, on ? (rules[key] ?? suggested) : null);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await saveHrRuleSettings(rules);
      setRules(saved.rules);
      setCustomized(true);
      setUpdatedAt(saved.updatedAt);
      resetActiveHrRules();
      enqueueSnackbar('Đã lưu cấu hình', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được cấu hình'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'md'}>
      <CustomBreadcrumbs
        heading="Cấu hình luật"
        links={[{ name: 'Nhân sự' }, { name: 'Cấu hình luật' }]}
        action={
          <LoadingButton variant="contained" loading={saving} onClick={submit}>
            Lưu
          </LoadingButton>
        }
        sx={{ mb: 3 }}
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Luật nào tắt thì phần mềm không áp dụng.{' '}
        {customized
          ? `Lưu lần cuối ${fDate(updatedAt, 'dd/MM/yyyy HH:mm')}.`
          : 'Cửa hàng chưa lưu cấu hình — đang dùng mặc định.'}
      </Alert>

      <Stack spacing={3}>
        <Card>
          <CardHeader title="Thưởng và target" />
          <CardContent>
            <Rule
              title="Thưởng doanh số tuần theo target"
              on={rules.weeklyBonusEnabled}
              onToggle={(on) =>
                setRules({
                  ...rules,
                  weeklyBonusEnabled: on,
                  weeklyBonusTier1FromPct: on ? (rules.weeklyBonusTier1FromPct ?? 100) : rules.weeklyBonusTier1FromPct,
                  weeklyBonusTier1RatePct: on ? (rules.weeklyBonusTier1RatePct ?? 1) : rules.weeklyBonusTier1RatePct,
                })
              }
            >
              {num('weeklyBonusTier1FromPct', 'Bậc 1 từ (% target)', 160)}
              {num('weeklyBonusTier1RatePct', 'Thưởng bậc 1 (%)', 160)}
              {num('weeklyBonusTier2FromPct', 'Bậc 2 từ (% target, trống = không)', 240)}
              {rules.weeklyBonusTier2FromPct != null && num('weeklyBonusTier2RatePct', 'Thưởng bậc 2 (%)', 160)}
              {num('weeklyBonusExcludeDiscountPct', 'Bỏ hàng giảm từ (%, trống = không bỏ)', 260)}
              <FormControlLabel
                control={
                  <Switch
                    checked={rules.weeklyBonusExcludeOnline}
                    onChange={(e) => set('weeklyBonusExcludeOnline', e.target.checked)}
                  />
                }
                label="Không tính đơn online"
              />
            </Rule>
            <Divider />
            <Rule
              title="Tự tính target tuần theo cùng kỳ"
              on={isOn('targetGrowthPct')}
              onToggle={(on) => toggleNumber('targetGrowthPct', on, 0)}
            >
              {num('targetYears', 'Số năm lấy cùng kỳ (1–5)')}
              {num('targetGrowthPct', 'Hệ số target: thêm (%)')}
              {num('targetFloorPct', 'Hệ số sàn: thêm (%)')}
              <Typography variant="caption" color="text.secondary" sx={{ flexBasis: '100%' }}>
                Target = trung bình cùng tuần các năm × hệ số quy đổi (8 tuần gần nhất so với cùng kỳ) × (1 + % target). Sàn =
                trung vị 8 tuần gần nhất, bỏ tuần có ngày lễ, × (1 + % sàn). Tuần Tết và 4 tuần trước Tết so theo Tết âm lịch.
                Bỏ trống số năm = 1 năm; bỏ trống % sàn = dùng % target.
              </Typography>
            </Rule>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Lương và biên bản" />
          <CardContent>
            <Rule
              title="Nhân viên khiếu nại phiếu lương"
              on={isOn('complaintWorkingDays')}
              onToggle={(on) => toggleNumber('complaintWorkingDays', on, 3)}
            >
              {num('complaintWorkingDays', 'Hạn khiếu nại / trả lời (ngày làm việc)', 280)}
            </Rule>
            <Divider />
            <Rule
              title="Ngưỡng tối thiểu để lập biên bản chênh lệch tiền"
              on={isOn('recordCashThreshold')}
              onToggle={(on) => toggleNumber('recordCashThreshold', on, 10_000)}
            >
              {num('recordCashThreshold', 'Từ (đ)')}
            </Rule>
            <Divider />
            <Rule
              title="Chấm điểm hiệu suất và xếp loại hằng tháng"
              on={rules.performanceEnabled}
              onToggle={(on) => set('performanceEnabled', on)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Ca làm" />
          <CardContent>
            <Rule
              title="Giới hạn số ca hỗ trợ mỗi người / tháng"
              on={isOn('supportShiftMonthlyCap')}
              onToggle={(on) => toggleNumber('supportShiftMonthlyCap', on, 10)}
            >
              {num('supportShiftMonthlyCap', 'Tối đa (ca / tháng)')}
            </Rule>
            <Divider />
            <Rule
              title="Ca hỗ trợ kết thúc muộn nhất"
              on={isOn('supportShiftLatestEnd')}
              onToggle={(on) => {
                setNumberOn((s) => ({ ...s, supportShiftLatestEnd: on }));
                set('supportShiftLatestEnd', on ? (rules.supportShiftLatestEnd ?? '22:00:00') : null);
              }}
            >
              <TextField
                size="small"
                type="time"
                label="Giờ"
                value={shortTime(rules.supportShiftLatestEnd)}
                onChange={(e) => set('supportShiftLatestEnd', e.target.value ? `${e.target.value}:00` : null)}
                InputLabelProps={{ shrink: true }}
                sx={{ width: 160 }}
              />
            </Rule>
            <Divider />
            <Rule
              title="Xin nghỉ ca đã xếp phải báo trước"
              on={isOn('leaveMinNoticeHours')}
              onToggle={(on) => toggleNumber('leaveMinNoticeHours', on, 24)}
            >
              {num('leaveMinNoticeHours', 'Số giờ')}
            </Rule>
            <Divider />
            <Rule
              title="Cảnh báo hai ca chính trong một ngày"
              on={rules.warnSecondMainShift}
              onToggle={(on) => set('warnSecondMainShift', on)}
            />
            <Divider />
            <Rule
              title="Giới hạn giờ làm / tháng (cảnh báo khi xếp ca, giờ tối đa của hợp đồng không trọn thời gian)"
              on={isOn('monthlyHourCap')}
              onToggle={(on) => toggleNumber('monthlyHourCap', on, 96)}
            >
              {num('monthlyHourCap', 'Số giờ / tháng')}
            </Rule>
            <Divider />
            <Rule
              title="Cảnh báo xếp người thử việc (làm trưởng ca, đứng khu C một mình, hai người thử việc cùng ca)"
              on={rules.probationRoleWarnings}
              onToggle={(on) => set('probationRoleWarnings', on)}
            />
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
