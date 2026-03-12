// =============================================================================
// NAVIGATION MENU SETUP - Shift Management
// =============================================================================
// Copy and paste this code into your navigation configuration file
// Usually located at: src/layouts/dashboard/config-navigation.tsx
// =============================================================================

import { paths } from 'src/routes/paths';
// Import your icon component - adjust based on your icon library
// import SvgIcon from '@mui/material/SvgIcon'; 
// import { Icon } from '@iconify/react';

// =============================================================================
// Option 1: Simple Flat Menu (No submenu)
// =============================================================================

export const shiftManagementMenuFlat = {
  subheader: 'Attendance',
  items: [
    {
      title: 'Shift Templates',
      path: paths.dashboard.shift.templates.list,
      icon: 'solar:calendar-mark-bold-duotone', // or your icon
    },
    {
      title: 'Shift Schedules',
      path: paths.dashboard.shift.schedules.list,
      icon: 'solar:calendar-bold-duotone', // or your icon
    },
  ],
};

// =============================================================================
// Option 2: Nested Menu with Children (Recommended)
// =============================================================================

export const shiftManagementMenuNested = {
  subheader: 'Attendance',
  items: [
    {
      title: 'Shift Management',
      path: paths.dashboard.shift.root,
      icon: 'solar:calendar-bold-duotone',
      children: [
        {
          title: 'Templates',
          path: paths.dashboard.shift.templates.list,
        },
        {
          title: 'Schedules',
          path: paths.dashboard.shift.schedules.list,
        },
      ],
    },
  ],
};

// =============================================================================
// Option 3: Full Attendance Module (Complete Structure)
// =============================================================================

export const attendanceModuleComplete = {
  subheader: 'Attendance',
  items: [
    // Shift Management
    {
      title: 'Shift Management',
      path: paths.dashboard.shift.root,
      icon: 'solar:calendar-bold-duotone',
      children: [
        {
          title: 'Templates',
          path: paths.dashboard.shift.templates.list,
        },
        {
          title: 'Schedules',
          path: paths.dashboard.shift.schedules.list,
        },
      ],
    },
    
    // Attendance (existing)
    {
      title: 'Attendance',
      path: paths.dashboard.attendance.root,
      icon: 'solar:clipboard-check-bold-duotone',
      children: [
        {
          title: 'Check In/Out',
          path: paths.dashboard.attendance.checkin,
        },
        {
          title: 'My Schedule',
          path: paths.dashboard.attendance.mySchedule,
        },
        {
          title: 'My Logs',
          path: paths.dashboard.attendance.myLogs,
        },
        {
          title: 'Assignments',
          path: paths.dashboard.attendance.assignments,
          roles: ['Admin', 'Manager'], // Optional: role-based
        },
        {
          title: 'Logs',
          path: paths.dashboard.attendance.logs,
          roles: ['Admin', 'Manager'],
        },
        {
          title: 'Requests',
          path: paths.dashboard.attendance.requests,
          roles: ['Admin', 'Manager'],
        },
        {
          title: 'Report',
          path: paths.dashboard.attendance.report,
          roles: ['Admin', 'Manager'],
        },
      ],
    },
  ],
};

// =============================================================================
// Option 4: With Role-Based Access Control
// =============================================================================

export const shiftManagementMenuWithRoles = {
  subheader: 'Attendance',
  items: [
    {
      title: 'Shift Management',
      path: paths.dashboard.shift.root,
      icon: 'solar:calendar-bold-duotone',
      children: [
        {
          title: 'Templates',
          path: paths.dashboard.shift.templates.list,
          roles: ['Admin', 'Manager'], // Only Admin and Manager can see
        },
        {
          title: 'Schedules',
          path: paths.dashboard.shift.schedules.list,
          roles: ['Admin', 'Manager', 'Staff'], // All roles can see
        },
      ],
    },
  ],
};

// =============================================================================
// Option 5: With Badges/Counters
// =============================================================================

export const shiftManagementMenuWithBadges = {
  subheader: 'Attendance',
  items: [
    {
      title: 'Shift Management',
      path: paths.dashboard.shift.root,
      icon: 'solar:calendar-bold-duotone',
      children: [
        {
          title: 'Templates',
          path: paths.dashboard.shift.templates.list,
          // info: <Label color="info">5</Label>, // Show count
        },
        {
          title: 'Schedules',
          path: paths.dashboard.shift.schedules.list,
          // info: <Label color="success">12</Label>,
        },
      ],
    },
  ],
};

// =============================================================================
// Usage Example
// =============================================================================

/*
// In your config-navigation.tsx file:

import { shiftManagementMenuNested } from './shift-menu-config';

export const navConfig = [
  // ... other menu items
  
  // General
  {
    subheader: 'general',
    items: [
      { title: 'Dashboard', path: paths.dashboard.root, icon: ICONS.dashboard },
      { title: 'Analytics', path: paths.dashboard.analytics, icon: ICONS.analytics },
    ],
  },

  // Attendance (Add shift management here)
  shiftManagementMenuNested,

  // ... other sections
];
*/

// =============================================================================
// Alternative: Direct Integration in Main Config
// =============================================================================

/*
// Direct integration example:

export const navConfig = [
  {
    subheader: 'Attendance',
    items: [
      {
        title: 'Shift Management',
        path: paths.dashboard.shift.root,
        icon: ICONS.calendar,
        children: [
          { title: 'Templates', path: paths.dashboard.shift.templates.list },
          { title: 'Schedules', path: paths.dashboard.shift.schedules.list },
        ],
      },
      {
        title: 'Attendance',
        path: paths.dashboard.attendance.root,
        icon: ICONS.clipboard,
        children: [
          { title: 'Check In/Out', path: paths.dashboard.attendance.checkin },
          { title: 'My Schedule', path: paths.dashboard.attendance.mySchedule },
          // ... more items
        ],
      },
    ],
  },
];
*/

// =============================================================================
// Icon Suggestions
// =============================================================================

/*
For Iconify icons (solar icon set):

Shift Management:
- 'solar:calendar-bold-duotone'
- 'solar:calendar-mark-bold-duotone'
- 'solar:calendar-search-bold-duotone'

Templates:
- 'solar:document-add-bold-duotone'
- 'solar:clipboard-text-bold-duotone'
- 'solar:settings-bold-duotone'

Schedules:
- 'solar:calendar-bold-duotone'
- 'solar:calendar-date-bold-duotone'
- 'solar:clock-circle-bold-duotone'

Lock/Version:
- 'solar:lock-bold-duotone'
- 'solar:history-bold-duotone'
*/

// =============================================================================
// Responsive Behavior
// =============================================================================

/*
The navigation menu automatically handles:
- Desktop: Full menu with icons and text
- Tablet: Collapsible menu
- Mobile: Drawer menu

Nested children work across all screen sizes.
*/

// =============================================================================
// Permissions Guard Example
// =============================================================================

/*
// In your nav config or layout:

const canAccessShiftManagement = (user) => {
  return ['Admin', 'Manager'].includes(user.role);
};

const canViewSchedules = (user) => {
  return ['Admin', 'Manager', 'Staff'].includes(user.role);
};

// Filter menu based on permissions:
const filteredNavConfig = navConfig.map(section => ({
  ...section,
  items: section.items.filter(item => {
    if (item.title === 'Shift Management') {
      return canAccessShiftManagement(currentUser);
    }
    return true;
  }),
}));
*/

// =============================================================================
// Copy one of the options above and paste into your navigation config file!
// =============================================================================

export {};
