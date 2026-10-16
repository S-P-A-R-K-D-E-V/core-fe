'use client';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import type { IPermissionCatalog } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

type Props = {
  catalog: IPermissionCatalog;
  selected: string[];
  /** Không truyền = chỉ xem (vai trò hệ thống). */
  onChange?: (selected: string[]) => void;
};

/** Danh mục quyền theo nhóm (GET /permissions/catalog) — chọn từng quyền hoặc cả nhóm. */
export default function PermissionChecklist({ catalog, selected, onChange }: Props) {
  const readOnly = !onChange;

  const toggle = (code: string) =>
    onChange?.(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);

  const toggleGroup = (codes: string[]) => {
    const all = codes.every((c) => selected.includes(c));
    onChange?.(all ? selected.filter((c) => !codes.includes(c)) : Array.from(new Set([...selected, ...codes])));
  };

  return (
    <>
      {catalog.groups.map((group) => {
        const codes = group.permissions.map((p) => p.code);
        const all = codes.every((c) => selected.includes(c));
        const some = !all && codes.some((c) => selected.includes(c));

        return (
          <Box key={group.key} sx={{ mb: 2 }}>
            <FormControlLabel
              label={
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  {group.label}
                </Typography>
              }
              control={
                <Checkbox
                  checked={all}
                  indeterminate={some}
                  disabled={readOnly}
                  onChange={() => toggleGroup(codes)}
                  inputProps={{ 'aria-label': `Cả nhóm ${group.label}` }}
                />
              }
            />

            <Box sx={{ pl: 4, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              {group.permissions.map((permission) => (
                <FormControlLabel
                  key={permission.code}
                  label={
                    <Box>
                      <Typography variant="body2">{permission.label}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {permission.code}
                      </Typography>
                    </Box>
                  }
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.includes(permission.code)}
                      disabled={readOnly}
                      onChange={() => toggle(permission.code)}
                    />
                  }
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </>
  );
}
