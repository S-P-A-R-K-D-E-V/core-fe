'use client';

import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Drawer, { drawerClasses } from '@mui/material/Drawer';

import { paper } from 'src/theme/css';
import { FONT_OPTIONS } from 'src/theme/typography';

import Iconify from '../../iconify';
import Scrollbar from '../../scrollbar';
import BaseOptions from './base-option';
import LayoutOptions from './layout-options';
import PresetsOptions from './presets-options';
import StretchOptions from './stretch-options';
import { FontFamilyOptions, FontSizeOptions } from './font-options';
import { useSettingsContext } from '../context';
import FullScreenOption from './fullscreen-option';

// ----------------------------------------------------------------------

export default function SettingsDrawer() {
  const theme = useTheme();
  const settings = useSettingsContext();

  const labelStyles = {
    mb: 1.5,
    color: 'text.disabled',
    fontWeight: 'fontWeightSemiBold',
  };

  const sectionLabelStyles = {
    mb: 0,
    color: 'text.disabled',
    fontWeight: 'fontWeightSemiBold',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  };

  const renderHead = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ py: 2, pr: 1, pl: 2.5 }}
    >
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Settings
      </Typography>

      <Tooltip title="Reset">
        <IconButton onClick={settings.onReset}>
          <Badge color="error" variant="dot" invisible={!settings.canReset}>
            <Iconify icon="solar:restart-bold" />
          </Badge>
        </IconButton>
      </Tooltip>

      <IconButton onClick={settings.onClose}>
        <Iconify icon="mingcute:close-line" />
      </IconButton>
    </Stack>
  );

  const renderMode = (
    <div>
      <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
        Mode
      </Typography>
      <BaseOptions
        value={settings.themeMode}
        onChange={(newValue: string) => settings.onUpdate('themeMode', newValue)}
        options={['light', 'dark']}
        icons={['sun', 'moon']}
      />
    </div>
  );

  const renderContrast = (
    <div>
      <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
        Contrast
      </Typography>
      <BaseOptions
        value={settings.themeContrast}
        onChange={(newValue: string) => settings.onUpdate('themeContrast', newValue)}
        options={['default', 'bold']}
        icons={['contrast', 'contrast_bold']}
      />
    </div>
  );

  const renderDirection = (
    <div>
      <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
        Direction
      </Typography>
      <BaseOptions
        value={settings.themeDirection}
        onChange={(newValue: string) => settings.onUpdate('themeDirection', newValue)}
        options={['ltr', 'rtl']}
        icons={['align_left', 'align_right']}
      />
    </div>
  );

  const renderLayout = (
    <div>
      <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
        Layout
      </Typography>
      <LayoutOptions
        value={settings.themeLayout}
        onChange={(newValue: string) => settings.onUpdate('themeLayout', newValue)}
        options={['vertical', 'horizontal', 'mini']}
      />
    </div>
  );

  const renderStretch = (
    <div>
      <Typography
        variant="caption"
        component="div"
        sx={{ ...labelStyles, display: 'inline-flex', alignItems: 'center' }}
      >
        Stretch
        <Tooltip title="Only available at large resolutions > 1600px (xl)">
          <Iconify icon="eva:info-outline" width={16} sx={{ ml: 0.5 }} />
        </Tooltip>
      </Typography>
      <StretchOptions
        value={settings.themeStretch}
        onChange={() => settings.onUpdate('themeStretch', !settings.themeStretch)}
      />
    </div>
  );

  const renderPresets = (
    <div>
      <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
        Presets
      </Typography>
      <PresetsOptions
        value={settings.themeColorPresets}
        onChange={(newValue: string) => settings.onUpdate('themeColorPresets', newValue)}
      />
    </div>
  );

  const renderFont = (
    <Stack spacing={2.5}>
      <Typography component="div" sx={{ ...sectionLabelStyles }}>
        Font
      </Typography>

      <div>
        <Typography variant="caption" component="div" sx={{ ...labelStyles }}>
          Family
        </Typography>
        <FontFamilyOptions
          options={FONT_OPTIONS.map((f) => f.label)}
          value={settings.themeFont ?? 'Public Sans'}
          onChangeOption={(newOption) => settings.onUpdate('themeFont', newOption)}
        />
      </div>

      <div>
        <Typography
          variant="caption"
          component="div"
          sx={{ ...labelStyles, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          Size
          <Tooltip title="Scales all text proportionally">
            <Iconify icon="eva:info-outline" width={14} sx={{ color: 'text.disabled' }} />
          </Tooltip>
        </Typography>
        <FontSizeOptions
          options={[12, 20]}
          value={settings.themeFontSize ?? 16}
          onChangeOption={(newOption) => settings.onUpdate('themeFontSize', newOption)}
        />
      </div>
    </Stack>
  );

  return (
    <Drawer
      anchor="right"
      open={settings.open}
      onClose={settings.onClose}
      slotProps={{ backdrop: { invisible: true } }}
      sx={{
        [`& .${drawerClasses.paper}`]: {
          ...paper({ theme, bgcolor: theme.palette.background.default }),
          width: 300,
        },
      }}
    >
      {renderHead}

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Scrollbar>
        <Stack spacing={3} sx={{ p: 3 }}>
          {renderMode}
          {renderContrast}
          {renderDirection}
          {renderLayout}
          {renderStretch}
          {renderPresets}

          <Divider sx={{ borderStyle: 'dashed' }} />

          {renderFont}
        </Stack>
      </Scrollbar>

      <FullScreenOption />
    </Drawer>
  );
}
