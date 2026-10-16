'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { apiErrorMessage } from 'src/utils/api-error';

import { getAllUsers } from 'src/api/users';
import { getCustomRoles, SYSTEM_ROLE_LABELS } from 'src/api/custom-roles';
import {
  customRoleCode,
  getPlatformFeatures,
  setPlatformFeaturePolicy,
  type PlatformFeaturePolicy,
  type PlatformFeatureDefinition,
} from 'src/api/platform-features';

import { useAuthContext } from 'src/auth/hooks';
import { PLATFORM_LABELS, CLIENT_PLATFORMS, type ClientPlatform } from 'src/auth/platform-features';

import { useSnackbar } from 'src/components/snackbar';

import type { IUser } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Cài đặt cửa hàng → Tính năng web / app: giới hạn ai được dùng một tính năng trên từng nền tảng, vd tắt tự chấm công
// trên web với nhân viên để buộc chấm công bằng app. Không giới hạn = mọi người dùng được (mặc định).

const SYSTEM_ROLES = ['Admin', 'Manager', 'Staff'] as const;

/** Bật giới hạn lần đầu: chủ cửa hàng + quản lý vẫn dùng được, nhân viên phải dùng nền tảng còn lại. */
const DEFAULT_ALLOWED_ROLES = ['Admin', 'Manager'];

type Draft = { restricted: boolean; roles: string[]; userIds: string[] };

type RoleOption = { code: string; label: string };

const draftKey = (featureKey: string, platform: string) => `${featureKey}|${platform}`;

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const sameDraft = (a: Draft, b: Draft) =>
  a.restricted === b.restricted && (!a.restricted || (sameSet(a.roles, b.roles) && sameSet(a.userIds, b.userIds)));

export default function PlatformFeaturesTab() {
  const { enqueueSnackbar } = useSnackbar();
  const { refreshUser } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<PlatformFeatureDefinition[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [users, setUsers] = useState<IUser[]>([]);
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, customRoles, allUsers] = await Promise.all([getPlatformFeatures(), getCustomRoles(), getAllUsers()]);

      const options: RoleOption[] = [
        ...SYSTEM_ROLES.map((code) => ({ code, label: SYSTEM_ROLE_LABELS[code] ?? code })),
        ...customRoles.map((r) => ({ code: customRoleCode(r.id), label: r.name })),
      ];
      const knownRoles = new Set(options.map((o) => o.code));
      const knownUsers = new Set(allUsers.map((u) => u.id));

      // Vai trò tuỳ chỉnh / người đã xoá không còn ý nghĩa — bỏ khỏi bản nháp (lưu lại sẽ dọn luôn ở server).
      const toDraft = (policy: PlatformFeaturePolicy | undefined): Draft =>
        policy
          ? {
              restricted: true,
              roles: policy.allowedRoles.filter((r) => knownRoles.has(r)),
              userIds: policy.allowedUserIds.filter((id) => knownUsers.has(id)),
            }
          : { restricted: false, roles: [], userIds: [] };

      const next: Record<string, Draft> = {};
      data.features.forEach((f) =>
        CLIENT_PLATFORMS.forEach((platform) => {
          next[draftKey(f.key, platform)] = toDraft(
            data.policies.find((p) => p.featureKey === f.key && p.platform === platform)
          );
        })
      );

      setFeatures(data.features);
      setRoleOptions(options);
      setUsers(allUsers);
      setSaved(next);
      setDrafts(next);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tải được cấu hình tính năng.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const handleToggle = (key: string, restricted: boolean) => {
    const current = drafts[key];
    // Bật lần đầu (chưa chọn ai): gợi ý chủ cửa hàng + quản lý.
    const roles = restricted && current.roles.length === 0 && current.userIds.length === 0 ? DEFAULT_ALLOWED_ROLES : current.roles;
    updateDraft(key, { restricted, roles });
  };

  const handleSave = async (featureKey: string, platform: ClientPlatform) => {
    const key = draftKey(featureKey, platform);
    const draft = drafts[key];
    setSavingKey(key);
    try {
      await setPlatformFeaturePolicy(featureKey, platform, {
        restricted: draft.restricted,
        allowedRoles: draft.restricted ? draft.roles : [],
        allowedUserIds: draft.restricted ? draft.userIds : [],
      });
      setSaved((prev) => ({ ...prev, [key]: draft }));
      enqueueSnackbar('Đã lưu');
      // Chủ cửa hàng có thể vừa tự giới hạn mình trên web — nạp lại để menu khớp.
      refreshUser();
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Lưu thất bại'), { variant: 'error' });
    } finally {
      setSavingKey(null);
    }
  };

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        Giới hạn ai được dùng một tính năng trên web hoặc trên app. Ví dụ: tắt chấm công trên web với nhân viên để buộc
        chấm công bằng app (GPS + khuôn mặt), chủ cửa hàng và quản lý vẫn dùng web. Không bật giới hạn thì mọi người dùng
        được như bình thường.
      </Alert>

      {features.map((feature) => (
        <Card key={feature.key} sx={{ p: 3 }}>
          <Typography variant="h6">{feature.label}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {feature.description}
          </Typography>

          <Stack divider={<Divider flexItem />} spacing={2}>
            {CLIENT_PLATFORMS.map((platform) => {
              const key = draftKey(feature.key, platform);
              const draft = drafts[key];
              const dirty = !sameDraft(draft, saved[key]);
              const nobody = draft.restricted && draft.roles.length === 0 && draft.userIds.length === 0;

              return (
                <Stack key={platform} spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch checked={draft.restricted} onChange={(e) => handleToggle(key, e.target.checked)} />
                      }
                      label={
                        <Typography variant="subtitle2">
                          Giới hạn trên {PLATFORM_LABELS[platform]}
                          {!draft.restricted && (
                            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', ml: 1 }}>
                              — mọi người dùng được
                            </Typography>
                          )}
                        </Typography>
                      }
                    />
                    <LoadingButton
                      variant="contained"
                      size="small"
                      disabled={!dirty}
                      loading={savingKey === key}
                      onClick={() => handleSave(feature.key, platform)}
                    >
                      Lưu
                    </LoadingButton>
                  </Stack>

                  {draft.restricted && (
                    <>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Chỉ những vai trò / người dưới đây dùng được trên {PLATFORM_LABELS[platform]}:
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {roleOptions.map((role) => {
                          const selected = draft.roles.includes(role.code);
                          return (
                            <Chip
                              key={role.code}
                              label={role.label}
                              color={selected ? 'primary' : 'default'}
                              variant={selected ? 'filled' : 'outlined'}
                              onClick={() =>
                                updateDraft(key, {
                                  roles: selected
                                    ? draft.roles.filter((r) => r !== role.code)
                                    : [...draft.roles, role.code],
                                })
                              }
                            />
                          );
                        })}
                      </Stack>
                      <Autocomplete
                        multiple
                        size="small"
                        options={users}
                        value={draft.userIds.map((id) => usersById.get(id)).filter((u): u is IUser => !!u)}
                        onChange={(_, value) => updateDraft(key, { userIds: value.map((u) => u.id) })}
                        getOptionLabel={(u) => `${u.fullName || u.email}${u.fullName ? ` (${u.email})` : ''}`}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        renderInput={(params) => (
                          <TextField {...params} label="Thêm người được dùng" placeholder="Tìm nhân viên" />
                        )}
                      />
                      {nobody && (
                        <Alert severity="warning">
                          Chưa chọn ai — lưu lại thì không ai dùng được tính năng này trên {PLATFORM_LABELS[platform]}.
                        </Alert>
                      )}
                    </>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
