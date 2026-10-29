'use client';

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

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
  importPaperContract,
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
  signContract,
  saveContractBody,
  getEditableContractBody,
  contractImportType,
  previewContractTemplate,
  uploadContractTemplateImport,
} from 'src/api/hr';
import { ContractImportError, streamContractTemplateImport } from 'src/api/contract-import-stream';
import type { SignatureStrokes } from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type {
  Gender,
  IContractField,
  IContractTerms,
  IEmployeeProfile,
  IContractPreview,
  IContractTemplate,
  IEmploymentContract,
  IContractCustomField,
  EmploymentContractType,
  EmploymentContractStatus,
} from 'src/types/hr';
import { GENDER_LABEL, CONTRACT_TYPE_LABEL, CONTRACT_SIGN_CONSENT, CONTRACT_STATUS_LABEL } from 'src/types/hr';

import { fVnd } from '../hr-common';
import { ContractEditor } from '../contract-editor';
import { bodyUsesField } from '../contract-fields-html';
import { SignaturePad, hasSignature, SIGNATURE_WIDTH, SIGNATURE_HEIGHT } from '../signature-pad';
import { printPage, CONTRACT_CSS, signatureImg, buildPrintPage, buildPrintHtml, renderContractHtml } from '../contract-render';

// ----------------------------------------------------------------------
// Hợp đồng lao động soạn riêng từng người. Chỉ Admin quản lý nhân sự (hr.contract.manage): mẫu có phiên bản (soạn bằng
// trình soạn hoặc tải .docx / .pdf lên để AI chuyển thành nội dung sửa được, kéo thả trường), hồ sơ nhân sự (dữ liệu cá
// nhân), soạn từ mẫu (trộn trường từ hồ sơ + cấu hình lương, xem trước, sửa tay nội dung), chốt (cấp số). Nhân viên đọc
// và ký trên app / web (chữ ký vẽ + lời cam kết) — đây là xác nhận điện tử của nhân viên, chưa phải hợp đồng điện tử theo
// NĐ 337/2025; bản giấy ký tay vẫn in và tải bản ký lên như trước. Phía cửa hàng ký để sau.
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

export { buildPrintHtml, contractBodyHtml } from '../contract-render';

/** Xem trước trên màn hình — cùng định dạng với bản in (HTML máy chủ đã lọc, chữ đã thoát HTML). */
function ContractPreview({
  body,
  isHtml,
  staffName,
  signatureSvg,
  maxHeight,
}: {
  body: string;
  isHtml?: boolean;
  staffName: string;
  signatureSvg?: string | null;
  maxHeight?: number | string;
}) {
  return (
    <Box sx={{ p: 2, borderRadius: 1, bgcolor: '#fff', border: 1, borderColor: 'divider', maxHeight, overflow: 'auto' }}>
      <style>{CONTRACT_CSS}</style>
      <div
        className="contract-doc"
        // eslint-disable-next-line react/no-danger -- HTML máy chủ đã lọc / chữ đã thoát HTML, ảnh chữ ký do mình dựng
        dangerouslySetInnerHTML={{ __html: renderContractHtml({ body, isHtml, staffName, signatureSvg }) }}
      />
    </Box>
  );
}

function printContract(contract: IEmploymentContract) {
  return printPage(buildPrintHtml(contract));
}

/** Nhãn trạng thái — chờ ký mà nhân viên đã ký trên app / web thì nói rõ đang chờ cửa hàng. */
export function contractStatusLabel(c: Pick<IEmploymentContract, 'status' | 'employeeSignedAt'>): string {
  return c.status === 'AwaitingSignature' && c.employeeSignedAt
    ? 'Nhân viên đã ký — chờ cửa hàng ký'
    : CONTRACT_STATUS_LABEL[c.status];
}

/** Đang chờ chính nhân viên ký trên app / web. */
const awaitingEmployee = (c: IEmploymentContract) => c.status === 'AwaitingSignature' && !c.employeeSignedAt && !isPaperContract(c);

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
    customValues: c.customFields?.length ? customValuesOf(c.customFields, c.customValues) : null,
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
          ? 'Soạn từ mẫu → xem trước, sửa nội dung nếu cần → chốt (cấp số) → nhân viên đọc và ký trên app / web. Bản giấy ký tay vẫn in và tải bản ký lên khi cần. Nhân viên chỉ xem được hợp đồng của mình.'
          : 'Hợp đồng lao động của bạn. Hợp đồng đang chờ ký thì bấm "Ký hợp đồng" để đọc và ký.'}
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
  const [importing, setImporting] = useState(false);
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
        <Button variant="outlined" onClick={() => setImporting(true)}>
          Đăng hợp đồng giấy
        </Button>
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
                      <Chip size="small" color={STATUS_COLOR[c.status]} label={contractStatusLabel(c)} />
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

      <ImportPaperContractDialog
        open={importing}
        onClose={() => setImporting(false)}
        onDone={(c) => {
          setImporting(false);
          load();
          setDetail(c);
        }}
      />
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

