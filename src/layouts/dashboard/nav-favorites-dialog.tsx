import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ListItemButton from '@mui/material/ListItemButton';
import InputAdornment from '@mui/material/InputAdornment';

import Iconify from 'src/components/iconify';
import { NavProps } from 'src/components/nav-section/types';
import { MAX_NAV_FAVORITES } from 'src/hooks/use-nav-favorites';

import { flattenNavItems } from './nav-favorites-utils';

// ----------------------------------------------------------------------

const DIACRITICS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g'
);

const normalize = (s: string) => s.normalize('NFD').replace(DIACRITICS_RE, '').toLowerCase();

type Props = {
  open: boolean;
  onClose: VoidFunction;
  navData: NavProps['data'];
  favorites: string[];
  isFull: boolean;
  onToggle: (path: string) => void;
};

export default function NavFavoritesDialog({ open, onClose, navData, favorites, isFull, onToggle }: Props) {
  const [query, setQuery] = useState('');

  const flatItems = useMemo(() => flattenNavItems(navData), [navData]);

  const filteredItems = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return flatItems;
    return flatItems.filter((item) => normalize(item.label).includes(q));
  }, [flatItems, query]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="eva:star-fill" width={20} sx={{ color: 'warning.main' }} />
          <span>Chọn truy cập nhanh</span>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm chức năng..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} />
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Đã chọn {favorites.length}/{MAX_NAV_FAVORITES}
          </Typography>
        </Box>

        <List dense sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {filteredItems.map((item) => {
            const checked = favorites.includes(item.path);
            const disabled = !checked && isFull;
            return (
              <ListItemButton
                key={item.path}
                disabled={disabled}
                onClick={() => onToggle(item.path)}
                sx={{ py: 0.5 }}
              >
                {item.icon && (
                  <ListItemIcon sx={{ minWidth: 32, opacity: 0.72 }}>{item.icon}</ListItemIcon>
                )}
                <ListItemText
                  primary={item.label}
                  secondary={item.groupLabel}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <Checkbox
                  edge="end"
                  checked={checked}
                  disabled={disabled}
                  icon={<Iconify icon="eva:star-outline" width={18} />}
                  checkedIcon={<Iconify icon="eva:star-fill" width={18} sx={{ color: 'warning.main' }} />}
                />
              </ListItemButton>
            );
          })}

          {filteredItems.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: 'center' }}>
              Không tìm thấy chức năng phù hợp
            </Typography>
          )}
        </List>
      </DialogContent>

      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 1 }}>
          Tối đa {MAX_NAV_FAVORITES} mục
        </Typography>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
