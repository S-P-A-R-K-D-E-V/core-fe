import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { alpha } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import LoadingButton from '@mui/lab/LoadingButton';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import { ANNOUNCEMENT_SEVERITY_LABEL, type IPendingAnnouncement } from 'src/types/announcement';

import Iconify from 'src/components/iconify';

import AnnouncementBody from './announcement-body';
import { severityMeta, isInternalPath } from './utils';

// ----------------------------------------------------------------------

type Props = {
  announcement: IPendingAnnouncement;
  /** Còn bao nhiêu thông báo xếp sau cái này. */
  remaining: number;
  busy: boolean;
  onDismiss: () => void;
  onAcknowledge: () => void;
  onCta: () => void;
};

export default function AnnouncementDialog({ announcement, remaining, busy, onDismiss, onAcknowledge, onCta }: Props) {
  const { requireAck, title, bodyMarkdown, severity, ctaLabel, ctaUrl } = announcement;
  const meta = severityMeta(severity);
  const showCta = !!ctaLabel && isInternalPath(ctaUrl);

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      scroll="paper"
      aria-labelledby="announcement-title"
      disableEscapeKeyDown={requireAck}
      onClose={() => {
        // Bắt buộc xác nhận: Esc và bấm ngoài không đóng, chỉ nút "Đã hiểu".
        if (!requireAck) onDismiss();
      }}
    >
      <DialogTitle id="announcement-title" sx={{ pr: requireAck ? 3 : 6 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              display: 'flex',
              borderRadius: '50%',
              alignItems: 'center',
              justifyContent: 'center',
              color: `${meta.color}.main`,
              bgcolor: (theme) => alpha(theme.palette[meta.color].main, 0.16),
            }}
          >
            <Iconify icon={meta.icon} width={26} />
          </Box>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="h6" component="span" sx={{ wordBreak: 'break-word' }}>
              {title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip size="small" color={meta.color} variant="soft" label={ANNOUNCEMENT_SEVERITY_LABEL[severity] ?? severity} />
              {remaining > 0 && (
                <Typography variant="caption" color="text.secondary">
                  Còn {remaining} thông báo nữa
                </Typography>
              )}
            </Stack>
          </Stack>
        </Stack>
        {!requireAck && (
          <IconButton aria-label="Đóng" onClick={onDismiss} sx={{ position: 'absolute', top: 12, right: 12 }}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent dividers>
        <AnnouncementBody body={bodyMarkdown} />
      </DialogContent>

      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {requireAck && (
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, flexBasis: { xs: '100%', sm: 0 } }}>
            Bấm &quot;Đã hiểu&quot; để xác nhận bạn đã đọc thông báo này.
          </Typography>
        )}
        {showCta && (
          <Button variant="outlined" color="inherit" disabled={busy} onClick={onCta}>
            {ctaLabel}
          </Button>
        )}
        <LoadingButton variant="contained" color={meta.color} loading={busy} onClick={onAcknowledge}>
          Đã hiểu
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
