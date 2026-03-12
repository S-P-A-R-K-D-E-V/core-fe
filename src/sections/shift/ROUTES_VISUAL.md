# Shift Management Routes - Visual Structure

## 🗺️ Route Hierarchy

```
/dashboard
  └── /shift
      ├── /templates ..................... ShiftTemplateListView
      │   ├── /new ....................... ShiftTemplateCreateView
      │   └── /[id]
      │       └── /edit .................. ShiftTemplateEditView
      │
      ├── /schedules ..................... ShiftScheduleListView
      │   ├── /new ....................... ShiftScheduleCreateView
      │   ├── /[id]
      │   │   └── /edit .................. ShiftScheduleEditView
      │   └── /template
      │       └── /[templateId] .......... ShiftScheduleListView (filtered)
      │
      ├── /list .......................... ⚠️ Deprecated → ShiftScheduleListView
      ├── /new ........................... ⚠️ Deprecated → ShiftScheduleCreateView
      └── /[id]
          └── /edit ...................... ⚠️ Deprecated → ShiftScheduleEditView
```

## 📊 User Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Shift Management                      │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│ Shift Templates  │              │ Shift Schedules  │
│ (Master Data)    │              │ (Versioned)      │
└──────────────────┘              └──────────────────┘
        │                                   │
        │                                   │
    ┌───┴───┐                          ┌───┴────┐
    │       │                          │        │
    ▼       ▼                          ▼        ▼
 List   Create/Edit              List/Filter  Create/Edit
    │       │                          │        │
    │       └──────────┐               │        │
    │                  │               │        │
    │                  ▼               │        │
    │          ┌──────────────┐        │        │
    └─────────►│ View Schedules│◄──────┘        │
               │  by Template  │                │
               └───────────────┘                │
                       │                        │
                       └────────────────────────┘
                                │
                                ▼
                        Schedule Details
                     (Lock/Unlock, Version)
```

## 🎯 Feature Access Matrix

| Feature | URL | Admin | Manager | Staff |
|---------|-----|-------|---------|-------|
| **Templates** | | | | |
| List Templates | `/shift/templates` | ✅ | ✅ | 👁️ View |
| Create Template | `/shift/templates/new` | ✅ | ✅ | ❌ |
| Edit Template | `/shift/templates/:id/edit` | ✅ | ✅ | ❌ |
| Delete Template | Action in list | ✅ | ✅ | ❌ |
| **Schedules** | | | | |
| List Schedules | `/shift/schedules` | ✅ | ✅ | 👁️ View |
| Create Schedule | `/shift/schedules/new` | ✅ | ✅ | ❌ |
| Edit Schedule | `/shift/schedules/:id/edit` | ✅ | ✅ | ❌ |
| Lock/Unlock | Action in list | ✅ | ⚠️ Some | ❌ |
| View by Template | `/shift/schedules/template/:id` | ✅ | ✅ | 👁️ View |

Legend:
- ✅ Full Access
- 👁️ Read-only
- ⚠️ Limited Access
- ❌ No Access

## 🔀 Route Flow Examples

### Create New Schedule Flow

```
1. User opens: /dashboard/shift/schedules
   └─> ShiftScheduleListView displays

2. User clicks: "New Schedule" button
   └─> Navigates to: /dashboard/shift/schedules/new
       └─> ShiftScheduleCreateView displays
           ├─> Load templates from API
           └─> Show form with template selector

3. User fills form and submits
   └─> POST /shift-schedules API
       └─> Success: redirect to /dashboard/shift/schedules
           └─> Shows newly created schedule in list
```

### Edit Schedule Flow (Versioning)

```
1. User opens: /dashboard/shift/schedules
   └─> ShiftScheduleListView displays

2. User clicks: "Edit" on a schedule
   └─> Navigates to: /dashboard/shift/schedules/[id]/edit
       └─> ShiftScheduleEditView displays
           ├─> Load current schedule data
           └─> Show form pre-filled with current values
               └─> Display warning: "Editing will create v{N+1}"

3. User modifies and submits
   └─> PUT /shift-schedules/[id] API
       └─> Backend creates new version
           └─> Success: redirect to /dashboard/shift/schedules
               └─> Shows schedule with new version number
```

### View Schedules by Template Flow

```
1. User opens: /dashboard/shift/templates
   └─> ShiftTemplateListView displays

2. User clicks: "View Schedules" on a template
   └─> Navigates to: /dashboard/shift/schedules/template/[templateId]
       └─> ShiftScheduleListView displays
           ├─> Filtered by templateId
           ├─> Shows only schedules from this template
           └─> Can still create new schedule from this template
```

### Lock Schedule Flow

```
1. User opens: /dashboard/shift/schedules
   └─> ShiftScheduleListView displays

2. User clicks: Lock icon on a schedule
   └─> PUT /shift-schedules/[id]/lock API
       ├─> isLocked: true
       └─> Records who locked and when

3. Schedule status updates
   ├─> Edit button becomes disabled
   ├─> Lock icon changes to locked state
   └─> Tooltip shows who locked
```

## 🔗 Navigation Links

### In Navigation Menu

```typescript
// Recommended menu structure
{
  title: 'Shift Management',
  icon: <CalendarIcon />,
  children: [
    {
      title: 'Templates',
      path: '/dashboard/shift/templates',
      icon: <TemplateIcon />
    },
    {
      title: 'Schedules', 
      path: '/dashboard/shift/schedules',
      icon: <ScheduleIcon />
    }
  ]
}
```

### In Breadcrumbs

```
Templates List:
Dashboard > Shift > Templates

Create Template:
Dashboard > Shift > Templates > New Template

Edit Template:
Dashboard > Shift > Templates > [Template Name]

Schedules List:
Dashboard > Shift > Schedules

Create Schedule:
Dashboard > Shift > Schedules > New Schedule

Edit Schedule:
Dashboard > Shift > Schedules > Edit

Template's Schedules:
Dashboard > Shift > Templates > [Template Name] > Schedules
```

## 📱 Responsive Behavior

All routes are fully responsive:
- Mobile: Stacked layout, simplified tables
- Tablet: 2-column layout
- Desktop: Full multi-column tables

## 🔒 Route Protection

All routes require authentication:
```typescript
// In middleware or layout
export default function ShiftLayout({ children }) {
  // Check auth
  // Check permissions
  return children;
}
```

## 🎨 URL Examples

### Templates

```
http://localhost:3000/dashboard/shift/templates
http://localhost:3000/dashboard/shift/templates/new
http://localhost:3000/dashboard/shift/templates/550e8400-e29b-41d4-a716-446655440000/edit
```

### Schedules

```
http://localhost:3000/dashboard/shift/schedules
http://localhost:3000/dashboard/shift/schedules?fromDate=2024-01-01&toDate=2024-12-31
http://localhost:3000/dashboard/shift/schedules/new
http://localhost:3000/dashboard/shift/schedules/660e8400-e29b-41d4-a716-446655440001/edit
http://localhost:3000/dashboard/shift/schedules/template/550e8400-e29b-41d4-a716-446655440000
```

### Deprecated

```
http://localhost:3000/dashboard/shift/list         ⚠️ Use /schedules
http://localhost:3000/dashboard/shift/new           ⚠️ Use /schedules/new
http://localhost:3000/dashboard/shift/[id]/edit     ⚠️ Use /schedules/[id]/edit
```

---

**All routes are now live and ready to use!** 🚀
