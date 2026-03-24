'use client';

import { useState, useEffect, useCallback } from 'react';

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

import { IUnitOfMeasure } from 'src/types/corecms-api';
import { createUnitOfMeasure } from 'src/api/unit-of-measures';

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
  isEditMode?: boolean;
};

export default function UnitAttributeDialog({
  open,
  onClose,
  unitConversions: initialUnits,
  attributes: initialAttrs,
  onSave,
  baseCostPrice,
  baseSellingPrice,
  isEditMode,
}: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [units, setUnits] = useState<IUnitOfMeasure[]>([]);

  const [unitConversions, setUnitConversions] = useState<UnitConversionFormItem[]>([]);
  const [attributes, setAttributes] = useState<AttributeFormItem[]>([]);

  // New unit form
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');

  // Add unit conversion form
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [convRate, setConvRate] = useState(1);

  // Attribute form
  const [attrValue, setAttrValue] = useState('');

  // New attribute type
  const [newAttrName, setNewAttrName] = useState('');


  const loadData = useCallback(async () => {
    try {
      // Load UOM data if needed in the future
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

  const handleRemoveAttribute = (idx: number) => {
    setAttributes(attributes.filter((_, i) => i !== idx));
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

            {/* Existing attributes - text inputs */}
            {attributes.map((attr, idx) => (
              <Stack
                key={idx}
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <TextField
                  size="small"
                  label="Thuộc tính"
                  value={attr.attributeName}
                  onChange={(e) => {
                    setAttributes(attributes.map((a, i) => i === idx ? { ...a, attributeName: e.target.value } : a));
                  }}
                  sx={{ width: 160 }}
                />
                <TextField
                  size="small"
                  label="Giá trị"
                  value={attr.value}
                  onChange={(e) => {
                    setAttributes(attributes.map((a, i) => i === idx ? { ...a, value: e.target.value } : a));
                  }}
                  sx={{ width: 200 }}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleRemoveAttribute(idx)}
                >
                  <Iconify icon="solar:trash-bin-trash-bold" width={18} />
                </IconButton>
              </Stack>
            ))}

            {/* Add attribute - disabled when product already has attributes in edit mode */}
            {!(isEditMode && attributes.length > 0) && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <TextField
                  size="small"
                  label="Tên thuộc tính"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  sx={{ width: 160 }}
                />
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
                  onClick={() => {
                    if (!newAttrName.trim() || !attrValue.trim()) return;
                    setAttributes([
                      ...attributes,
                      {
                        attributeId: '',
                        attributeName: newAttrName.trim(),
                        value: attrValue.trim(),
                      },
                    ]);
                    setNewAttrName('');
                    setAttrValue('');
                  }}
                  startIcon={<Iconify icon="mingcute:add-line" />}
                >
                  Thêm
                </Button>
              </Stack>
            )}
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
