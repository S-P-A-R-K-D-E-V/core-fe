'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useSnackbar } from 'src/components/snackbar';
import { IKiotVietBankAccount, TaxReportQuery, TaxReportResult } from 'src/types/corecms-api';
import { getTaxReport, exportTaxReport } from 'src/api/tax-report';
import { getBankAccounts } from 'src/api/bank-accounts';

import TaxReportFilter from '../tax-report-filter';
import TaxReportTable from '../tax-report-table';

// ----------------------------------------------------------------------

function getDefaultQuery(): TaxReportQuery {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// ----------------------------------------------------------------------

export default function ReportTaxView() {
  const { enqueueSnackbar } = useSnackbar();

  const [query, setQuery] = useState<TaxReportQuery>(getDefaultQuery);
  const [data, setData] = useState<TaxReportResult | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<IKiotVietBankAccount[]>([]);

  // Load bank accounts once on mount
  useEffect(() => {
    getBankAccounts()
      .then(setBankAccounts)
      .catch(() => {
        // Non-critical: bank account select will fall back to text input
      });
  }, []);

  const handleView = useCallback(async () => {
    try {
      setLoadingView(true);
      const result = await getTaxReport(query);
      setData(result);
    } catch (error: any) {
      const detail =
        error?.detail || error?.message || 'Không thể tải báo cáo thuế. Vui lòng thử lại.';
      enqueueSnackbar(detail, { variant: 'error' });
    } finally {
      setLoadingView(false);
    }
  }, [query, enqueueSnackbar]);

  const handleExport = useCallback(async () => {
    try {
      setLoadingExport(true);
      await exportTaxReport(query);
      enqueueSnackbar('Xuất Excel thành công!', { variant: 'success' });
    } catch (error: any) {
      const detail =
        error?.detail || error?.message || 'Không thể xuất file Excel. Vui lòng thử lại.';
      enqueueSnackbar(detail, { variant: 'error' });
    } finally {
      setLoadingExport(false);
    }
  }, [query, enqueueSnackbar]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Báo cáo thuế theo tháng</Typography>
      </Stack>

      <TaxReportFilter
        query={query}
        onChange={setQuery}
        onView={handleView}
        onExport={handleExport}
        bankAccounts={bankAccounts}
        loadingView={loadingView}
        loadingExport={loadingExport}
      />

      <TaxReportTable data={data} loading={loadingView} />
    </Box>
  );
}
