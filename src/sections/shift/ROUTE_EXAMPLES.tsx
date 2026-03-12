/**
 * SHIFT MANAGEMENT ROUTES
 * 
 * Add these routes to your routing configuration
 * 
 * Example for Next.js App Router:
 * Create these files in your app/dashboard/shift directory:
 */

/*
// app/dashboard/shift/templates/page.tsx
import { ShiftTemplateListView } from 'src/sections/shift/view';

export default function ShiftTemplatesPage() {
  return <ShiftTemplateListView />;
}

// app/dashboard/shift/templates/new/page.tsx
import { ShiftTemplateCreateView } from 'src/sections/shift/view';

export default function ShiftTemplateCreatePage() {
  return <ShiftTemplateCreateView />;
}

// app/dashboard/shift/templates/[id]/edit/page.tsx
import { ShiftTemplateEditView } from 'src/sections/shift/view';

type Props = {
  params: { id: string };
};

export default function ShiftTemplateEditPage({ params }: Props) {
  return <ShiftTemplateEditView id={params.id} />;
}

// app/dashboard/shift/schedules/page.tsx
import { ShiftScheduleListView } from 'src/sections/shift/view';

export default function ShiftSchedulesPage() {
  return <ShiftScheduleListView />;
}

// app/dashboard/shift/schedules/new/page.tsx
import { ShiftScheduleCreateView } from 'src/sections/shift/view';

export default function ShiftScheduleCreatePage() {
  return <ShiftScheduleCreateView />;
}

// app/dashboard/shift/schedules/[id]/edit/page.tsx
import { ShiftScheduleEditView } from 'src/sections/shift/view';

type Props = {
  params: { id: string };
};

export default function ShiftScheduleEditPage({ params }: Props) {
  return <ShiftScheduleEditView id={params.id} />;
}

// app/dashboard/shift/schedules/template/[templateId]/page.tsx
import { ShiftScheduleListView } from 'src/sections/shift/view';

type Props = {
  params: { templateId: string };
};

export default function ShiftSchedulesByTemplatePage({ params }: Props) {
  // You can pass templateId as a prop to filter schedules
  return <ShiftScheduleListView />;
}
*/

/**
 * NAVIGATION MENU UPDATE
 * 
 * Add this to your navigation configuration:
 */

/*
{
  title: 'Shift Management',
  path: paths.dashboard.shift.root,
  icon: ICONS.schedule,
  children: [
    {
      title: 'Templates',
      path: paths.dashboard.shift.templates.list,
    },
    {
      title: 'Schedules',
      path: paths.dashboard.shift.schedules.list,
    },
    // Legacy (optional)
    {
      title: 'Shifts (Old)',
      path: paths.dashboard.shift.list,
    },
  ],
}
*/

/**
 * PERMISSION GUARD
 * 
 * Protect routes with permissions:
 */

/*
// Only Admin and Manager can access template/schedule management
export const shiftTemplatePermissions = ['Admin', 'Manager'];
export const shiftSchedulePermissions = ['Admin', 'Manager'];

// Staff can only view
export const shiftViewPermissions = ['Admin', 'Manager', 'Staff'];
*/

export {};