/** Hợp đồng đăng lại từ bản giấy (không soạn từ mẫu) — không có nội dung để in / tải Word. */
const isPaperContract = (c: Pick<IEmploymentContract, 'templateId'>) => c.templateId === '00000000-0000-0000-0000-000000000000';

/** Hợp đồng đã ký của một người — gốc cho phụ lục (D12). */
function useSignedParents(staffId: string, enabled: boolean) {
  const [parents, setParents] = useState<IEmploymentContract[]>([]);
  useEffect(() => {
    if (!enabled || !staffId) {
      setParents([]);
      return;
    }
    getContracts({ staffId, status: 'Signed' })
      .then((list) => setParents(list.filter((c) => c.contractType !== 'Appendix')))
      .catch(() => setParents([]));
  }, [staffId, enabled]);
  return parents;
}

/**
 * Điều khoản hợp đồng. Có `appendixParents` (hợp đồng đã ký của người đó) thì chọn được "Phụ lục" và hợp đồng gốc;
 * không truyền = không cho chọn phụ lục (sửa bản nháp đã có loại).
 */
function TermsFields({
  terms,
  onChange,
  appendixParents,
}: {
  terms: IContractTerms;
  onChange: (t: IContractTerms) => void;
  appendixParents?: IEmploymentContract[];
}) {
  return (
    <>
      <TextField
        select
        label="Loại hợp đồng"
        value={terms.contractType}
        onChange={(e) => {
          const contractType = e.target.value as EmploymentContractType;
          onChange({
            ...terms,
            contractType,
            endDate: contractType === 'Indefinite' ? null : terms.endDate,
            parentContractId: contractType === 'Appendix' ? terms.parentContractId : null,
          });
        }}
      >
        {(Object.keys(CONTRACT_TYPE_LABEL) as EmploymentContractType[])
          .filter((t) => t !== 'Appendix' || !!appendixParents || terms.contractType === 'Appendix')
          .map((t) => (
            <MenuItem key={t} value={t}>
              {CONTRACT_TYPE_LABEL[t]}
            </MenuItem>
          ))}
      </TextField>
      {terms.contractType === 'Appendix' && appendixParents && (
        <TextField
          select
          label="Phụ lục của hợp đồng"
          value={terms.parentContractId ?? ''}
          onChange={(e) => onChange({ ...terms, parentContractId: e.target.value || null })}
          helperText={appendixParents.length === 0 ? 'Người này chưa có hợp đồng đã ký.' : undefined}
          error={appendixParents.length === 0}
        >
          {appendixParents.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.contractNumber ?? 'Không số'} · {CONTRACT_TYPE_LABEL[p.contractType]} · từ {fDate(p.startDate)}
            </MenuItem>
          ))}
        </TextField>
      )}
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
        label="Không trọn thời gian"
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

/** Giá trị trường riêng của mẫu cho một hợp đồng: đã nhập, không thì mặc định của mẫu. */
export function customValuesOf(
  fields: IContractCustomField[] | null | undefined,
  values?: Record<string, string> | null
): Record<string, string> {
  return Object.fromEntries((fields ?? []).map((f) => [f.key, values?.[f.key] ?? f.defaultValue ?? '']));
}

/** Trường riêng bắt buộc còn trống (chặn soạn — nhập trước khi áp vào hợp đồng). */
const missingCustom = (fields: IContractCustomField[] | null | undefined, values?: Record<string, string> | null) =>
  (fields ?? []).filter((f) => f.required && !(values?.[f.key] ?? '').trim());

/** Thông tin riêng của mẫu (MST, người đại diện…): một ô mỗi trường, bắt buộc có *. */
function CustomValuesFields({
  fields,
  values,
  onChange,
}: {
  fields: IContractCustomField[] | null | undefined;
  values: Record<string, string> | null | undefined;
  onChange: (values: Record<string, string>) => void;
}) {
  if (!fields?.length) return null;
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Thông tin riêng của mẫu</Typography>
      {fields.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          required={f.required}
          value={values?.[f.key] ?? ''}
          onChange={(e) => onChange({ ...(values ?? {}), [f.key]: e.target.value })}
          fullWidth
        />
      ))}
    </Stack>
  );
}

