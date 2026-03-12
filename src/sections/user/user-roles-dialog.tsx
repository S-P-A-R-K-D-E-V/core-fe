'use client';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';

import { useSnackbar } from 'src/components/snackbar';

import { IRole } from 'src/types/corecms-api';

import { getAllRoles, assignRoles, getUserPermissions } from 'src/api/roles';

// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  userId: string;
  userName: string;
};

export default function UserRolesDialog({ open, onClose, userId, userName }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [allRoles, setAllRoles] = useState<IRole[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [roles, userPerms] = await Promise.all([
          getAllRoles(),
          getUserPermissions(userId),
        ]);
        setAllRoles(roles);

        // Find role IDs from role names
        const userRoleNames = userPerms.roles || [];
        const userRoleIds = roles
          .filter((r) => userRoleNames.includes(r.name))
          .map((r) => r.id);
        setSelectedRoleIds(userRoleIds);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        enqueueSnackbar('Failed to load roles', { variant: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, userId, enqueueSnackbar]);

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await assignRoles({ userId, roleIds: selectedRoleIds });
      enqueueSnackbar('Roles assigned successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to assign roles:', error);
      enqueueSnackbar('Failed to assign roles', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Manage Roles</DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Assign roles to <strong>{userName}</strong>
        </Alert>

        {loading ? (
          <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            Loading...
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {allRoles.map((role) => (
              <FormControlLabel
                key={role.id}
                label={
                  <Box>
                    <Typography variant="subtitle2">{role.name}</Typography>
                    {role.description && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {role.description}
                      </Typography>
                    )}
                  </Box>
                }
                control={
                  <Checkbox
                    checked={selectedRoleIds.includes(role.id)}
                    onChange={() => handleToggleRole(role.id)}
                  />
                }
              />
            ))}

            {allRoles.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                No roles available
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Cancel
        </Button>

        <LoadingButton variant="contained" loading={saving} onClick={handleSave}>
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
