'use client';

import { useState, useEffect, useCallback } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';

import { getAllShiftTemplates } from 'src/api/attendance';
import { setMyShiftPreferences } from 'src/api/userPreference';
import type { IShiftTemplate } from 'src/types/corecms-api';

interface Props {
  open: boolean;
  onCompleted: () => void;
}

export default function ShiftPreferencePromptDialog({ open, onCompleted }: Props) {
  const [templates, setTemplates] = useState<IShiftTemplate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setFetching(true);
    try {
      const all = await getAllShiftTemplates();
      setTemplates(all.filter((t) => t.isActive));
    } catch {
      setError('Không thể tải danh sách ca. Vui lòng thử lại.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      await setMyShiftPreferences({ shiftTemplateIds: selected });
      onCompleted();
    } catch {
      setError('Lưu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown>
      <DialogTitle>Chọn ca làm chính của bạn</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Vui lòng chọn ít nhất 1 ca làm chính. Thông tin này giúp quản lý xếp ca phù hợp hơn.
        </Typography>

        {fetching && <CircularProgress size={24} />}
        {!fetching && (
          <FormGroup>
            {templates.map((t) => (
              <FormControlLabel
                key={t.id}
                control={
                  <Checkbox
                    checked={selected.includes(t.id)}
                    onChange={() => toggle(t.id)}
                    sx={t.color ? { color: t.color, '&.Mui-checked': { color: t.color } } : undefined}
                  />
                }
                label={`${t.name} (${t.shiftType})`}
              />
            ))}
          </FormGroup>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={selected.length === 0 || loading}
          onClick={handleSubmit}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Xác nhận
        </Button>
      </DialogActions>
    </Dialog>
  );
}
