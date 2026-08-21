'use client';

import Alert from '@mui/material/Alert';

// ----------------------------------------------------------------------

type Props = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  action?: React.ReactNode;
};

export default function KioskStatusBanner({ severity, message, action }: Props) {
  return (
    <Alert severity={severity} variant="filled" action={action} sx={{ justifyContent: 'center', boxShadow: 3 }}>
      {message}
    </Alert>
  );
}
