'use client';

import type { SliderProps } from '@mui/material/Slider';
import type { BoxProps } from '@mui/material/Box';

import Box from '@mui/material/Box';
import Slider, { sliderClasses } from '@mui/material/Slider';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import Iconify from 'src/components/iconify';

import type { SettingsValueProps } from '../types';

// ----------------------------------------------------------------------

type FontFamilyOptionsProps = BoxProps & {
  options: string[];
  value: SettingsValueProps['themeFont'];
  onChangeOption: (newOption: string) => void;
};

export function FontFamilyOptions({
  sx,
  value,
  options,
  onChangeOption,
  ...other
}: FontFamilyOptionsProps) {
  return (
    <Box
      sx={[
        {
          gap: 1.5,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {options.map((option) => {
        const selected = value === option;

        return (
          <ButtonBase
            key={option}
            onClick={() => onChangeOption(option)}
            sx={(theme) => ({
              py: 2,
              gap: 0.75,
              borderRadius: 1.5,
              cursor: 'pointer',
              flexDirection: 'column',
              border: `solid 1px ${alpha(theme.palette.grey[500], 0.12)}`,
              color: selected ? 'primary.main' : 'text.secondary',
              bgcolor: selected
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.grey[500], 0.04),
              '&:hover': {
                bgcolor: selected
                  ? alpha(theme.palette.primary.main, 0.12)
                  : alpha(theme.palette.grey[500], 0.08),
              },
              ...(selected && {
                borderColor: alpha(theme.palette.primary.main, 0.48),
              }),
              transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
                duration: theme.transitions.duration.shorter,
              }),
            })}
          >
            <Iconify icon="solar:text-bold-duotone" width={24} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: selected ? 'fontWeightBold' : 'fontWeightMedium',
                lineHeight: 1,
              }}
            >
              {option}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
}

// ----------------------------------------------------------------------

type FontSizeOptionsProps = Omit<SliderProps, 'value' | 'onChange'> & {
  options: [number, number];
  value: SettingsValueProps['themeFontSize'];
  onChangeOption: (newOption: number) => void;
};

export function FontSizeOptions({
  sx,
  value,
  options,
  onChangeOption,
  ...other
}: FontSizeOptionsProps) {
  return (
    <Slider
      marks
      step={1}
      size="small"
      valueLabelDisplay="on"
      aria-label="Change font size"
      valueLabelFormat={(val) => `${val}px`}
      value={value ?? options[0]}
      min={options[0]}
      max={options[1]}
      onChange={(_event, newValue) => onChangeOption(newValue as number)}
      sx={[
        (theme) => ({
          [`& .${sliderClasses.rail}`]: {
            height: 12,
            borderRadius: 6,
          },
          [`& .${sliderClasses.track}`]: {
            height: 12,
            borderRadius: 6,
            background: `linear-gradient(135deg, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
          },
          [`& .${sliderClasses.thumb}`]: {
            width: 20,
            height: 20,
            boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.32)}`,
          },
          [`& .${sliderClasses.valueLabel}`]: {
            bgcolor: 'transparent',
            color: 'text.primary',
            fontWeight: 'fontWeightBold',
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    />
  );
}
