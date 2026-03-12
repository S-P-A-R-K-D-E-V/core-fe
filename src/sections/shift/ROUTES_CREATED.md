# Routes Created - Shift Management System

## ✅ New Routes Created

### ShiftTemplate Routes (3 routes)

1. **List Templates**
   - Path: `/dashboard/shift/templates`
   - File: `core-fe/src/app/dashboard/shift/templates/page.tsx`
   - Component: `ShiftTemplateListView`
   - Description: Danh sách tất cả shift templates

2. **Create Template**
   - Path: `/dashboard/shift/templates/new`
   - File: `core-fe/src/app/dashboard/shift/templates/new/page.tsx`
   - Component: `ShiftTemplateCreateView`
   - Description: Tạo shift template mới

3. **Edit Template**
   - Path: `/dashboard/shift/templates/[id]/edit`
   - File: `core-fe/src/app/dashboard/shift/templates/[id]/edit/page.tsx`
   - Component: `ShiftTemplateEditView`
   - Description: Chỉnh sửa shift template
   - Params: `id` (template ID)

### ShiftSchedule Routes (4 routes)

4. **List Schedules**
   - Path: `/dashboard/shift/schedules`
   - File: `core-fe/src/app/dashboard/shift/schedules/page.tsx`
   - Component: `ShiftScheduleListView`
   - Description: Danh sách tất cả shift schedules với filter date range

5. **Create Schedule**
   - Path: `/dashboard/shift/schedules/new`
   - File: `core-fe/src/app/dashboard/shift/schedules/new/page.tsx`
   - Component: `ShiftScheduleCreateView`
   - Description: Tạo shift schedule mới từ template

6. **Edit Schedule**
   - Path: `/dashboard/shift/schedules/[id]/edit`
   - File: `core-fe/src/app/dashboard/shift/schedules/[id]/edit/page.tsx`
   - Component: `ShiftScheduleEditView`
   - Description: Chỉnh sửa shift schedule (auto creates new version)
   - Params: `id` (schedule ID)

7. **Schedules by Template**
   - Path: `/dashboard/shift/schedules/template/[templateId]`
   - File: `core-fe/src/app/dashboard/shift/schedules/template/[templateId]/page.tsx`
   - Component: `ShiftScheduleListView`
   - Description: Xem tất cả schedules của một template
   - Params: `templateId` (template ID)

## 🔄 Updated Legacy Routes (3 routes)

### Deprecated Routes (kept for backward compatibility)

8. **Old Shift List** ⚠️ Deprecated
   - Path: `/dashboard/shift/list`
   - File: `core-fe/src/app/dashboard/shift/list/page.tsx`
   - Component: `ShiftScheduleListView` (redirected)
   - Description: Old route, now uses new schedule list view
   - **Action:** Update references to use `/dashboard/shift/schedules`

9. **Old Shift Create** ⚠️ Deprecated
   - Path: `/dashboard/shift/new`
   - File: `core-fe/src/app/dashboard/shift/new/page.tsx`
   - Component: `ShiftScheduleCreateView` (redirected)
   - Description: Old route, now uses new schedule create view
   - **Action:** Update references to use `/dashboard/shift/schedules/new`

10. **Old Shift Edit** ⚠️ Deprecated
    - Path: `/dashboard/shift/[id]/edit`
    - File: `core-fe/src/app/dashboard/shift/[id]/edit/page.tsx`
    - Component: `ShiftScheduleEditView` (redirected)
    - Description: Old route, now uses new schedule edit view
    - **Action:** Update references to use `/dashboard/shift/schedules/[id]/edit`

## 📁 File Structure

```
core-fe/src/app/dashboard/shift/
├── templates/
│   ├── page.tsx                    # List templates
│   ├── new/
│   │   └── page.tsx                # Create template
│   └── [id]/
│       └── edit/
│           └── page.tsx            # Edit template
├── schedules/
│   ├── page.tsx                    # List schedules
│   ├── new/
│   │   └── page.tsx                # Create schedule
│   ├── [id]/
│   │   └── edit/
│   │       └── page.tsx            # Edit schedule
│   └── template/
│       └── [templateId]/
│           └── page.tsx            # Schedules by template
├── list/
│   └── page.tsx                    # ⚠️ Deprecated
├── new/
│   └── page.tsx                    # ⚠️ Deprecated
└── [id]/
    └── edit/
        └── page.tsx                # ⚠️ Deprecated
```

## 🔗 URL Mapping

### New Routes (Recommended)

