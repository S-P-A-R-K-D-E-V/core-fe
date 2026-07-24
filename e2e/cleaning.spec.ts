import { test, expect } from '@playwright/test';

import { buildFakeAccessToken } from './fake-auth';
import { mockCleaningApi } from './mock-cleaning-api';

// ----------------------------------------------------------------------
// End-to-end coverage for the two user-facing flows in this task:
//   1. Checklist tuần: edit an existing row (name only) -> success toast,
//      not a validation error (regression test for the shiftTemplateIds bug).
//   2. Theo dõi tuần: click a cell -> a POPUP opens (no navigation) -> mark a
//      task Failed -> open the penalty flow -> select staff -> submit -> success.
//
// HOW REAL THIS IS: there is no reachable Core-be backend/DB in this
// environment. Auth is stubbed by seeding a locally-decodable (unsigned) JWT
// into sessionStorage before the app boots (see fake-auth.ts) — the app never
// verifies the signature client-side, only decodes claims, so this exercises
// the real AuthProvider/AuthGuard code path with zero backend calls. Every
// `/cleaning/*` and `/shift-templates` API call is intercepted with
// page.route and fulfilled from in-memory fixtures (see mock-cleaning-api.ts)
// instead of hitting a real server. Everything else — routing, React state,
// the zod/react-hook-form validation, the MUI dialogs, the popup vs.
// navigation behavior — is the real frontend code, unmocked.
// ----------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.sessionStorage.setItem('accessToken', token);
    // Skip the unrelated "complete your profile" onboarding dialog
    // (src/components/profile-completion) that would otherwise cover the page.
    window.sessionStorage.setItem('profile_completion_skip', '1');
  }, buildFakeAccessToken('Admin'));
  await mockCleaningApi(page);
});

test('checklist tuần: editing only the name succeeds (not a validation error)', async ({ page }) => {
  await page.goto('/dashboard/cleaning/templates');

  await expect(page.getByRole('heading', { name: 'Checklist vệ sinh' })).toBeVisible();

  await page.getByRole('button', { name: 'Sửa' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Cập nhật đầu việc vệ sinh')).toBeVisible();

  // Only change the name — leave everything else (including the pre-populated
  // "Áp dụng cho ca" multi-select) untouched.
  const nameField = dialog.getByLabel('Tên đầu việc');
  await nameField.fill('Lau sàn khu vực trưng bày (đã cập nhật)');

  await dialog.getByRole('button', { name: 'Cập nhật' }).click();

  await expect(page.getByText('Cập nhật đầu việc thành công')).toBeVisible();
  await expect(page.getByText('Có lỗi xảy ra')).not.toBeVisible();

  // Dialog closes and the table reflects the updated name.
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Lau sàn khu vực trưng bày (đã cập nhật)')).toBeVisible();
});

test('theo dõi tuần: cell click opens a popup (no navigation), fail + penalty flow succeeds', async ({
  page,
}) => {
  await page.goto('/dashboard/cleaning/week-overview');

  await expect(page.getByRole('heading', { name: 'Theo dõi tuần' })).toBeVisible();
  const urlBeforeClick = page.url();

  // First data row is "Sáng" (Morning); first data column is Monday — matches
  // the fixture cell in mock-cleaning-api.ts.
  await page.locator('table tbody tr').first().locator('td').nth(1).click();

  // Popup opened, no navigation to /dashboard/cleaning/review.
  expect(page.url()).toBe(urlBeforeClick);
  const reviewDialog = page.getByRole('dialog', { name: /Checklist vệ sinh —/ });
  await expect(reviewDialog).toBeVisible();
  await expect(reviewDialog.getByText('Lau sàn khu vực trưng bày')).toBeVisible();

  // Mark the task Failed.
  await page.getByRole('button', { name: 'Không đạt' }).click();
  const failDialog = page.getByRole('dialog', { name: 'Đánh giá Không đạt' });
  await expect(failDialog).toBeVisible();
  await failDialog.getByRole('button', { name: 'Xác nhận Không đạt' }).click();
  await expect(page.getByText('Đã đánh giá Không đạt')).toBeVisible();
  await expect(failDialog).not.toBeVisible();

  // Task now shows as Failed inside the still-open review popup, with a Phạt action.
  await expect(reviewDialog.getByText('Không đạt', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Phạt' }).click();

  const penaltyDialog = page.getByRole('dialog', { name: /Phạt vệ sinh/ });
  await expect(penaltyDialog).toBeVisible();
  await penaltyDialog.getByRole('checkbox', { name: 'Nguyễn Văn A' }).check();
  await penaltyDialog.getByLabel('Số tiền phạt (mỗi người)').fill('50000');
  await penaltyDialog.getByRole('button', { name: 'Áp phạt' }).click();

  await expect(page.getByText('Đã áp phạt')).toBeVisible();
  await expect(penaltyDialog).not.toBeVisible();
});
