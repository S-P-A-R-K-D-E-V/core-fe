'use client';

import { format } from 'date-fns';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

import CleaningReviewChecklist from './cleaning-review-checklist';

// ----------------------------------------------------------------------
// Popup that replaces the old "click a Theo dõi tuần cell -> navigate to
// /dashboard/cleaning/review?date=..&block=.." flow. Renders the exact same
// pass/fail + penalty logic as the standalone review page, via
// CleaningReviewChecklist, so there is only one copy of that logic.

const CLEANING_BLOCK_LABELS: Record<string, string> = {
  Morning: 'Sáng',
  Afternoon: 'Chiều',
  Evening: 'Tối',
};

type Props = {
  open: boolean;
  date: Date;
  block: string;
  onClose: () => void;
  /** Called after any successful review/penalty action, e.g. to refresh the week overview grid. */
  onChanged?: () => void;
};

export default function CleaningReviewDialog({ open, date, block, onClose, onChanged }: Props) {
  const dateStr = format(date, 'yyyy-MM-dd');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Checklist vệ sinh — {format(date, 'dd/MM/yyyy')} · {CLEANING_BLOCK_LABELS[block] || block}
      </DialogTitle>
      <DialogContent dividers>
        {/* Mount only while open so each cell click starts a fresh fetch for its date/block */}
        {open && <CleaningReviewChecklist date={dateStr} block={block} onChanged={onChanged} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
