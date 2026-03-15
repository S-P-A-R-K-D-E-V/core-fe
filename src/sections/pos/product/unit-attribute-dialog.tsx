'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';

import { IUnitOfMeasure, IVariantAttribute } from 'src/types/corecms-api';
import { getAllUnitOfMeasures, createUnitOfMeasure } from 'src/api/unit-of-measures';
import {
  getAllVariantAttributes,
  createVariantAttribute,
} from 'src/api/variant-attributes';

// ----------------------------------------------------------------------

export interface UnitConversionFormItem {
  unitOfMeasureId: string;
  unitOfMeasureName: string;
  conversionRate: number;
  costPrice: number;
  sellingPrice: number;
  barcode: string;
}

export interface AttributeFormItem {
  attributeId: string;
  attributeName: string;
  value: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  unitConversions: UnitConversionFormItem[];
  attributes: AttributeFormItem[];
  onSave: (units: UnitConversionFormItem[], attrs: AttributeFormItem[]) => void;
  baseCostPrice: number;
  baseSellingPrice: number;
};

export default function UnitAttributeDialog({
  open,
  onClose,
  unitConversions: initialUnits,
  attributes: initialAttrs,
  onSave,
  baseCostPrice,
  baseSellingPrice,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<IVariantAttribute[]>([]);

  const [unitConversions, setUnitConversions] = useState<UnitConversionFormItem[]>([]);
  const [attributes, setAttributes] = useState<AttributeFormItem[]>([]);

  // New unit form
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

  // Add unit conversion form
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [convRate, setConvRate] = useState(1);

  // Attribute form
  const [selectedAttrId, setSelectedAttrId] = useState('');
  const [attrValue, setAttrValue] = useState('');

  // New attribute type
  const [newAttrName, setNewAttrName] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [uoms, attrs] = await Promise.all([
        getAllUnitOfMeasures(),
        getAllVariantAttributes(),
      ]);
      setUnits(uoms);
      setVariantAttributes(attrs);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      setUnitConversions([...initialUnits]);
      setAttributes([...initialAttrs]);
    }
  }, [open, loadData, initialUnits, initialAttrs]);

  // Unit conversion handlers
  const handleAddUnitConversion = () => {
    if (!selectedUnitId) return;
    const existing = unitConversions.find((uc) => uc.unitOfMeasureId === selectedUnitId);
    if (existing) {
      enqueueSnackbar('Đơn vị này đã được thêm', { variant: 'warning' });
      return;
    }
    const uom = units.find((u) => u.id === selectedUnitId);
    if (!uom) return;

    setUnitConversions([
      ...unitConversions,
      {
        unitOfMeasureId: selectedUnitId,
        unitOfMeasureName: uom.name,
        conversionRate: convRate,
        costPrice: baseCostPrice * convRate,
        sellingPrice: baseSellingPrice * convRate,
        barcode: '',
      },
    ]);
    setSelectedUnitId('');
    setConvRate(1);
  };

  const handleRemoveUnit = (idx: number) => {
    setUnitConversions(unitConversions.filter((_, i) => i !== idx));
  };

  const handleUnitFieldChange = (
    idx: number,
    field: keyof UnitConversionFormItem,
    value: string | number
  ) => {
    setUnitConversions(
      unitConversions.map((uc, i) => (i === idx ? { ...uc, [field]: value } : uc))
    );
  };

  // Create new UOM
  const handleCreateUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      await createUnitOfMeasure({ name: newUnitName.trim(), abbreviation: newUnitAbbr.trim() });
      enqueueSnackbar('Thêm đơn vị tính thành công');
      setNewUnitName('');
      setNewUnitAbbr('');
      loadData();
    } catch (err) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  // Attribute handlers
  const handleAddAttribute = () => {
    if (!selectedAttrId || !attrValue.trim()) return;
    const attr = variantAttributes.find((a) => a.id === selectedAttrId);
    if (!attr) return;

    setAttributes([
      ...attributes,
      {
        attributeId: selectedAttrId,
        attributeName: attr.name,
        value: attrValue.trim(),
      },
    ]);
    setAttrValue('');
  };

  const handleRemoveAttribute = (idx: number) => {
    setAttributes(attributes.filter((_, i) => i !== idx));
  };

  // Create new attribute type
  const handleCreateAttrType = async () => {
    if (!newAttrName.trim()) return;
    try {
      await createVariantAttribute({ name: newAttrName.trim() });
      enqueueSnackbar('Thêm thuộc tính thành công');
      setNewAttrName('');
      loadData();
    } catch (err) {
      enqueueSnackbar('Có lỗi xảy ra', { variant: 'error' });
    }
  };

  const handleSave = () => {
    onSave(unitConversions, attributes);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Thiết lập đơn vị tính và thuộc tính</DialogTitle>

      <DialogContent dividers>
        {/* Unit conversions section */}
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
            <Typography variant="subtitle1" fontWeight={700}>
              Đơn vị tính
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Thêm đơn vị bán hoặc nhập như chai, lốc, thùng. Đặt công thức quy đổi để tính nhanh
              giá và tồn kho. Ví dụ: 1 lốc = 4 chai, 1 thùng = 20 lốc.
            </Typography>

            {/* Existing unit conversions */}
            {unitConversions.map((uc, idx) => (
              <Stack
                key={idx}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Chip label={uc.unitOfMeasureName} color="primary" variant="soft" />
                <TextField
                  size="small"
                  label="Quy đổi"
                  type="number"
                  value={uc.conversionRate}
                  onChange={(e) =>
                    handleUnitFieldChange(idx, 'conversionRate', Number(e.target.value))
                  }
                  sx={{ width: 100 }}
                />
                <TextField
                  size="small"
                  label="Giá vốn"
                  type="number"
                  value={uc.costPrice}
                  onChange={(e) =>
                    handleUnitFieldChange(idx, 'costPrice', Number(e.target.value))
                  }
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  label="Giá bán"
                  type="number"
                  value={uc.sellingPrice}
                  onChange={(e) =>
                    handleUnitFieldChange(idx, 'sellingPrice', Number(e.target.value))
                  }
                  sx={{ width: 120 }}
                />
                <TextField
                  size="small"
                  label="Mã vạch"
                  value={uc.barcode}
                  onChange={(e) => handleUnitFieldChange(idx, 'barcode', e.target.value)}
                  sx={{ width: 140 }}
                />
                <IconButton size="small" color="error" onClick={() => handleRemoveUnit(idx)}>
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Stack>
            ))}

            {/* Add unit conversion */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Đơn vị</InputLabel>
                <Select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  label="Đơn vị"
                >
                  {units.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} {u.abbreviation ? `(${u.abbreviation})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Quy đổi"
                type="number"
                value={convRate}
                onChange={(e) => setConvRate(Number(e.target.value))}
                sx={{ width: 100 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddUnitConversion}
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Thêm
              </Button>
            </Stack>

            {/* Create new UOM inline */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              + Thêm đơn vị cơ bản
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <TextField
                size="small"
                label="Tên đơn vị"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                sx={{ width: 140 }}
              />
              <TextField
                size="small"
                label="Viết tắt"
                value={newUnitAbbr}
                onChange={(e) => setNewUnitAbbr(e.target.value)}
                sx={{ width: 80 }}
              />
              <Button size="small" variant="soft" onClick={handleCreateUnit}>
                Tạo
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Attributes section */}
        <Accordion defaultExpanded sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
            <Typography variant="subtitle1" fontWeight={700}>
              Thuộc tính
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Thêm đặc điểm như hương vị, dung tích, màu sắc
            </Typography>

            {/* Existing attributes */}
            {attributes.map((attr, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Thuộc tính</InputLabel>
                  <Select value={attr.attributeId} label="Thuộc tính" disabled>
                    {variantAttributes.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {a.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" value={attr.value} disabled sx={{ width: 200 }} />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleRemoveAttribute(idx)}
                >
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Stack>
            ))}

            {/* Add attribute */}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Thuộc tính</InputLabel>
                <Select
                  value={selectedAttrId}
                  onChange={(e) => setSelectedAttrId(e.target.value)}
                  label="Thuộc tính"
                >
                  {variantAttributes.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Giá trị"
                value={attrValue}
                onChange={(e) => setAttrValue(e.target.value)}
                sx={{ width: 200 }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={handleAddAttribute}
                startIcon={<Iconify icon="mingcute:add-line" />}
              >
                Thêm
              </Button>
            </Stack>

            {/* Create new attribute type inline */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              + Thêm thuộc tính
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <TextField
                size="small"
                label="Tên thuộc tính"
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                sx={{ width: 160 }}
              />
              <Button size="small" variant="soft" onClick={handleCreateAttrType}>
                Tạo
              </Button>
            </Stack>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Bỏ qua</Button>
        <Button variant="contained" onClick={handleSave}>
          Xong
        </Button>
      </DialogActions>
    </Dialog>
  );
}
