'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { fDate, fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { getActiveStaffUsers } from 'src/api/users';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  getContracts,
  voidContract,
  createContract,
  getMyContracts,
  finalizeContract,
  getContractFields,
  terminateContract,
  saveEmployeeProfile,
  markContractSigned,
  updateContractDraft,
  getEmployeeProfiles,
  uploadContractFiles,
  getContractTemplates,
  createContractTemplate,
  deleteContractTemplate,
  updateContractTemplate,
  publishContractTemplate,
  removeContractTemplateDocx,
  uploadContractTemplateDocx,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  Gender,
  IContractField,
  IContractTerms,
  IEmployeeProfile,
  IContractTemplate,
  IEmploymentContract,
  EmploymentContractType,
  EmploymentContractStatus,
} from 'src/types/hr';
import { GENDER_LABEL, CONTRACT_TYPE_LABEL, CONTRACT_STATUS_LABEL } from 'src/types/hr';

import { fVnd } from '../hr-common';

// ----------------------------------------------------------------------
// Hợp đồng lao động soạn riêng từng người. Chỉ Admin quản lý nhân sự (hr.contract.manage): mẫu có phiên bản, hồ sơ nhân
// sự (dữ liệu cá nhân), soạn từ mẫu (trộn trường từ hồ sơ + cấu hình lương), chốt (cấp số), tự in, ký giấy, lưu bản giấy,
// tải bản ký lên. Nhân viên chỉ XEM hợp đồng của mình. Đây là hợp đồng giấy ký tay — không phải hợp đồng điện tử theo
// NĐ 337/2025.
// ----------------------------------------------------------------------

type TabKey = 'contracts' | 'profiles' | 'templates' | 'mine';

const STATUS_COLOR: Record<EmploymentContractStatus, 'default' | 'warning' | 'success' | 'error' | 'info'> = {
  Draft: 'default',
  AwaitingSignature: 'warning',
  Signed: 'success',
  Terminated: 'info',
  Voided: 'error',
};

const FILE_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Trang in hợp đồng (A4, chữ Times): nội dung đã trộn, giữ xuống dòng. */
const SIGN_HTML = (staffName: string) =>
  `<table class="sign"><tr><td><strong>NGƯỜI LAO ĐỘNG</strong><br><em>(Ký, ghi rõ họ tên)</em><div class="sign-space"></div><strong>${escapeHtml(
    staffName
  )}</strong></td><td><strong>NGƯỜI SỬ DỤNG LAO ĐỘNG</strong><br><em>(Ký, ghi rõ họ tên)</em><div class="sign-space"></div></td></tr></table>`;

/**
 * Nội dung hợp đồng (chữ đã trộn) → HTML kiểu văn bản hợp đồng: các dòng đầu viết HOA / "Độc lập…" / "Số:" căn giữa,
 * dòng "Điều N." và dòng viết HOA in đậm, thụt lề giữ theo khoảng trắng đầu dòng, <c>[[NGAT_TRANG]]</c> sang trang,
 * <c>[[CHU_KY]]</c> khối chữ ký hai cột. Mọi chữ đều được thoát HTML.
 */
export function contractBodyHtml(body: string, staffName: string): string {
  let header = true;
  return body
    .split(/\r?\n/)
    .map((raw) => {
      const line = raw.trimEnd();
      const trimmed = line.trim();
      if (trimmed === '[[NGAT_TRANG]]') return '<div class="page-break"></div>';
      if (trimmed === '[[CHU_KY]]') return SIGN_HTML(staffName);
      if (!trimmed) return '<p class="gap"></p>';
      const text = escapeHtml(trimmed);
      const caps = trimmed === trimmed.toLocaleUpperCase('vi') && /\p{L}/u.test(trimmed);
      if (header && (caps || /^(Độc lập|Số:)/.test(trimmed))) return `<p class="center${caps ? ' strong' : ''}">${text}</p>`;
      header = false;
      if (/^Điều\s+\d+[a-z]?\./.test(trimmed) || caps) return `<p class="strong head">${text}</p>`;
      const indent = line.length - line.trimStart().length;
      return indent > 0 ? `<p style="padding-left:${Math.min(indent, 12) * 0.4}em">${text}</p>` : `<p>${text}</p>`;
    })
    .join('');
}