| Feature | URL | Component |
|---------|-----|-----------|
| Templates List | `/dashboard/shift/templates` | ShiftTemplateListView |
| Create Template | `/dashboard/shift/templates/new` | ShiftTemplateCreateView |
| Edit Template | `/dashboard/shift/templates/123/edit` | ShiftTemplateEditView |
| Schedules List | `/dashboard/shift/schedules` | ShiftScheduleListView |
| Create Schedule | `/dashboard/shift/schedules/new` | ShiftScheduleCreateView |
| Edit Schedule | `/dashboard/shift/schedules/456/edit` | ShiftScheduleEditView |
| Template Schedules | `/dashboard/shift/schedules/template/123` | ShiftScheduleListView |

### Old Routes (Deprecated)

| Old URL | New URL | Status |
|---------|---------|--------|
| `/dashboard/shift/list` | `/dashboard/shift/schedules` | ⚠️ Deprecated |
| `/dashboard/shift/new` | `/dashboard/shift/schedules/new` | ⚠️ Deprecated |
| `/dashboard/shift/123/edit` | `/dashboard/shift/schedules/123/edit` | ⚠️ Deprecated |

## 🚀 How to Access

### Via Code (paths.ts)

```typescript
import { paths } from 'src/routes/paths';

// Templates
router.push(paths.dashboard.shift.templates.list);
router.push(paths.dashboard.shift.templates.new);
router.push(paths.dashboard.shift.templates.edit('template-id'));

// Schedules
router.push(paths.dashboard.shift.schedules.list);
router.push(paths.dashboard.shift.schedules.new);
router.push(paths.dashboard.shift.schedules.edit('schedule-id'));
router.push(paths.dashboard.shift.schedules.byTemplate('template-id'));
```

### Via Browser

Templates:
- http://localhost:3000/dashboard/shift/templates
- http://localhost:3000/dashboard/shift/templates/new
- http://localhost:3000/dashboard/shift/templates/abc123/edit

Schedules:
- http://localhost:3000/dashboard/shift/schedules
- http://localhost:3000/dashboard/shift/schedules/new
- http://localhost:3000/dashboard/shift/schedules/def456/edit
- http://localhost:3000/dashboard/shift/schedules/template/abc123

## 📝 Next Steps

### 1. Update Navigation Menu

Add to your navigation configuration (e.g., `config-navigation.tsx`):

```typescript
{
  title: 'Shift Management',
  path: paths.dashboard.shift.root,
  icon: ICONS.calendar,
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

### 2. Update Links in Code

Find and replace old paths:

```bash
# Find old paths
/dashboard/shift/list → /dashboard/shift/schedules
/dashboard/shift/new → /dashboard/shift/schedules/new
/dashboard/shift/:id/edit → /dashboard/shift/schedules/:id/edit
```

### 3. Add Permissions

```typescript
// Route guards (if using)
const shiftTemplatePermissions = ['Admin', 'Manager'];
const shiftSchedulePermissions = ['Admin', 'Manager'];
const shiftViewPermissions = ['Admin', 'Manager', 'Staff'];
```

### 4. Test All Routes

- [ ] `/dashboard/shift/templates` - List loads correctly
- [ ] `/dashboard/shift/templates/new` - Create form works
- [ ] `/dashboard/shift/templates/[id]/edit` - Edit form works
- [ ] `/dashboard/shift/schedules` - List with date filter works
- [ ] `/dashboard/shift/schedules/new` - Create from template works
- [ ] `/dashboard/shift/schedules/[id]/edit` - Edit creates new version
- [ ] `/dashboard/shift/schedules/template/[id]` - Filter by template works

### 5. Remove Deprecated Routes (After Migration)

After all references updated, you can remove:
- `core-fe/src/app/dashboard/shift/list/page.tsx`
- `core-fe/src/app/dashboard/shift/new/page.tsx`
- `core-fe/src/app/dashboard/shift/[id]/edit/page.tsx`

## ⚠️ Breaking Changes

If you remove deprecated routes, update these:
- Any bookmarks users may have
- Any external links pointing to old URLs
- Any hardcoded paths in codebase

## 💡 Tips

1. **Use paths.ts**: Always use `paths.dashboard.shift.*` instead of hardcoding URLs
2. **Gradual Migration**: Keep deprecated routes temporarily during transition
3. **Add Redirects**: Consider adding Next.js redirects in `next.config.js`
4. **Update Documentation**: Update user documentation with new URLs

## 📊 Summary

- **Total Routes Created:** 7 new routes
- **Total Routes Updated:** 3 deprecated routes
- **Total Files Created:** 7 files
- **Total Files Modified:** 3 files

---

**Status:** ✅ All routes created and ready to use!

**Last Updated:** 2024-01-XX
