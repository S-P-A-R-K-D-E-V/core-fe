import { useMemo } from 'react';

import { paths } from 'src/routes/paths';

import { useTranslate } from 'src/locales';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import SvgColor from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => (
  <SvgColor src={`/assets/icons/navbar/${name}.svg`} sx={{ width: 1, height: 1 }} />
  // OR
  // <Iconify icon="fluent:mail-24-filled" />
  // https://icon-sets.iconify.design/solar/
  // https://www.streamlinehq.com/icons
);

const ICONS = {
  job: icon('ic_job'),
  blog: icon('ic_blog'),
  chat: icon('ic_chat'),
  mail: icon('ic_mail'),
  user: icon('ic_user'),
  file: icon('ic_file'),
  lock: icon('ic_lock'),
  tour: icon('ic_tour'),
  order: icon('ic_order'),
  label: icon('ic_label'),
  blank: icon('ic_blank'),
  kanban: icon('ic_kanban'),
  folder: icon('ic_folder'),
  banking: icon('ic_banking'),
  booking: icon('ic_booking'),
  invoice: icon('ic_invoice'),
  product: icon('ic_product'),
  calendar: icon('ic_calendar'),
  disabled: icon('ic_disabled'),
  external: icon('ic_external'),
  menuItem: icon('ic_menu_item'),
  ecommerce: icon('ic_ecommerce'),
  analytics: icon('ic_analytics'),
  dashboard: icon('ic_dashboard'),
};

// ----------------------------------------------------------------------

export function useNavData() {
  const { t } = useTranslate();

  const data = useMemo(
    () => [
      {
        subheader: t('overview'),
        items: [
          // SHIFT CASH (Kiểm tiền quầy)
          {
            title: t('shiftCash'),
            path: paths.dashboard.shiftCash.root,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager', 'Staff'],
          },
        ]
      },
      // MANAGEMENT
      // ----------------------------------------------------------------------
      {
        subheader: t('management'),
        items: [
          // USER
          {
            title: t('user'),
            path: paths.dashboard.user.root,
            icon: ICONS.user,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('list'), path: paths.dashboard.user.list },
            ],
          },

          // ROLE MANAGEMENT
          {
            title: t('role'),
            path: paths.dashboard.role.root,
            icon: ICONS.lock,
            roles: ['Admin'],
            children: [
              { title: t('list'), path: paths.dashboard.role.list },
              { title: t('create'), path: paths.dashboard.role.new },
            ],
          },

          // SHIFT MANAGEMENT
          {
            title: t('shift'),
            path: paths.dashboard.shift.root,
            icon: ICONS.calendar,
            roles: ['Admin', 'Manager'],
            children: [
              {
                title: t('shiftTemplates'),
                path: paths.dashboard.shift.templates.list,
              },
              {
                title: t('shiftSchedules'),
                path: paths.dashboard.shift.schedules.list,
              },
            ],
          },

          // ATTENDANCE MANAGEMENT (Admin/Manager)
          {
            title: t('attendance'),
            path: paths.dashboard.attendance.root,
            icon: ICONS.booking,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('assignmentsAttendance'), path: paths.dashboard.attendance.assignments },
              { title: t('logsAttendance'), path: paths.dashboard.attendance.logs },
              { title: t('requestsAttendance'), path: paths.dashboard.attendance.requests },
              { title: t('reportsAttendance'), path: paths.dashboard.attendance.report },
              { title: t('adjustAttendance'), path: paths.dashboard.attendance.adjust },

            ],
          },

          // MY ATTENDANCE (Staff, and also available to Admin/Manager)
          {
            title: t('myAttendance'),
            path: paths.dashboard.attendance.checkin,
            icon: ICONS.job,
            roles: ['Admin', 'Manager', 'Staff'],
            children: [
              { title: t('checkInOut'), path: paths.dashboard.attendance.checkin },
              { title: t('mySchedule'), path: paths.dashboard.attendance.mySchedule },
              { title: t('myLogs'), path: paths.dashboard.attendance.myLogs },
              { title: t('shiftRegistration'), path: paths.dashboard.attendance.shiftRegistration },
            ],
          },

          // SALARY MANAGEMENT (Admin/Manager)
          {
            title: t('salaryManagement'),
            path: paths.dashboard.salary.root,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager'],
            children: [
              { title: t('salaryConfiguration'), path: paths.dashboard.salary.configuration },
              { title: t('salaryHistory'), path: paths.dashboard.salary.history },
              { title: t('holidayPolicy'), path: paths.dashboard.holidayPolicy.list },
              { title: t('penaltyPolicy'), path: paths.dashboard.penaltyPolicy.list },
              { title: t('payrollCycle'), path: paths.dashboard.payroll.cycles },
              { title: t('payrollBatch'), path: paths.dashboard.payroll.batch },
            ],
          },

          // MY PAYROLL (Staff, and also available to Admin/Manager)
          {
            title: t('myPayroll'),
            path: paths.dashboard.payroll.myPayroll,
            icon: ICONS.banking,
            roles: ['Admin', 'Manager', 'Staff'],
          },

          // SHIFT SWAP REQUESTS
          {
            title: t('shiftSwap'),
            path: paths.dashboard.shiftSwap.root,
            icon: ICONS.job,
            roles: ['Admin', 'Manager', 'Staff'],
            children: [
              { title: t('myRequests'), path: paths.dashboard.shiftSwap.myRequests },
              { title: t('pendingApproval'), path: paths.dashboard.shiftSwap.pending },
            ],
          }
        ],
      },
    ],
    [t]
  );

  return data;
}