const CONTRACT_CSS = `
.contract-doc { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.45; color: #000; }
.contract-doc p { margin: 0 0 2pt; text-align: justify; }
.contract-doc .center { text-align: center; }
.contract-doc .strong { font-weight: bold; }
.contract-doc .head { margin-top: 6pt; }
.contract-doc .gap { height: 6pt; margin: 0; }
.contract-doc table.sign { width: 100%; margin-top: 18pt; border-collapse: collapse; }
.contract-doc table.sign td { width: 50%; text-align: center; vertical-align: top; }
.contract-doc .sign-space { height: 70pt; }
.contract-doc .page-break { break-after: page; page-break-after: always; }`;

/** Trang in hợp đồng (A4, chữ Times, định dạng văn bản hợp đồng). */
export function buildPrintHtml(contract: Pick<IEmploymentContract, 'renderedBody' | 'contractNumber' | 'staffName'>): string {
  const title = escapeHtml(`Hợp đồng ${contract.contractNumber ?? '(nháp)'} – ${contract.staffName}`);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${title}</title><style>
@page { size: A4; margin: 20mm 18mm 20mm 25mm; }
body { margin: 0; }${CONTRACT_CSS}
</style></head><body><div class="contract-doc">${contractBodyHtml(contract.renderedBody, contract.staffName)}</div></body></html>`;
}

/** Xem trước trên màn hình — cùng định dạng với bản in. */
function ContractPreview({ body, staffName, maxHeight }: { body: string; staffName: string; maxHeight?: number }) {
  return (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: '#fff', border: 1, borderColor: 'divider', maxHeight, overflow: 'auto' }}>
      <style>{CONTRACT_CSS}</style>
      {/* eslint-disable-next-line react/no-danger -- nội dung đã thoát HTML trong contractBodyHtml */}
      <div className="contract-doc" dangerouslySetInnerHTML={{ __html: contractBodyHtml(body, staffName) }} />
    </Box>
  );
}

function printContract(contract: IEmploymentContract) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(buildPrintHtml(contract));
  win.document.close();
  win.focus();
  win.print();
  return true;
}

function termsOf(c: IEmploymentContract): IContractTerms {
  return {
    contractType: c.contractType,
    parentContractId: c.parentContractId,
    startDate: c.startDate,
    endDate: c.endDate,
    jobTitle: c.jobTitle,
    workplace: c.workplace,
    isPartTime: c.isPartTime,
    minHoursPerMonth: c.minHoursPerMonth,
    maxHoursPerMonth: c.maxHoursPerMonth,
  };
}

export default function HrContractsView({ initialTab }: { initialTab?: string }) {
  const settings = useSettingsContext();
  const { user } = useAuthContext();
  const canManage = hasPermission(user, PERMISSIONS.hr.contractManage);
  const [tab, setTab] = useState<TabKey>(initialTab === 'mine' || !canManage ? 'mine' : 'contracts');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs heading="Hợp đồng lao động" links={[{ name: 'Nhân sự' }, { name: 'Hợp đồng lao động' }]} sx={{ mb: 2 }} />
      <Alert severity="info" sx={{ mb: 2 }}>
        {canManage
          ? 'Soạn từ mẫu → chốt (cấp số) → in, ký giấy với nhân viên, lưu bản giấy → tải ảnh / PDF bản đã ký lên. Nhân viên chỉ xem được hợp đồng của mình. Đây là hợp đồng giấy ký tay, không phải hợp đồng điện tử theo NĐ 337/2025.'
          : 'Hợp đồng lao động của bạn — chỉ để xem. Bản gốc ký tay do cửa hàng lưu giữ.'}
      </Alert>
      {canManage && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab value="contracts" label="Hợp đồng" />
          <Tab value="profiles" label="Hồ sơ nhân sự" />
          <Tab value="templates" label="Mẫu hợp đồng" />
          <Tab value="mine" label="Của tôi" />
        </Tabs>
      )}
      {tab === 'contracts' && <ContractsTab />}
      {tab === 'profiles' && <ProfilesTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'mine' && <MineTab />}
    </Container>
  );
}

// ── Hợp đồng (quản lý) ─────────────────────────────────────────────────

function ContractsTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<IEmploymentContract[]>([]);
  const [status, setStatus] = useState<EmploymentContractStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<IEmploymentContract | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getContracts({ status: status || undefined }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được hợp đồng'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [status, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select
          size="small"
          label="Trạng thái"
          value={status}
          onChange={(e) => setStatus(e.target.value as EmploymentContractStatus | '')}
          sx={{ width: 200 }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          {(Object.keys(CONTRACT_STATUS_LABEL) as EmploymentContractStatus[]).map((s) => (
            <MenuItem key={s} value={s}>
              {CONTRACT_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => setCreating(true)}>
          Soạn hợp đồng
        </Button>
      </Stack>
      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Chưa có hợp đồng nào.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell>Số</TableCell>
                  <TableCell>Loại</TableCell>
                  <TableCell>Thời hạn</TableCell>
                  <TableCell>Bản ký</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(c)}>
                    <TableCell>{c.staffName}</TableCell>
                    <TableCell>{c.contractNumber ?? '—'}</TableCell>
                    <TableCell>{CONTRACT_TYPE_LABEL[c.contractType]}</TableCell>
                    <TableCell>
                      {fDate(c.startDate)} – {c.endDate ? fDate(c.endDate) : 'không thời hạn'}
                    </TableCell>
                    <TableCell>{c.files.length > 0 ? `${c.files.length} tệp` : '—'}</TableCell>
                    <TableCell>
                      <Chip size="small" color={STATUS_COLOR[c.status]} label={CONTRACT_STATUS_LABEL[c.status]} />
                      {c.status === 'Draft' && c.missingFields.length > 0 && (
                        <Chip size="small" color="warning" variant="outlined" label={`Thiếu ${c.missingFields.length}`} sx={{ ml: 0.5 }} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <CreateContractDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          load();
          setDetail(c);
        }}
      />
      <ContractDetailDialog
        contract={detail}
        onClose={() => setDetail(null)}
        onChanged={(c) => {
          setDetail(c);
          load();
        }}
      />
    </>
  );
}

function TermsFields({ terms, onChange }: { terms: IContractTerms; onChange: (t: IContractTerms) => void }) {
  return (
    <>
      <TextField
        select
        label="Loại hợp đồng"
        value={terms.contractType}
        onChange={(e) => {
          const contractType = e.target.value as EmploymentContractType;
          onChange({ ...terms, contractType, endDate: contractType === 'Indefinite' ? null : terms.endDate });
        }}
      >
        {(Object.keys(CONTRACT_TYPE_LABEL) as EmploymentContractType[])
          .filter((t) => t !== 'Appendix')
          .map((t) => (
            <MenuItem key={t} value={t}>
              {CONTRACT_TYPE_LABEL[t]}
            </MenuItem>
          ))}
      </TextField>
      <Stack direction="row" spacing={2}>
        <TextField
          type="date"
          label="Ngày bắt đầu"
          value={terms.startDate}
          onChange={(e) => onChange({ ...terms, startDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
        <TextField
          type="date"
          label="Ngày kết thúc"
          value={terms.endDate ?? ''}
          disabled={terms.contractType === 'Indefinite'}
          onChange={(e) => onChange({ ...terms, endDate: e.target.value || null })}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Stack>
      <TextField
        label="Chức danh (bỏ trống = theo hồ sơ)"
        value={terms.jobTitle ?? ''}
        onChange={(e) => onChange({ ...terms, jobTitle: e.target.value })}
      />
      <TextField
        label="Địa điểm làm việc (bỏ trống = tên cửa hàng)"
        value={terms.workplace ?? ''}
        onChange={(e) => onChange({ ...terms, workplace: e.target.value })}
      />
      <FormControlLabel
        control={<Checkbox checked={terms.isPartTime} onChange={(e) => onChange({ ...terms, isPartTime: e.target.checked })} />}
        label="Không trọn thời gian (Quy chế Điều 16: 40–96 giờ / tháng)"
      />
      {terms.isPartTime && (
        <Stack direction="row" spacing={2}>
          <TextField
            type="number"
            label="Giờ tối thiểu / tháng"
            value={terms.minHoursPerMonth ?? ''}
            onChange={(e) => onChange({ ...terms, minHoursPerMonth: e.target.value ? Number(e.target.value) : null })}
            fullWidth
          />
          <TextField
            type="number"
            label="Giờ tối đa / tháng"
            value={terms.maxHoursPerMonth ?? ''}
            onChange={(e) => onChange({ ...terms, maxHoursPerMonth: e.target.value ? Number(e.target.value) : null })}
            fullWidth
          />
        </Stack>
      )}
    </>
  );
}

function CreateContractDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: IEmploymentContract) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<IContractTemplate[]>([]);
  const [staffId, setStaffId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [terms, setTerms] = useState<IContractTerms>({
    contractType: 'FixedTermUnder12Months',
    startDate: '',
    endDate: null,
    isPartTime: true,
    minHoursPerMonth: 40,
    maxHoursPerMonth: 96,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    getActiveStaffUsers()
      .then((u) => setStaff(u.map((x) => ({ id: x.id, name: x.fullName }))))
      .catch(() => setStaff([]));
    getContractTemplates()
      .then((list) => setTemplates(list.filter((t) => t.isActive && t.publishedAt)))
      .catch(() => setTemplates([]));
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      onCreated(await createContract(staffId, templateId, terms));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không soạn được hợp đồng'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Soạn hợp đồng</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {templates.length === 0 && (
            <Alert severity="warning">Chưa có mẫu đã công bố — vào tab &quot;Mẫu hợp đồng&quot; để tạo và công bố.</Alert>
          )}
          <TextField select label="Nhân viên" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mẫu"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              if (t && t.contractType !== 'Appendix') setTerms((prev) => ({ ...prev, contractType: t.contractType }));
            }}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} · bản {t.version}
              </MenuItem>
            ))}
          </TextField>
          <TermsFields terms={terms} onChange={setTerms} />
          <Typography variant="caption" color="text.secondary">
            Lương lấy theo cấu hình lương đang hiệu lực tại ngày bắt đầu. Thông tin cá nhân lấy từ tab &quot;Hồ sơ nhân sự&quot;.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!staffId || !templateId || !terms.startDate} onClick={save}>
          Soạn
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

function ContractDetailDialog({
  contract,
  onClose,
  onChanged,
}: {
  contract: IEmploymentContract | null;
  onClose: () => void;
  onChanged: (c: IEmploymentContract) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [terms, setTerms] = useState<IContractTerms | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [signedOn, setSignedOn] = useState('');
  const [action, setAction] = useState<{ kind: 'terminate' | 'void'; date: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTerms(contract ? termsOf(contract) : null);
    setFiles([]);
    setSignedOn(contract?.signedOn ?? new Date().toISOString().slice(0, 10));
    setAction(null);
  }, [contract]);

  const run = async (fn: () => Promise<IEmploymentContract>, done: string, fail: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      enqueueSnackbar(done);
      onChanged(updated);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, fail), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (!contract) return null;
  const c = contract;

  const finalize = async () => {
    const ok = await confirm({
      title: 'Chốt hợp đồng',
      content: 'Nội dung sẽ khoá lại và được cấp số. Sau đó in ra, ký giấy với nhân viên, rồi tải bản đã ký lên.',
      confirmText: 'Chốt',
    });
    if (ok) run(() => finalizeContract(c.id), 'Đã chốt — in ra để ký', 'Không chốt được');
  };

  const upload = () =>
    run(
      async () => markContractSigned(c.id, signedOn, await uploadContractFiles(c.id, files)),
      'Đã lưu bản ký — nhân viên xem được trên app',
      'Không lưu được bản ký'
    );

  return (
    <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="lg">
      <DialogTitle>
        {c.staffName} · {c.contractNumber ?? 'bản nháp'}{' '}
        <Chip size="small" color={STATUS_COLOR[c.status]} label={CONTRACT_STATUS_LABEL[c.status]} sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 3, minWidth: 0 }}>
            {c.status === 'Draft' && c.missingFields.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Còn thiếu: {c.missingFields.join(', ')}. Bổ sung ở tab &quot;Hồ sơ nhân sự&quot; (hoặc cấu hình lương), rồi bấm
                &quot;Trộn lại&quot;.
              </Alert>
            )}
            <ContractPreview body={c.renderedBody} staffName={c.staffName} maxHeight={560} />
          </Box>
          <Stack spacing={2} sx={{ flex: 2, minWidth: 280 }}>
            <Typography variant="body2" color="text.secondary">
              {CONTRACT_TYPE_LABEL[c.contractType]} · {fDate(c.startDate)} – {c.endDate ? fDate(c.endDate) : 'không thời hạn'}
              {c.salaryAmount != null && ` · lương ${fVnd(c.salaryAmount)}`}
              {` · mẫu bản ${c.templateVersion}`}
            </Typography>

            {c.status === 'Draft' && terms && (
              <>
                <TermsFields terms={terms} onChange={setTerms} />
                <Stack direction="row" spacing={1}>
                  <Button disabled={busy} onClick={() => run(() => updateContractDraft(c.id, terms), 'Đã trộn lại', 'Không lưu được')}>
                    Lưu & trộn lại
                  </Button>
                  <LoadingButton variant="contained" loading={busy} disabled={c.missingFields.length > 0} onClick={finalize}>
                    Chốt
                  </LoadingButton>
                </Stack>
              </>
            )}

            {c.status !== 'Draft' && c.status !== 'Voided' && (
              <Button
                variant="outlined"
                onClick={() => !printContract(c) && enqueueSnackbar('Trình duyệt chặn cửa sổ in — cho phép pop-up rồi thử lại.', { variant: 'warning' })}
              >
                In hợp đồng (2 bản)
              </Button>
            )}
            {c.docxUrl && (
              <Button variant="outlined" component="a" href={c.docxUrl} target="_blank" rel="noopener">
                Tải bản Word để in (định dạng của mẫu)
              </Button>
            )}

            {(c.status === 'AwaitingSignature' || c.status === 'Signed') && (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2">{c.status === 'Signed' ? 'Thêm trang bản ký' : 'Tải bản đã ký'}</Typography>
                    <TextField
                      type="date"
                      size="small"
                      label="Ngày ký"
                      value={signedOn}
                      onChange={(e) => setSignedOn(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <Button variant="outlined" component="label" size="small">
                      Chọn ảnh / PDF ({files.length})
                      <input hidden multiple type="file" accept={FILE_TYPES} onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
                    </Button>
                    <LoadingButton variant="contained" loading={busy} disabled={files.length === 0 || !signedOn} onClick={upload}>
                      Lưu bản ký
                    </LoadingButton>
                    <Typography variant="caption" color="text.secondary">
                      Bản giấy gốc cửa hàng tự lưu giữ. Tệp nằm ở kho riêng tư, chỉ Admin và chính nhân viên xem được.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {c.files.length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Bản ký {c.signedOn ? `(ký ${fDate(c.signedOn)})` : ''}</Typography>
                {c.files.map((f, i) => (
                  <Link key={f.id} href={f.url} target="_blank" rel="noopener">
                    Trang {i + 1} · {f.contentType === 'application/pdf' ? 'PDF' : 'ảnh'} · {fDateTime(f.uploadedAt, 'dd/MM HH:mm')}
                  </Link>
                ))}
              </Stack>
            )}

            {c.terminatedOn && (
              <Alert severity="info">
                Chấm dứt {fDate(c.terminatedOn)}: {c.terminationReason}
              </Alert>
            )}
            {c.voidReason && <Alert severity="error">Đã huỷ: {c.voidReason}</Alert>}

            {action ? (
              <Stack spacing={1}>
                {action.kind === 'terminate' && (
                  <TextField
                    type="date"
                    size="small"
                    label="Ngày chấm dứt"
                    value={action.date}
                    onChange={(e) => setAction({ ...action, date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                )}
                <TextField
                  size="small"
                  label={action.kind === 'terminate' ? 'Lý do chấm dứt' : 'Lý do huỷ'}
                  value={action.reason}
                  onChange={(e) => setAction({ ...action, reason: e.target.value })}
                  multiline
                  minRows={2}
                />
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setAction(null)}>Thôi</Button>
                  <LoadingButton
                    color="error"
                    variant="contained"
                    loading={busy}
                    disabled={!action.reason.trim() || (action.kind === 'terminate' && !action.date)}
                    onClick={() =>
                      run(
                        () =>
                          action.kind === 'terminate'
                            ? terminateContract(c.id, action.date, action.reason.trim())
                            : voidContract(c.id, action.reason.trim()),
                        action.kind === 'terminate' ? 'Đã ghi nhận chấm dứt' : 'Đã huỷ',
                        'Không lưu được'
                      )
                    }
                  >
                    Xác nhận
                  </LoadingButton>
                </Stack>
              </Stack>
            ) : (
              <Stack direction="row" spacing={1}>
                {c.status === 'Signed' && (
                  <Button color="inherit" onClick={() => setAction({ kind: 'terminate', date: '', reason: '' })}>
                    Chấm dứt hợp đồng
                  </Button>
                )}
                {(c.status === 'Draft' || c.status === 'AwaitingSignature') && (
                  <Button color="error" onClick={() => setAction({ kind: 'void', date: '', reason: '' })}>
                    Huỷ hợp đồng
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Đóng
        </Button>
      </DialogActions>
      {confirmDialog}
    </Dialog>
  );
}

// ── Hồ sơ nhân sự (dữ liệu cá nhân) ─────────────────────────────────────

function ProfilesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<IEmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<IEmployeeProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getEmployeeProfiles());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được hồ sơ'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await saveEmployeeProfile(edit.userId, {
        dateOfBirth: edit.dateOfBirth || null,
        gender: edit.gender || null,
        idNumber: edit.idNumber?.trim() || null,
        idIssuedOn: edit.idIssuedOn || null,
        idIssuedPlace: edit.idIssuedPlace?.trim() || null,
        permanentAddress: edit.permanentAddress?.trim() || null,
        jobTitle: edit.jobTitle?.trim() || null,
        joinedOn: edit.joinedOn || null,
      });
      setEdit(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không lưu được hồ sơ'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof IEmployeeProfile, label: string, type = 'text') =>
    edit && (
      <TextField
        type={type}
        label={label}
        value={(edit[key] as string | null | undefined) ?? ''}
        onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        fullWidth
      />
    );

  return (
    <>
      <Alert severity="warning" sx={{ mb: 2 }}>
        Dữ liệu cá nhân — chỉ Admin xem và sửa, dùng để soạn hợp đồng. Không chụp màn hình, không gửi ra ngoài.
      </Alert>
      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell>Chức danh</TableCell>
                  <TableCell>Ngày vào làm</TableCell>
                  <TableCell>Còn thiếu</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.userId} hover sx={{ cursor: 'pointer' }} onClick={() => setEdit(p)}>
                    <TableCell>{p.fullName}</TableCell>
                    <TableCell>{p.jobTitle ?? '—'}</TableCell>
                    <TableCell>{p.joinedOn ? fDate(p.joinedOn) : '—'}</TableCell>
                    <TableCell>
                      {p.missingFields.length === 0 ? (
                        <Chip size="small" color="success" label="Đủ" />
                      ) : (
                        <Typography variant="caption" color="warning.main">
                          {p.missingFields.join(', ')}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={!!edit} onClose={() => !saving && setEdit(null)} fullWidth maxWidth="sm">
        <DialogTitle>Hồ sơ nhân sự · {edit?.fullName}</DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              {edit.hasIdCardImages && (
                <Typography variant="caption" color="text.secondary">
                  Nhân viên đã tải ảnh CCCD trong hồ sơ tài khoản — đối chiếu khi nhập số.
                </Typography>
              )}
              <Stack direction="row" spacing={2}>
                {field('dateOfBirth', 'Ngày sinh', 'date')}
                <TextField
                  select
                  label="Giới tính"
                  value={edit.gender ?? ''}
                  onChange={(e) => setEdit({ ...edit, gender: (e.target.value || null) as Gender | null })}
                  fullWidth
                >
                  <MenuItem value="">—</MenuItem>
                  {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                    <MenuItem key={g} value={g}>
                      {GENDER_LABEL[g]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {field('idNumber', 'Số CCCD (12 chữ số)')}
              <Stack direction="row" spacing={2}>
                {field('idIssuedOn', 'Ngày cấp', 'date')}
                {field('idIssuedPlace', 'Nơi cấp')}
              </Stack>
              {field('permanentAddress', 'Nơi thường trú')}
              <Stack direction="row" spacing={2}>
                {field('jobTitle', 'Chức danh')}
                {field('joinedOn', 'Ngày vào làm', 'date')}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)} disabled={saving}>
            Đóng
          </Button>
          <LoadingButton variant="contained" loading={saving} onClick={save}>
            Lưu
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ── Mẫu hợp đồng ───────────────────────────────────────────────────────

function TemplatesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [rows, setRows] = useState<IContractTemplate[]>([]);
  const [fields, setFields] = useState<IContractField[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<IContractTemplate | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getContractTemplates());
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được mẫu'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
    getContractFields()
      .then(setFields)
      .catch(() => setFields([]));
  }, [load]);

  const run = async (fn: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try {
      await fn();
      enqueueSnackbar(done);
      return true;
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, fail), { variant: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const newDraft = async (copyFromId: string | null) => {
    setBusy(true);
    try {
      setEdit(await createContractTemplate(copyFromId));
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tạo được bản nháp'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const save = async (publish: boolean) => {
    if (!edit) return;
    const ok = await run(
      () => updateContractTemplate(edit.id, { code: edit.code, name: edit.name, contractType: edit.contractType, body: edit.body }),
      'Đã lưu bản nháp',
      'Không lưu được'
    );
    if (!ok) return;
    if (publish) {
      const go = await confirm({
        title: 'Công bố mẫu',
        content: 'Mẫu đã công bố không sửa được (sửa = phiên bản mới). Phiên bản cũ cùng mã ngừng dùng cho hợp đồng mới; hợp đồng đã soạn giữ nguyên.',
        confirmText: 'Công bố',
      });
      if (!go || !(await run(() => publishContractTemplate(edit.id), 'Đã công bố', 'Không công bố được'))) return;
    }
    setEdit(null);
    load();
  };

  const uploadDocx = async (file: File) => {
    if (!edit) return;
    setBusy(true);
    try {
      setEdit(await uploadContractTemplateDocx(edit.id, file));
      enqueueSnackbar('Đã gắn mẫu Word');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không gắn được mẫu Word'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const removeDocx = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      setEdit(await removeContractTemplateDocx(edit.id));
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không bỏ được mẫu Word'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const missingKeys = useMemo(() => {
    if (!edit) return [];
    return fields.filter((f) => f.required && !edit.body.includes(`{{${f.key}}}`)).map((f) => f.label);
  }, [edit, fields]);

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} justifyContent="flex-end">
        <LoadingButton variant="contained" loading={busy} onClick={() => newDraft(null)}>
          Tạo từ mẫu dựng sẵn
        </LoadingButton>
      </Stack>
      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Chưa có mẫu — bấm &quot;Tạo từ mẫu dựng sẵn&quot;, điền thông tin hộ kinh doanh trong ngoặc vuông, rà lại cùng kế toán
            rồi công bố.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mẫu</TableCell>
                  <TableCell>Mã</TableCell>
                  <TableCell>Bản</TableCell>
                  <TableCell>Loại mặc định</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.code}</TableCell>
                    <TableCell>{t.version}</TableCell>
                    <TableCell>{CONTRACT_TYPE_LABEL[t.contractType]}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={!t.publishedAt ? 'default' : t.isActive ? 'success' : 'info'}
                        label={!t.publishedAt ? 'Nháp' : t.isActive ? 'Đang dùng' : 'Bản cũ'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!t.publishedAt ? (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => setEdit(t)}>
                            Sửa
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            disabled={busy}
                            onClick={async () => {
                              if (await run(() => deleteContractTemplate(t.id), 'Đã xoá bản nháp', 'Không xoá được')) load();
                            }}
                          >
                            Xoá
                          </Button>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => setEdit(t)}>
                            Xem
                          </Button>
                          {t.isActive && (
                            <Button size="small" disabled={busy} onClick={() => newDraft(t.id)}>
                              Phiên bản mới
                            </Button>
                          )}
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={!!edit} onClose={() => !busy && setEdit(null)} fullWidth maxWidth="lg">
        <DialogTitle>
          {edit?.publishedAt ? 'Mẫu đã công bố' : 'Sửa bản nháp mẫu'} · bản {edit?.version}
        </DialogTitle>
        <DialogContent>
          {edit && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ pt: 1 }}>
              <Stack spacing={2} sx={{ flex: 3, minWidth: 0 }}>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Tên mẫu"
                    value={edit.name}
                    disabled={!!edit.publishedAt}
                    onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                    fullWidth
                  />
                  <TextField
                    label="Mã"
                    value={edit.code}
                    disabled={!!edit.publishedAt}
                    onChange={(e) => setEdit({ ...edit, code: e.target.value.toLowerCase() })}
                    sx={{ width: 260 }}
                  />
                </Stack>
                <TextField
                  select
                  label="Loại mặc định"
                  value={edit.contractType}
                  disabled={!!edit.publishedAt}
                  onChange={(e) => setEdit({ ...edit, contractType: e.target.value as EmploymentContractType })}
                >
                  {(Object.keys(CONTRACT_TYPE_LABEL) as EmploymentContractType[]).map((t) => (
                    <MenuItem key={t} value={t}>
                      {CONTRACT_TYPE_LABEL[t]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Nội dung"
                  value={edit.body}
                  disabled={!!edit.publishedAt}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                  multiline
                  minRows={20}
                  maxRows={32}
                  InputProps={{ sx: { fontFamily: '"Times New Roman", Times, serif', fontSize: 15 } }}
                />
                {!edit.publishedAt && missingKeys.length > 0 && (
                  <Alert severity="info">Mẫu chưa dùng các trường: {missingKeys.join(', ')}.</Alert>
                )}
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Mẫu Word (.docx) — giữ nguyên định dạng của bạn</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Soạn hợp đồng trong Word theo đúng kiểu chữ, căn lề, logo của cửa hàng, gõ các trường dạng {'{{ho_ten}}'} ở chỗ
                        cần điền rồi tải lên. Khi chốt hợp đồng, hệ thống điền thông tin từng người và cho tải bản Word để in. PDF
                        không điền tự động được — dùng Word, hoặc đăng hợp đồng đã soạn sẵn ở tab Hợp đồng.
                      </Typography>
                      {edit.docxFileName ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" color="success" label={edit.docxFileName} />
                          {!edit.publishedAt && (
                            <Button size="small" color="inherit" disabled={busy} onClick={removeDocx}>
                              Bỏ mẫu Word
                            </Button>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Chưa có — hợp đồng in theo nội dung chữ ở bên trái.
                        </Typography>
                      )}
                      {!edit.publishedAt && (
                        <Button variant="outlined" component="label" size="small" disabled={busy} sx={{ alignSelf: 'flex-start' }}>
                          {edit.docxFileName ? 'Thay mẫu Word' : 'Tải mẫu Word (.docx)'}
                          <input
                            hidden
                            type="file"
                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (file) uploadDocx(file);
                            }}
                          />
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
              <Stack spacing={1} sx={{ flex: 1, minWidth: 220 }}>
                <Typography variant="subtitle2">Trường trộn</Typography>
                <Typography variant="caption" color="text.secondary">
                  Viết đúng dạng {'{{ma_truong}}'} trong nội dung (và trong mẫu Word). Trường bắt buộc còn trống thì không chốt
                  được hợp đồng. Khi in: dòng {'[[CHU_KY]]'} thành khối chữ ký hai bên, {'[[NGAT_TRANG]]'} sang trang mới.
                </Typography>
                {fields.map((f) => (
                  <Stack key={f.key} direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`{{${f.key}}}`}
                      onClick={() => navigator.clipboard?.writeText(`{{${f.key}}}`)}
                    />
                    <Typography variant="caption">
                      {f.label}
                      {f.required ? ' *' : ''}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEdit(null)} disabled={busy}>
            Đóng
          </Button>
          {edit && !edit.publishedAt && (
            <>
              <Button disabled={busy} onClick={() => save(false)}>
                Lưu nháp
              </Button>
              <LoadingButton variant="contained" loading={busy} onClick={() => save(true)}>
                Lưu & công bố
              </LoadingButton>
            </>
          )}
        </DialogActions>
        {confirmDialog}
      </Dialog>
    </>
  );
}

// ── Của tôi (chỉ xem) ──────────────────────────────────────────────────

function MineTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<IEmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getMyContracts()
      .then(setRows)
      .catch((err) => enqueueSnackbar(apiErrorMessage(err, 'Không tải được hợp đồng'), { variant: 'error' }))
      .finally(() => setLoading(false));
  }, [enqueueSnackbar]);

  if (loading)
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  if (rows.length === 0)
    return (
      <Card>
        <Typography color="text.secondary" sx={{ p: 3 }}>
          Chưa có hợp đồng nào.
        </Typography>
      </Card>
    );

  return (
    <Stack spacing={2}>
      {rows.map((c) => (
        <Card key={c.id}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
              <Typography variant="h6">Hợp đồng số {c.contractNumber}</Typography>
              <Chip size="small" color={STATUS_COLOR[c.status]} label={CONTRACT_STATUS_LABEL[c.status]} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {CONTRACT_TYPE_LABEL[c.contractType]} · {fDate(c.startDate)} – {c.endDate ? fDate(c.endDate) : 'không thời hạn'}
              {c.signedOn && ` · ký ngày ${fDate(c.signedOn)}`}
            </Typography>
            {c.files.length > 0 && (
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {c.files.map((f, i) => (
                  <Link key={f.id} href={f.url} target="_blank" rel="noopener">
                    Bản ký trang {i + 1}
                  </Link>
                ))}
              </Stack>
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => setOpen(open === c.id ? null : c.id)}>
              {open === c.id ? 'Ẩn nội dung' : 'Xem nội dung'}
            </Button>
            {open === c.id && (
              <Box sx={{ mt: 1 }}>
                <ContractPreview body={c.renderedBody} staffName={c.staffName} />
              </Box>
            )}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
