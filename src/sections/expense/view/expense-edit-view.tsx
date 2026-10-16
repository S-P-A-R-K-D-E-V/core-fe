'use client';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IExpense } from 'src/types/corecms-api';
import { getExpenseById } from 'src/api/expenses';
import ExpenseNewEditForm from '../expense-new-edit-form';
import {
  useExpenseAccess,
  lockedByShareholderFunds,
  SHAREHOLDER_FUNDS_LOCKED_TEXT,
} from '../expense-access';

// ----------------------------------------------------------------------
// Quyền: app/dashboard/pos/expense (layout: expense.read, page: expense.update). Khoản cổ đông chi hộ chỉ chủ cửa hàng sửa.

type Props = {
  id: string;
};

export default function ExpenseEditView({ id }: Props) {
  const [currentExpense, setCurrentExpense] = useState<IExpense>();
  const access = useExpenseAccess();
  const locked = lockedByShareholderFunds(access, currentExpense);

  useEffect(() => {
    getExpenseById(id).then(setCurrentExpense);
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa chi phí"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Chi phí', href: paths.dashboard.pos.expense.list },
          { name: 'Sửa' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentExpense && locked && <Alert severity="info">{SHAREHOLDER_FUNDS_LOCKED_TEXT}.</Alert>}
      {currentExpense && !locked && <ExpenseNewEditForm currentExpense={currentExpense} />}
    </Container>
  );
}