/**
 * Đăng hợp đồng / phụ lục GIẤY đã ký từ trước (D12): không soạn từ mẫu — ghi loại, số trên bản giấy, ngày, rồi tải luôn
 * ảnh / PDF bản ký. Hợp đồng vào trạng thái "Đã ký", nhân viên xem bản ký trên app.
 */
function ImportPaperContractDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (c: IEmploymentContract) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffId, setStaffId] = useState('');
  const [number, setNumber] = useState('');
  const [signedOn, setSignedOn] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [terms, setTerms] = useState<IContractTerms>({
    contractType: 'FixedTermUnder12Months',
    startDate: '',
    endDate: null,
    isPartTime: true,
    minHoursPerMonth: 40,
    maxHoursPerMonth: 96,
  });
  const [saving, setSaving] = useState(false);
  const appendixParents = useSignedParents(staffId, open);

  useEffect(() => {
    if (!open) return;
    getActiveStaffUsers()
      .then((u) => setStaff(u.map((x) => ({ id: x.id, name: x.fullName }))))
      .catch(() => setStaff([]));
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const created = await importPaperContract(staffId, terms, number.trim() || null, note.trim() || null);
      // Tạo xong mà tải tệp lỗi: hợp đồng vẫn còn ở "Chờ ký" — mở chi tiết để tải lại bản ký.
      try {
        const uploaded = await uploadContractFiles(created.id, files);
        onDone(await markContractSigned(created.id, signedOn, uploaded));
        enqueueSnackbar('Đã đăng hợp đồng giấy và bản ký');
      } catch (err) {
        enqueueSnackbar(apiErrorMessage(err, 'Đã đăng hợp đồng nhưng chưa tải được bản ký — tải lại trong chi tiết'), {
          variant: 'warning',
        });
        onDone(created);
      }
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đăng được hợp đồng'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const ready =
    !!staffId &&
    !!terms.startDate &&
    !!signedOn &&
    files.length > 0 &&
    (terms.contractType !== 'Appendix' || !!terms.parentContractId);

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Đăng hợp đồng giấy có sẵn</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            Dùng cho hợp đồng / phụ lục đã ký trên giấy trước khi dùng hệ thống. Không soạn từ mẫu — nội dung xem ở bản ký tải lên.
          </Alert>
          <TextField select label="Nhân viên" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <TermsFields terms={terms} onChange={setTerms} appendixParents={appendixParents} />
          <Stack direction="row" spacing={2}>
            <TextField label="Số trên bản giấy (nếu có)" value={number} onChange={(e) => setNumber(e.target.value)} fullWidth />
            <TextField
              type="date"
              label="Ngày ký"
              value={signedOn}
              onChange={(e) => setSignedOn(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
          <TextField label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          <Button variant="outlined" component="label">
            Chọn ảnh / PDF bản ký ({files.length})
            <input hidden multiple type="file" accept={FILE_TYPES} onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} />
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!ready} onClick={save}>
          Đăng hợp đồng
        </LoadingButton>
      </DialogActions>
    </Dialog>
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
  const appendixParents = useSignedParents(staffId, open);
  const selectedTemplate = templates.find((t) => t.id === templateId);

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
              if (t)
                setTerms((prev) => ({
                  ...prev,
                  contractType: t.contractType,
                  customValues: t.customFields?.length ? customValuesOf(t.customFields) : null,
                }));
            }}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name} · bản {t.version}
              </MenuItem>
            ))}
          </TextField>
          <TermsFields terms={terms} onChange={setTerms} appendixParents={appendixParents} />
          <CustomValuesFields
            fields={selectedTemplate?.customFields}
            values={terms.customValues}
            onChange={(customValues) => setTerms((prev) => ({ ...prev, customValues }))}
          />
          <Typography variant="caption" color="text.secondary">
            Lương lấy theo cấu hình lương đang hiệu lực tại ngày bắt đầu. Thông tin cá nhân lấy từ tab &quot;Hồ sơ nhân sự&quot;.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Đóng
        </Button>
        <LoadingButton
          variant="contained"
          loading={saving}
          disabled={
            !staffId ||
            !templateId ||
            !terms.startDate ||
            (terms.contractType === 'Appendix' && !terms.parentContractId) ||
            missingCustom(selectedTemplate?.customFields, terms.customValues).length > 0
          }
          onClick={save}
        >
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
  const [bodyEdit, setBodyEdit] = useState<string | null>(null);
  // Tên tiếng Việt cho thẻ trường còn lại khi sửa nội dung (số hợp đồng, chỗ ký).
  const [fieldLabels, setFieldLabels] = useState<IContractField[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTerms(contract ? termsOf(contract) : null);
    setFiles([]);
    setSignedOn(contract?.signedOn ?? new Date().toISOString().slice(0, 10));
    setAction(null);
    setBodyEdit(null);
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
      content:
        'Nội dung sẽ khoá lại và được cấp số. Nhân viên được báo để đọc và ký trên app / web; bản giấy vẫn in và tải bản ký lên khi cần.',
      confirmText: 'Chốt',
    });
    if (ok) run(() => finalizeContract(c.id), 'Đã chốt — nhân viên được báo để ký', 'Không chốt được');
  };

  const openBodyEditor = async () => {
    setBusy(true);
    try {
      setBodyEdit(await getEditableContractBody(c.id));
      if (fieldLabels.length === 0) getContractFields().then(setFieldLabels).catch(() => {});
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không mở được nội dung để sửa'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const saveBody = async () => {
    if (bodyEdit === null) return;
    await run(() => saveContractBody(c.id, bodyEdit), 'Đã lưu nội dung', 'Không lưu được nội dung');
    setBodyEdit(null);
  };

  const remergeFromTemplate = async () => {
    const ok = await confirm({
      title: 'Trộn lại từ mẫu',
      content: 'Bỏ toàn bộ phần đã sửa tay, nội dung trộn lại từ mẫu theo hồ sơ và điều khoản hiện tại.',
      confirmText: 'Trộn lại',
      destructive: true,
    });
    if (ok) run(() => saveContractBody(c.id, null), 'Đã trộn lại từ mẫu', 'Không trộn lại được');
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
        <Chip size="small" color={STATUS_COLOR[c.status]} label={contractStatusLabel(c)} sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Box sx={{ flex: 3, minWidth: 0 }}>
            {c.status === 'Draft' && c.missingFields.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Còn thiếu: {c.missingFields.join(', ')}. Bổ sung ở tab &quot;Hồ sơ nhân sự&quot;, cấu hình lương hoặc thông tin riêng
                của mẫu bên phải, rồi bấm &quot;Lưu &amp; trộn lại&quot;.
              </Alert>
            )}
            {c.status === 'Draft' && c.bodyEdited && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nội dung đã sửa tay — đổi điều khoản không cập nhật nội dung. Bấm &quot;Trộn lại từ mẫu&quot; để bỏ phần sửa tay.
              </Alert>
            )}
            <ContractPreview
              body={c.renderedBody}
              isHtml={c.isHtml}
              staffName={c.staffName}
              signatureSvg={c.employeeSignatureSvg}
              maxHeight={560}
            />
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
                <CustomValuesFields
                  fields={c.customFields}
                  values={terms.customValues}
                  onChange={(customValues) => setTerms((prev) => (prev ? { ...prev, customValues } : prev))}
                />
                <Stack direction="row" spacing={1}>
                  <Button disabled={busy} onClick={() => run(() => updateContractDraft(c.id, terms), 'Đã trộn lại', 'Không lưu được')}>
                    Lưu & trộn lại
                  </Button>
                  <LoadingButton variant="contained" loading={busy} disabled={c.missingFields.length > 0} onClick={finalize}>
                    Chốt
                  </LoadingButton>
                </Stack>
                {!isPaperContract(c) && (
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" disabled={busy} onClick={openBodyEditor}>
                      Sửa nội dung
                    </Button>
                    {c.bodyEdited && (
                      <Button color="inherit" disabled={busy} onClick={remergeFromTemplate}>
                        Trộn lại từ mẫu
                      </Button>
                    )}
                  </Stack>
                )}
              </>
            )}

            {c.employeeSignedAt && (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Nhân viên đã ký lúc {fDateTime(c.employeeSignedAt, 'HH:mm dd/MM/yyyy')}</Typography>
                    {c.employeeSignatureSvg && <SignatureImage svg={c.employeeSignatureSvg} />}
                    <Typography variant="caption" color="text.secondary">
                      Kèm lời cam kết: &quot;{CONTRACT_SIGN_CONSENT}&quot; Phía cửa hàng ký sau.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}

            {c.status !== 'Draft' && c.status !== 'Voided' && !isPaperContract(c) && (
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

      <Dialog open={bodyEdit !== null} onClose={() => !busy && setBodyEdit(null)} fullWidth maxWidth="lg">
        <DialogTitle>Sửa nội dung hợp đồng · {c.staffName}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Thông tin đã điền sẵn theo hồ sơ. Số hợp đồng {'{{so_hop_dong}}'} được cấp khi chốt; hai trường chữ ký giữ nguyên.
          </Alert>
          {bodyEdit !== null && (
            <ContractEditor value={bodyEdit} onChange={setBodyEdit} labelFields={fieldLabels} minHeight={420} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBodyEdit(null)} disabled={busy}>
            Huỷ
          </Button>
          <LoadingButton variant="contained" loading={busy} onClick={saveBody}>
            Lưu nội dung
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

/** Ảnh chữ ký nhân viên (SVG do máy chủ dựng). */
function SignatureImage({ svg }: { svg: string }) {
  return (
    <Box
      sx={{ height: 70, '& img': { height: 70, maxWidth: '100%' } }}
      // eslint-disable-next-line react/no-danger -- ảnh data URL dựng từ SVG của máy chủ
      dangerouslySetInnerHTML={{ __html: signatureImg(svg) }}
    />
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

type ImportState = {
  templateId: string;
  startedAt: number;
  steps: { key: string; text: string }[];
  done: boolean;
  error?: string;
};

/** Tiến trình tải mẫu: các bước máy chủ báo về + số giây đã chạy; xong thì ẩn (lỗi thì giữ lời báo). */
function ImportProgress({ state }: { state: ImportState }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.done) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.done]);

  if (state.error) return <Alert severity="error">{state.error}</Alert>;
  if (state.done) return null;
  const seconds = Math.max(0, Math.round((now - state.startedAt) / 1000));
  return (
    <Alert severity="info" icon={<CircularProgress size={18} />}>
      <Stack spacing={0.25}>
        {state.steps.map((s, i) => (
          <Typography
            key={`${s.key}-${i}`}
            variant="body2"
            sx={{ color: i < state.steps.length - 1 ? 'text.secondary' : 'text.primary' }}
          >
            {i < state.steps.length - 1 ? '✓ ' : ''}
            {s.text}
          </Typography>
        ))}
        <Typography variant="caption" color="text.secondary">
          {seconds} giây — đóng cửa sổ vẫn giữ nội dung đã đọc được.
        </Typography>
      </Stack>
    </Alert>
  );
}

function TemplatesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [confirm, confirmDialog] = useConfirmDialog();
  const [rows, setRows] = useState<IContractTemplate[]>([]);
  const [fields, setFields] = useState<IContractField[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<IContractTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  // Tải mẫu lên: các bước máy chủ báo về (AI gắn trường có thể ~1 phút); nội dung đọc được vào trình soạn ngay khi có.
  const [importState, setImportState] = useState<ImportState | null>(null);
  const importing = !!importState && !importState.done;
  const importAbort = useRef<AbortController | null>(null);
  // Mẫu đang mở trong hộp sửa — kết quả tải về sau chỉ đổ vào đúng mẫu đó (đóng / mở mẫu khác thì chỉ tải lại danh sách).
  const editIdRef = useRef<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    editIdRef.current = edit?.id ?? null;
  }, [edit]);

  useEffect(() => () => importAbort.current?.abort(), []);

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

  /**
   * Tải tệp mẫu lên: chưa có bản nháp thì tạo mẫu trống trước; PUT tệp; máy chủ đọc tệp (lưu ngay vào bản nháp, gửi về
   * "content") rồi AI gắn trường ("result"). Đóng hộp thoại giữa chừng vẫn giữ nội dung đã lưu.
   */
  const importFile = async (file: File, draft: IContractTemplate | null) => {
    if (!contractImportType(file)) {
      enqueueSnackbar('Chỉ nhận tệp .docx hoặc .pdf', { variant: 'error' });
      return;
    }
    importAbort.current?.abort();
    const controller = new AbortController();
    importAbort.current = controller;
    let templateId: string | null = draft?.id ?? null;
    const update = (fn: (s: ImportState) => ImportState) =>
      setImportState((s) => (s && s.templateId === templateId ? fn(s) : s));

    try {
      const target = draft ?? (await createContractTemplate(null));
      templateId = target.id;
      if (!draft) setEdit(target);
      editIdRef.current = target.id;
      setImportState({
        templateId: target.id,
        startedAt: Date.now(),
        steps: [{ key: 'upload', text: 'Đang tải tệp lên…' }],
        done: false,
      });

      const upload = await uploadContractTemplateImport(target.id, file);
      const result = await streamContractTemplateImport(
        target.id,
        upload,
        (e) => {
          if (e.type === 'step') update((s) => ({ ...s, steps: [...s.steps, { key: e.key, text: e.text }] }));
          else if (editIdRef.current === e.template.id) setEdit(e.template);
        },
        controller.signal
      );

      if (editIdRef.current === result.template.id) setEdit(result.template);
      // AI có thể tạo sẵn trường riêng của mẫu — nạp lại mẫu để bảng trường hiện đủ.
      const fresh = (await getContractTemplates().catch(() => [] as IContractTemplate[])).find((t) => t.id === result.template.id);
      if (fresh && editIdRef.current === fresh.id) setEdit(fresh);
      update((s) => ({ ...s, done: true }));
      if (result.warning) enqueueSnackbar(result.warning, { variant: 'warning' });
      else
        enqueueSnackbar(
          result.fieldsPlacedByAi ? 'Đã đọc mẫu và gắn trường — rà lại trước khi công bố' : 'Đã đọc mẫu — kéo trường vào chỗ cần điền'
        );
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof ContractImportError ? err.message : apiErrorMessage(err, 'Không đọc được tệp mẫu');
      update((s) => ({ ...s, done: true, error: message }));
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      load();
    }
  };

  const saveDraft = (t: IContractTemplate) =>
    updateContractTemplate(t.id, {
      code: t.code,
      name: t.name,
      contractType: t.contractType,
      body: t.body,
      isHtml: !!t.isHtml,
      customFields: t.customFields ?? [],
    });

  const save = async (publish: boolean) => {
    if (!edit) return;
    const ok = await run(() => saveDraft(edit), 'Đã lưu bản nháp', 'Không lưu được');
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
    return [...fields, ...(edit.customFields ?? [])]
      .filter((f) => f.required && !bodyUsesField(edit.body, f.key))
      .map((f) => f.label);
  }, [edit, fields]);

  const fileInput = (draft: IContractTemplate | null) => (
    <input
      hidden
      type="file"
      accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) importFile(file, draft);
      }}
    />
  );

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} justifyContent="flex-end">
        <Button variant="outlined" disabled={busy || importing} onClick={() => newDraft(null)}>
          Tạo mẫu trống
        </Button>
        <LoadingButton variant="contained" component="label" loading={importing} disabled={busy}>
          Tải mẫu lên (.docx / .pdf)
          {fileInput(null)}
        </LoadingButton>
      </Stack>
      <Card>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Chưa có mẫu — tải mẫu đã soạn (.docx / .pdf) lên để AI chuyển thành nội dung sửa được và gắn trường, hoặc tạo mẫu
            trống rồi soạn. Rà lại cùng kế toán rồi công bố.
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

      <Dialog open={!!edit} onClose={() => !busy && setEdit(null)} fullWidth maxWidth="xl">
        <DialogTitle>
          {edit?.publishedAt ? 'Mẫu đã công bố' : 'Sửa bản nháp mẫu'} · bản {edit?.version}
        </DialogTitle>
        <DialogContent>
          {edit && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
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
                  sx={{ width: { md: 260 } }}
                />
                <TextField
                  select
                  label="Loại mặc định"
                  value={edit.contractType}
                  disabled={!!edit.publishedAt}
                  onChange={(e) => setEdit({ ...edit, contractType: e.target.value as EmploymentContractType })}
                  sx={{ width: { md: 300 } }}
                >
                  {(Object.keys(CONTRACT_TYPE_LABEL) as EmploymentContractType[]).map((t) => (
                    <MenuItem key={t} value={t}>
                      {CONTRACT_TYPE_LABEL[t]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              {importState?.templateId === edit.id && <ImportProgress state={importState} />}

              {edit.isHtml ? (
                <ContractEditor
                  value={edit.body}
                  onChange={(body) => setEdit((prev) => (prev ? { ...prev, body } : prev))}
                  fields={fields}
                  customFields={edit.customFields ?? []}
                  onCustomFieldsChange={(customFields) => setEdit((prev) => (prev ? { ...prev, customFields } : prev))}
                  disabled={!!edit.publishedAt || (importing && importState?.templateId === edit.id)}
                />
              ) : (
                <LegacyTemplateBody
                  edit={edit}
                  fields={fields}
                  busy={busy}
                  onChange={setEdit}
                  onUploadDocx={uploadDocx}
                  onRemoveDocx={removeDocx}
                />
              )}

              {!edit.publishedAt && missingKeys.length > 0 && (
                <Alert severity="info">Mẫu chưa dùng các trường: {missingKeys.join(', ')}.</Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {edit && !edit.publishedAt && (
            <LoadingButton component="label" color="inherit" loading={importing} disabled={busy} sx={{ mr: 'auto' }}>
              Tải mẫu lên thay nội dung
              {fileInput(edit)}
            </LoadingButton>
          )}
          <Button disabled={busy || importing} onClick={() => setPreviewOpen(true)}>
            Xem trước
          </Button>
          <Button onClick={() => setEdit(null)} disabled={busy}>
            Đóng
          </Button>
          {edit && !edit.publishedAt && (
            <>
              <Button disabled={busy || importing} onClick={() => save(false)}>
                Lưu nháp
              </Button>
              <LoadingButton variant="contained" loading={busy} disabled={importing} onClick={() => save(true)}>
                Lưu & công bố
              </LoadingButton>
            </>
          )}
        </DialogActions>
        {confirmDialog}
      </Dialog>

      <TemplatePreviewDialog
        open={previewOpen && !!edit}
        template={edit}
        // Bản nháp: lưu trước để xem đúng nội dung đang sửa.
        beforePreview={edit && !edit.publishedAt ? () => saveDraft(edit) : undefined}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

/** Mẫu chữ cũ (trước trình soạn): ô chữ + mẫu Word tuỳ chọn, trường trộn bấm để chép. */
function LegacyTemplateBody({
  edit,
  fields,
  busy,
  onChange,
  onUploadDocx,
  onRemoveDocx,
}: {
  edit: IContractTemplate;
  fields: IContractField[];
  busy: boolean;
  onChange: (t: IContractTemplate) => void;
  onUploadDocx: (file: File) => void;
  onRemoveDocx: () => void;
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
      <Stack spacing={2} sx={{ flex: 3, minWidth: 0 }}>
        <TextField
          label="Nội dung"
          value={edit.body}
          disabled={!!edit.publishedAt}
          onChange={(e) => onChange({ ...edit, body: e.target.value })}
          multiline
          minRows={20}
          maxRows={32}
          InputProps={{ sx: { fontFamily: '"Times New Roman", Times, serif', fontSize: 15 } }}
        />
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">Mẫu Word (.docx) — giữ nguyên định dạng của bạn</Typography>
              <Typography variant="caption" color="text.secondary">
                Gõ các trường dạng {'{{ho_ten}}'} trong tệp Word rồi gắn vào đây: khi chốt hợp đồng, hệ thống điền thông tin
                từng người và cho tải bản Word để in.
              </Typography>
              {edit.docxFileName ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="success" label={edit.docxFileName} />
                  {!edit.publishedAt && (
                    <Button size="small" color="inherit" disabled={busy} onClick={onRemoveDocx}>
                      Bỏ mẫu Word
                    </Button>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Chưa có — hợp đồng in theo nội dung chữ ở trên.
                </Typography>
              )}
              {!edit.publishedAt && (
                <Button variant="outlined" component="label" size="small" disabled={busy} sx={{ alignSelf: 'flex-start' }}>
                  {edit.docxFileName ? 'Thay mẫu Word' : 'Gắn mẫu Word (.docx)'}
                  <input
                    hidden
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) onUploadDocx(file);
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
          Viết đúng dạng {'{{ma_truong}}'} trong nội dung. Trường bắt buộc còn trống thì không chốt được hợp đồng. Khi in: dòng{' '}
          {'[[CHU_KY]]'} thành khối chữ ký hai bên, {'[[NGAT_TRANG]]'} sang trang mới.
        </Typography>
        {fields.map((f) => (
          <Stack key={f.key} direction="row" spacing={1} alignItems="center">
            <Chip size="small" variant="outlined" label={`{{${f.key}}}`} onClick={() => navigator.clipboard?.writeText(`{{${f.key}}}`)} />
            <Typography variant="caption">
              {f.label}
              {f.required ? ' *' : ''}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

/** Xem trước mẫu với hồ sơ một nhân viên (khổ giấy, in được). */
function TemplatePreviewDialog({
  open,
  template,
  beforePreview,
  onClose,
}: {
  open: boolean;
  template: IContractTemplate | null;
  beforePreview?: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([]);
  const [staffId, setStaffId] = useState('');
  const [result, setResult] = useState<IContractPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    getActiveStaffUsers()
      .then((u) => setStaff(u.map((x) => ({ id: x.id, name: x.fullName }))))
      .catch(() => setStaff([]));
  }, [open]);

  const staffName = staff.find((s) => s.id === staffId)?.name ?? '';

  const show = async () => {
    if (!template || !staffId) return;
    setLoading(true);
    try {
      if (beforePreview) await beforePreview();
      setResult(await previewContractTemplate(template.id, staffId));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xem trước được'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const print = () => {
    if (!result) return;
    const html = buildPrintPage(
      `Xem trước – ${template?.name ?? ''} – ${staffName}`,
      renderContractHtml({ body: result.body, isHtml: result.isHtml, staffName })
    );
    if (!printPage(html)) enqueueSnackbar('Trình duyệt chặn cửa sổ in — cho phép pop-up rồi thử lại.', { variant: 'warning' });
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Xem trước · {template?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              select
              size="small"
              label="Nhân viên"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              {staff.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </TextField>
            <LoadingButton variant="contained" loading={loading} disabled={!staffId} onClick={show}>
              Xem
            </LoadingButton>
          </Stack>
          {result && result.missingFields.length > 0 && (
            <Alert severity="warning">
              Hồ sơ còn thiếu: {result.missingFields.join(', ')} — bổ sung ở tab &quot;Hồ sơ nhân sự&quot; trước khi soạn hợp đồng.
            </Alert>
          )}
          {result ? (
            <Box sx={{ bgcolor: 'background.neutral', p: { xs: 1, md: 3 }, borderRadius: 1 }}>
              <Box sx={{ maxWidth: 794, mx: 'auto', boxShadow: 1 }}>
                <ContractPreview body={result.body} isHtml={result.isHtml} staffName={staffName} maxHeight="65vh" />
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chọn nhân viên để xem mẫu đã điền thông tin hồ sơ, lương hiện tại, ngày hôm nay.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Đóng
        </Button>
        <Button variant="outlined" disabled={!result} onClick={print}>
          In
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Của tôi (xem + ký) ─────────────────────────────────────────────────

function MineTab() {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState<IEmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [signing, setSigning] = useState<IEmploymentContract | null>(null);

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
              <Chip size="small" color={STATUS_COLOR[c.status]} label={contractStatusLabel(c)} />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {CONTRACT_TYPE_LABEL[c.contractType]} · {fDate(c.startDate)} – {c.endDate ? fDate(c.endDate) : 'không thời hạn'}
              {c.signedOn && ` · ký ngày ${fDate(c.signedOn)}`}
            </Typography>
            {c.employeeSignedAt && (
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="body2">Bạn đã ký lúc {fDateTime(c.employeeSignedAt, 'HH:mm dd/MM/yyyy')}</Typography>
                {c.employeeSignatureSvg && <SignatureImage svg={c.employeeSignatureSvg} />}
              </Stack>
            )}
            {c.files.length > 0 && (
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {c.files.map((f, i) => (
                  <Link key={f.id} href={f.url} target="_blank" rel="noopener">
                    Bản ký trang {i + 1}
                  </Link>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {awaitingEmployee(c) && (
                <Button size="small" variant="contained" onClick={() => setSigning(c)}>
                  Ký hợp đồng
                </Button>
              )}
              <Button size="small" onClick={() => setOpen(open === c.id ? null : c.id)}>
                {open === c.id ? 'Ẩn nội dung' : 'Xem nội dung'}
              </Button>
            </Stack>
            {open === c.id && (
              <Box sx={{ mt: 1 }}>
                <ContractPreview
                  body={c.renderedBody}
                  isHtml={c.isHtml}
                  staffName={c.staffName}
                  signatureSvg={c.employeeSignatureSvg}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      ))}

      <SignContractDialog
        contract={signing}
        onClose={() => setSigning(null)}
        onSigned={(updated) => {
          setSigning(null);
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          enqueueSnackbar('Đã ký hợp đồng');
        }}
      />
    </Stack>
  );
}

/**
 * Nhân viên ký hợp đồng của mình: đọc toàn văn, ký tay vào khung, tích lời cam kết, gửi. Máy chủ lưu nét ký + thời điểm;
 * phía cửa hàng ký sau.
 */
export function SignContractDialog({
  contract,
  onClose,
  onSigned,
}: {
  contract: IEmploymentContract | null;
  onClose: () => void;
  onSigned: (c: IEmploymentContract) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [strokes, setStrokes] = useState<SignatureStrokes>([]);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStrokes([]);
    setAgree(false);
  }, [contract]);

  const submit = async () => {
    if (!contract) return;
    setSaving(true);
    try {
      onSigned(await signContract(contract.id, { strokes, width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT }));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Chưa ký được hợp đồng'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!contract} onClose={() => !saving && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Ký hợp đồng số {contract?.contractNumber}</DialogTitle>
      <DialogContent>
        {contract && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Đọc kỹ toàn bộ hợp đồng trước khi ký. Thông tin sai thì báo quản lý sửa hồ sơ trước, đừng ký.
            </Typography>
            <ContractPreview
              body={contract.renderedBody}
              isHtml={contract.isHtml}
              staffName={contract.staffName}
              maxHeight="45vh"
            />
            <Typography variant="subtitle2">Chữ ký của bạn</Typography>
            <SignaturePad value={strokes} onChange={setStrokes} disabled={saving} />
            <FormControlLabel
              control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />}
              label={CONTRACT_SIGN_CONSENT}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Để sau
        </Button>
        <LoadingButton variant="contained" loading={saving} disabled={!agree || !hasSignature(strokes)} onClick={submit}>
          Ký hợp đồng
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
