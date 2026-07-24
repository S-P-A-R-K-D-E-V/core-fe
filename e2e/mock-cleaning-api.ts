import type { Page } from '@playwright/test';

// ----------------------------------------------------------------------
// Network-level mocks for the Cleaning module. This environment has no
// reachable Core-be backend/DB, so every API call the two e2e flows touch is
// intercepted here with page.route and fulfilled from in-memory fixtures —
// see the e2e spec file for exactly what that means for "how real" the test
// is. The rendered UI, its client-side validation (zod/react-hook-form) and
// all the React state/dialog logic in cleaning-template-list-view.tsx,
// cleaning-week-overview-view.tsx, cleaning-review-dialog.tsx and
// cleaning-review-checklist.tsx run for real, unmocked.
//
// Routes match on exact pathname (not a glob suffix): a glob like
// '**/cleaning/templates' would also match the page navigation itself
// (.../dashboard/cleaning/templates ends with "/cleaning/templates" too) and
// serve the JSON fixture as the document response instead of the real page.
// ----------------------------------------------------------------------

export const TEMPLATE_ID = '11111111-1111-1111-1111-111111111111';
export const SHIFT_TEMPLATE_ID = '22222222-2222-2222-2222-222222222222';
export const TASK_ID = '33333333-3333-3333-3333-333333333333';
export const STAFF_USER_ID = '44444444-4444-4444-4444-444444444444';

function exactPath(pathname: string) {
  return (url: URL) => url.pathname === pathname;
}

export async function mockCleaningApi(page: Page) {
  // ---- users/me (non-blocking avatar patch on auth init) ----
  await page.route(exactPath('/users/me'), (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );

  // ---- shift templates (used by the checklist tuần "Áp dụng cho ca" multi-select) ----
  await page.route(exactPath('/shift-templates'), (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: SHIFT_TEMPLATE_ID,
          name: 'Ca sáng',
          shiftType: 'Main',
          cleaningBlock: 'Morning',
          isActive: true,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ]),
    });
  });

  // ---- cleaning task templates (checklist tuần list + edit) ----
  const template = {
    id: TEMPLATE_ID,
    dayOfWeek: 'Monday',
    cleaningBlock: 'Morning',
    name: 'Lau sàn khu vực trưng bày',
    area: 'Tầng 1',
    sortOrder: 0,
    isActive: true,
    fromDate: '2026-07-20',
    toDate: null as string | null,
    shiftTemplateIds: [SHIFT_TEMPLATE_ID],
  };

  await page.route(exactPath('/cleaning/templates'), (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([template]),
      });
    }
    if (method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(template),
      });
    }
    return route.fallback();
  });

  await page.route(exactPath(`/cleaning/templates/${TEMPLATE_ID}`), (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      Object.assign(template, body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(template),
      });
    }
    return route.fallback();
  });

  // ---- week overview (Theo dõi tuần grid) ----
  await page.route(exactPath('/cleaning/week-overview'), (route) => {
    const url = new URL(route.request().url());
    const fromDate = url.searchParams.get('fromDate');
    if (!fromDate) return route.fallback();
    // One cell with pending work on the first day of the requested week, Morning block —
    // matches the "Ca sáng" row / Monday column the spec clicks.
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          date: fromDate,
          cleaningBlock: 'Morning',
          staffNames: ['Nguyễn Văn A'],
          pendingCount: 1,
          doneCount: 0,
          passedCount: 0,
          failedCount: 0,
        },
      ]),
    });
  });

  // ---- checklist for a given date/block (review dialog content) ----
  const task = {
    id: TASK_ID,
    templateId: TEMPLATE_ID,
    name: 'Lau sàn khu vực trưng bày',
    area: 'Tầng 1',
    date: '2026-07-20',
    cleaningBlock: 'Morning',
    status: 'Pending' as 'Pending' | 'Done' | 'Passed' | 'Failed',
    completedByUserId: null,
    completedByUserName: null,
    completedAt: null,
    photoObjectKeys: [] as string[],
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null as string | null,
    penalties: [] as any[],
  };

  await page.route(exactPath('/cleaning/checklist'), (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([task]),
    });
  });

  await page.route(exactPath(`/cleaning/tasks/${TASK_ID}/review`), (route) => {
    const body = route.request().postDataJSON();
    task.status = body.status;
    task.reviewNote = body.reviewNote ?? null;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(task),
    });
  });

  await page.route(exactPath(`/cleaning/tasks/${TASK_ID}/shift-staff`), (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { userId: STAFF_USER_ID, fullName: 'Nguyễn Văn A', isPartialCover: false },
      ]),
    })
  );

  await page.route(exactPath(`/cleaning/tasks/${TASK_ID}/penalties`), (route) => {
    const body = route.request().postDataJSON();
    const penalty = {
      id: '55555555-5555-5555-5555-555555555555',
      userId: body.userId,
      userName: 'Nguyễn Văn A',
      amount: body.amount,
      reason: body.reason ?? null,
      createdByUserId: 'e2e-user-1',
      createdAt: new Date().toISOString(),
      voidedAt: null,
    };
    task.penalties.push(penalty);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(penalty),
    });
  });
}
