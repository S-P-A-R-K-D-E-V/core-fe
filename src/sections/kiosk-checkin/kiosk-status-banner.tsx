'use client';

import Alert from '@mui/material/Alert';

// ----------------------------------------------------------------------

type Props = {
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export default function KioskStatusBanner({ severity, message }: Props) {
  return (
    <Alert severity={severity} variant="filled" sx={{ justifyContent: 'center', boxShadow: 3 }}>
      {message}
    </Alert>
  );
}
