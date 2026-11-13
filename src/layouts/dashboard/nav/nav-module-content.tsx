'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';

import { RouterLink } from 'src/routes/components';

import NavPageRow from './nav-page-row';

import type { NavModule } from './nav-types';
import type { NavPinsState } from './use-nav-state';

// ----------------------------------------------------------------------
// Nội dung một module: "columns" = mega-menu (mỗi nhóm con một cột, nhóm Thiết lập là một hàng ở cuối), "list" = xếp
// dọc (flyout thanh bên, ngăn kéo mobile, menu Cá nhân / Cài đặt).
// ----------------------------------------------------------------------

type Props = {
  module: NavModule;
  variant: 'columns' | 'list';
  activeKey?: string | null;
  pins?: NavPinsState;
  onNavigate?: VoidFunction;
};

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      component="div"
      sx={{ px: 1, pt: 1, pb: 0.5, color: 'text.disabled', fontSize: 11, lineHeight: 1.6 }}
    >
      {children}
    </Typography>
  );
}

export default function NavModuleContent({ module, variant, activeKey, pins, onNavigate }: Props) {
  const main = module.groups.filter((g) => !g.setup);
  const setup = module.groups.filter((g) => g.setup);
  const showGroupTitles = module.groups.length > 1;

  if (variant === 'list') {
    return (
      <Stack>
        {module.groups.map((group) => (
          <Box key={group.key}>
            {showGroupTitles && <GroupTitle>{group.title}</GroupTitle>}
            {group.pages.map((page) => (
              <NavPageRow
                key={page.key}
                page={page}
                active={activeKey === page.key}
                pins={pins}
                onNavigate={onNavigate}
              />
            ))}
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          columnGap: 3,
          rowGap: 1.5,
        }}
      >
        {main.map((group) => (
          <Box key={group.key}>
            <GroupTitle>{group.title}</GroupTitle>
            {group.pages.map((page) => (
              <NavPageRow
                key={page.key}
                page={page}
                active={activeKey === page.key}
                pins={pins}
                onNavigate={onNavigate}
              />
            ))}
          </Box>
        ))}
      </Box>

      {setup.length > 0 && (
        <>
          {main.length > 0 && <Divider sx={{ borderStyle: 'dashed', my: 1.5 }} />}
          <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75}>
            <Typography
              variant="overline"
              sx={{ color: 'text.disabled', fontSize: 11, px: 1, mr: 0.5 }}
            >
              Thiết lập
            </Typography>
            {setup
              .flatMap((g) => g.pages)
              .map((page) => (
                <ButtonBase
                  key={page.key}
                  component={RouterLink}
                  href={page.path}
                  onClick={onNavigate}
                  sx={{
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 2,
                    typography: 'body2',
                    bgcolor: 'background.neutral',
                    '&:hover': { color: 'primary.main' },
                    ...(activeKey === page.key && {
                      color: 'primary.main',
                      fontWeight: 'fontWeightSemiBold',
                    }),
                  }}
                >
                  {page.title}
                </ButtonBase>
              ))}
          </Stack>
        </>
      )}
    </Box>
  );
}
