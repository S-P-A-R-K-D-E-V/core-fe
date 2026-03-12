# Quick Start Guide - Shift Management System

## 🚀 5 Phút Setup

### 1. Import Views trong Routes

```tsx
// app/dashboard/shift/templates/page.tsx
import { ShiftTemplateListView } from 'src/sections/shift/view';
export default function Page() {
  return <ShiftTemplateListView />;
}

// app/dashboard/shift/templates/new/page.tsx
import { ShiftTemplateCreateView } from 'src/sections/shift/view';
export default function Page() {
  return <ShiftTemplateCreateView />;
}

// app/dashboard/shift/templates/[id]/edit/page.tsx
import { ShiftTemplateEditView } from 'src/sections/shift/view';
export default function Page({ params }: { params: { id: string } }) {
  return <ShiftTemplateEditView id={params.id} />;
}

// app/dashboard/shift/schedules/page.tsx
import { ShiftScheduleListView } from 'src/sections/shift/view';
export default function Page() {
  return <ShiftScheduleListView />;
}

// app/dashboard/shift/schedules/new/page.tsx
import { ShiftScheduleCreateView } from 'src/sections/shift/view';
export default function Page() {
  return <ShiftScheduleCreateView />;
}

// app/dashboard/shift/schedules/[id]/edit/page.tsx
import { ShiftScheduleEditView } from 'src/sections/shift/view';
export default function Page({ params }: { params: { id: string } }) {
  return <ShiftScheduleEditView id={params.id} />;
}
```

### 2. Cập nhật Navigation Menu

```tsx
// Add to your navigation config
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
  ],
}
```

### 3. Test API Endpoints

```bash
# Test templates
GET    http://localhost:5000/shift-templates
POST   http://localhost:5000/shift-templates
PUT    http://localhost:5000/shift-templates/{id}
DELETE http://localhost:5000/shift-templates/{id}

# Test schedules
GET    http://localhost:5000/shift-schedules/range?fromDate=2024-01-01&toDate=2024-12-31
POST   http://localhost:5000/shift-schedules
PUT    http://localhost:5000/shift-schedules/{id}
PUT    http://localhost:5000/shift-schedules/{id}/lock
```

## 📝 Usage Flow

### Step 1: Tạo Template
1. Đi `/dashboard/shift/templates`
2. Click "New Template"
3. Fill form:
   - Name: "Morning Shift"
   - Type: "Normal"
   - Color: "#1976d2"
4. Click "Create Template"

### Step 2: Tạo Schedule
1. Đi `/dashboard/shift/schedules`
2. Click "New Schedule"
3. Fill form:
   - Template: "Morning Shift"
   - Start Time: "08:00"
   - End Time: "17:00"
   - From Date: "2024-01-01"
   - Repeat Days: Check Mon-Fri
4. Click "Create Schedule"

### Step 3: Lock Schedule (for Payroll)
1. Trong schedule list
2. Click lock icon
3. Schedule được lock, không thể edit

## 🎯 All Routes

```
Templates:
├── /dashboard/shift/templates              → List
├── /dashboard/shift/templates/new          → Create
└── /dashboard/shift/templates/:id/edit     → Edit

Schedules:
├── /dashboard/shift/schedules              → List
├── /dashboard/shift/schedules/new          → Create
└── /dashboard/shift/schedules/:id/edit     → Edit
```

## 🔑 Key Files

```
core-fe/src/sections/shift/
├── view/
│   ├── shift-template-list-view.tsx
│   ├── shift-template-create-view.tsx
│   ├── shift-template-edit-view.tsx
│   ├── shift-schedule-list-view.tsx
│   ├── shift-schedule-create-view.tsx
│   └── shift-schedule-edit-view.tsx
├── shift-template-table-row.tsx
├── shift-schedule-table-row.tsx
├── shift-template-new-edit-form.tsx
├── shift-schedule-new-edit-form.tsx
└── shift-constants.ts
```

## ⚡ Troubleshooting

### API 404 Error
- Check backend is running
- Verify endpoints in `core-fe/src/utils/axios.ts`
- Check HOST_API in config

### Template not showing in Schedule form
- Ensure templates are created
- Check API call in `getAllShiftTemplates()`

### Lock button not working
- Check user permissions
- Verify API endpoint `/shift-schedules/{id}/lock`

## 📚 More Info

- Full documentation: `README.md`
- Migration guide: `MIGRATION_GUIDE.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`

---

**That's it! 🎉** Start using the new shift management system!
