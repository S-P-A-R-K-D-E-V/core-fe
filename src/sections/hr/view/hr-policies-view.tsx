'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
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

import { fDateTime } from 'src/utils/format-time';
import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { useConfirmDialog } from 'src/hooks/use-confirm-dialog';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import {
  getPolicyDocuments,
  publishPolicyDocument,
  deactivatePolicyDocument,
  acknowledgePolicyDocument,
  getPolicyAcknowledgements,
} from 'src/api/hr';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { IPolicyDocument, IPolicyAcknowledgementStatus } from 'src/types/hr';

// ----------------------------------------------------------------------
// Nội quy / quy chế / phụ lục phải đọc và xác nhận (Nội quy Điều 2, 32; Quy chế Điều 30). Mỗi lần sửa = phiên bản mới
// cùng mã: bản cũ hết hiệu lực, mọi người xác nhận lại. Đăng văn bản cần hr.policy.manage (Admin).
// ----------------------------------------------------------------------

type Draft = { code: string; title: string; url: string; summary: string };

const emptyDraft: Draft = { code: '', title: '', url: '', summary: '' };

export default function HrPoliciesView() {
  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuthContext();
  const [confirm, confirmDialog] = useConfirmDialog();
  const canManage = hasPermission(user, PERMISSIONS.hr.policyManage);

  const [active, setActive] = useState<IPolicyDocument[]>([]);
  const [all, setAll] = useState<IPolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<IPolicyAcknowledgementStatus | null>(null);

  const load = useCallback(async () => {
    try {
      setActive(await getPolicyDocuments('active'));
      if (canManage) setAll(await getPolicyDocuments('all'));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được văn bản'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [canManage, enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const acknowledge = async (doc: IPolicyDocument) => {
    const ok = await confirm({
      title: 'Xác nhận đã đọc',
      content: `Tôi đã đọc và hiểu "${doc.title}" (bản ${doc.version}).`,
      confirmText: 'Tôi đã đọc và hiểu',
    });
    if (!ok) return;
    try {
      await acknowledgePolicyDocument(doc.id);
      enqueueSnackbar('Đã xác nhận');
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không xác nhận được'), { variant: 'error' });
    }
  };

  const publish = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await publishPolicyDocument({
        code: draft.code.trim(),
        title: draft.title.trim(),
        url: draft.url.trim() || null,
        summary: draft.summary.trim() || null,
      });
      enqueueSnackbar('Đã đăng — mọi người được báo để đọc và xác nhận');
      setDraft(null);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không đăng được văn bản'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (doc: IPolicyDocument) => {
    const ok = await confirm({
      content: `Ngừng hiệu lực "${doc.title}" bản ${doc.version}? Nhân viên sẽ không còn thấy văn bản này.`,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deactivatePolicyDocument(doc.id);
      load();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không ngừng được'), { variant: 'error' });
    }
  };

  const showStatus = async (doc: IPolicyDocument) => {
    try {
      setStatus(await getPolicyAcknowledgements(doc.id));
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Không tải được danh sách xác nhận'), { variant: 'error' });
    }
  };

  const newVersionOf = (doc: IPolicyDocument) =>
    setDraft({ code: doc.code, title: doc.title, url: doc.url ?? '', summary: doc.summary ?? '' });

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Nội quy & ký xác nhận"
        links={[{ name: 'Nhân sự' }, { name: 'Nội quy & ký xác nhận' }]}
        action={
          canManage && (
            <Button variant="contained" onClick={() => setDraft({ ...emptyDraft })}>
              Đăng văn bản
            </Button>
          )
        }
        sx={{ mb: 3 }}
      />

      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : (
        <Stack spacing={2}>
          {active.length === 0 && <Alert severity="info">Chưa có văn bản nào đang hiệu lực.</Alert>}
          {active.map((doc) => (
            <Card key={doc.id}>
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6">
                      {doc.title}{' '}
                      <Typography component="span" variant="body2" color="text.secondary">
                        · bản {doc.version} · {fDateTime(doc.publishedAt, 'dd/MM/yyyy')}
                      </Typography>
                    </Typography>
                    {doc.summary && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mt: 1 }}>
                        {doc.summary}
                      </Typography>
                    )}
                    {doc.url && (
                      <Link href={doc.url} target="_blank" rel="noopener" sx={{ display: 'inline-block', mt: 1 }}>
                        Mở văn bản đầy đủ
                      </Link>
                    )}
                  </Box>
                  <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }} sx={{ flexShrink: 0 }}>
                    {doc.acknowledgedAt ? (
                      <Chip color="success" label={`Đã xác nhận ${fDateTime(doc.acknowledgedAt, 'dd/MM HH:mm')}`} />
                    ) : (
                      <Button variant="contained" onClick={() => acknowledge(doc)}>
                        Tôi đã đọc và hiểu
                      </Button>
                    )}
                    {canManage && (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => showStatus(doc)}>
                          Ai đã xác nhận
                        </Button>
                        <Button size="small" onClick={() => newVersionOf(doc)}>
                          Sửa (bản mới)
                        </Button>
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}

          {canManage && all.some((d) => !d.isActive) && (
            <Card>
              <Typography variant="subtitle1" sx={{ p: 2, pb: 0 }}>
                Phiên bản cũ
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Văn bản</TableCell>
                      <TableCell>Mã</TableCell>
                      <TableCell>Bản</TableCell>
                      <TableCell>Đăng lúc</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {all
                      .filter((d) => !d.isActive)
                      .map((d) => (
                        <TableRow key={d.id}>
                          <TableCell>{d.title}</TableCell>
                          <TableCell>{d.code}</TableCell>
                          <TableCell>{d.version}</TableCell>
                          <TableCell>{fDateTime(d.publishedAt, 'dd/MM/yyyy')}</TableCell>
                          <TableCell align="right">
                            <Button size="small" onClick={() => showStatus(d)}>
                              Ai đã xác nhận
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}

          {canManage && active.length > 0 && (
            <Stack direction="row" justifyContent="flex-end">
              {active.map((d) => (
                <Button key={d.id} size="small" color="error" onClick={() => deactivate(d)}>
                  Ngừng &quot;{d.title}&quot;
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      <Dialog open={!!draft} onClose={() => !saving && setDraft(null)} fullWidth maxWidth="md">
        <DialogTitle>Đăng văn bản</DialogTitle>
        <DialogContent>
          {draft && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info">
                Cùng mã = phiên bản mới: bản cũ hết hiệu lực và mọi người phải xác nhận lại. Mọi nhân viên được báo khi đăng.
              </Alert>
              <TextField
                label="Mã văn bản"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toLowerCase() })}
                helperText="Chữ thường không dấu, số, gạch ngang — vd noi-quy, quy-che-luong, phu-luc-a."
              />
              <TextField label="Tên văn bản" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <TextField
                label="Link văn bản đầy đủ (https://…)"
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
              <TextField
                label="Tóm tắt điểm chính (hiện trên app trước nút xác nhận)"
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                multiline
                minRows={6}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraft(null)} disabled={saving}>
            Đóng
          </Button>
          <LoadingButton
            variant="contained"
            loading={saving}
            disabled={!draft?.code.trim() || !draft?.title.trim() || (!draft?.url.trim() && !draft?.summary.trim())}
            onClick={publish}
          >
            Đăng
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <Dialog open={!!status} onClose={() => setStatus(null)} fullWidth maxWidth="sm">
        <DialogTitle>
          {status?.document.title} · bản {status?.document.version}
        </DialogTitle>
        <DialogContent>
          {status && (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                {status.acknowledged}/{status.total} người đã xác nhận
              </Typography>
              {status.rows.map((r) => (
                <Stack key={r.userId} direction="row" justifyContent="space-between">
                  <Typography variant="body2">{r.fullName}</Typography>
                  {r.acknowledgedAt ? (
                    <Typography variant="body2" color="success.main">
                      {fDateTime(r.acknowledgedAt, 'dd/MM HH:mm')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="warning.main">
                      Chưa xác nhận
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatus(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      {confirmDialog}
    </Container>
  );
}
