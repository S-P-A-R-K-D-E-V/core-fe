'use client';

import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { useCopyToClipboard } from 'src/hooks/use-copy-to-clipboard';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Ô chỉ đọc + nút sao chép (webhook URL, khoá hệ thống tự sinh).
// ----------------------------------------------------------------------

type Props = {
  label: string;
  value: string;
  /** Câu báo khi sao chép xong */
  copiedMessage?: string;
  helperText?: React.ReactNode;
};

export default function CopyField({ label, value, copiedMessage, helperText }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { copy } = useCopyToClipboard();

  const handleCopy = async () => {
    const ok = await copy(value);
    enqueueSnackbar(
      ok
        ? (copiedMessage ?? `Đã sao chép ${label}`)
        : 'Không sao chép được — hãy chọn và sao chép tay',
      {
        variant: ok ? 'success' : 'error',
      }
    );
  };

  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={value}
      helperText={helperText}
      onFocus={(e) => e.target.select()}
      InputProps={{
        readOnly: true,
        sx: { fontFamily: 'monospace', fontSize: 13 },
        endAdornment: (
          <InputAdornment position="end">
            <Tooltip title="Sao chép">
              <IconButton edge="end" aria-label={`Sao chép ${label}`} onClick={handleCopy}>
                <Iconify icon="solar:copy-bold" width={20} />
              </IconButton>
            </Tooltip>
          </InputAdornment>
        ),
      }}
    />
  );
}
