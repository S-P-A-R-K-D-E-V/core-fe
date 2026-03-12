# Changelog - Shift Management System

## [2.0.0] - 2024-01-XX - Major Update

### 🎉 Added

#### New Features
- **ShiftTemplate Management System**
  - Create, read, update, delete shift templates
  - Template properties: name, type, color, description
  - Active/Inactive status toggle
  - View associated schedules from template
  
- **ShiftSchedule Management System**
  - Create schedules from templates
  - Set time range (startTime, endTime)
  - Set date range (fromDate, toDate)
  - Weekday selection with checkboxes (bitmask)
  - Automatic versioning on update
  - Lock/Unlock mechanism for payroll
  - Filter by date range
  - Display version history

#### UI Components
- `ShiftTemplateListView` - Template list with table
- `ShiftTemplateCreateView` - Create template form
- `ShiftTemplateEditView` - Edit template form
- `ShiftScheduleListView` - Schedule list with filters
- `ShiftScheduleCreateView` - Create schedule form
- `ShiftScheduleEditView` - Edit schedule form (auto version)
- `ShiftTemplateTableRow` - Template row component
- `ShiftScheduleTableRow` - Schedule row with lock button
- `ShiftTemplateNewEditForm` - Template form
- `ShiftScheduleNewEditForm` - Schedule form with weekday selection

#### API Functions
- `getAllShiftTemplates()`
- `getShiftTemplateById(id)`
- `createShiftTemplate(data)`
- `updateShiftTemplate(id, data)`
- `deleteShiftTemplate(id)`
- `getShiftSchedulesByDateRange(from, to)`
- `getShiftScheduleById(id)`
- `getShiftSchedulesByTemplate(templateId)`
- `createShiftSchedule(data)`
- `updateShiftSchedule(id, data)` - Auto creates new version
- `lockShiftSchedule(id, { isLocked })`

#### Types
- `IShiftTemplate` - Template interface
- `ICreateShiftTemplateRequest` - Create DTO
- `IUpdateShiftTemplateRequest` - Update DTO
- `IShiftSchedule` - Schedule interface
- `ICreateShiftScheduleRequest` - Create DTO
- `IUpdateShiftScheduleRequest` - Update DTO
- `ILockShiftScheduleRequest` - Lock DTO

#### Routes
- `/dashboard/shift/templates` - List templates
- `/dashboard/shift/templates/new` - Create template
- `/dashboard/shift/templates/:id/edit` - Edit template
- `/dashboard/shift/schedules` - List schedules
- `/dashboard/shift/schedules/new` - Create schedule
- `/dashboard/shift/schedules/:id/edit` - Edit schedule

#### Utilities
- `shift-constants.ts` - WeekDays constants & helper functions
  - `WEEKDAYS` - Bitmask constants
  - `WEEKDAYS_LIST` - Day definitions
  - `getWeekDayNames()` - Convert bitmask to names
  - `daysToBitmask()` - Convert array to bitmask
  - `bitmaskToDays()` - Convert bitmask to array
  - `SHIFT_TYPE_COLORS` - Default colors

#### Documentation
- `README.md` - Complete usage guide
- `QUICK_START.md` - 5-minute setup guide
- `MIGRATION_GUIDE.md` - Migration from old system
- `ROUTE_EXAMPLES.tsx` - Route configuration examples
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `CHANGELOG.md` - Version history

### 🔄 Changed

#### Modified Files
- `core-fe/src/types/corecms-api.ts`
  - Added `IShiftTemplate` and related types
  - Added `IShiftSchedule` and related types
  - Marked old `IShift` as deprecated (legacy)

- `core-fe/src/utils/axios.ts`
  - Added `shiftTemplates` endpoints
  - Added `shiftSchedules` endpoints

- `core-fe/src/api/attendance.ts`
  - Added template CRUD functions
  - Added schedule CRUD functions
  - Added lock/unlock function
  - Marked old shift functions as legacy

- `core-fe/src/routes/paths.ts`
  - Added `shift.templates` routes
  - Added `shift.schedules` routes

- `core-fe/src/sections/shift/view/index.ts`
  - Added exports for new views
  - Marked old views as deprecated

### 🗑️ Deprecated

- `ShiftListView` - Use `ShiftTemplateListView` instead
- `ShiftCreateView` - Use `ShiftTemplateCreateView` + `ShiftScheduleCreateView`
- `ShiftEditView` - Use `ShiftTemplateEditView` + `ShiftScheduleEditView`
- Old `IShift` API - Migrate to `IShiftTemplate` + `IShiftSchedule`

### 📊 Statistics

- **Files Created:** 14
- **Files Modified:** 5
- **New API Endpoints:** 11
- **New Routes:** 6
- **New Components:** 6
- **New Views:** 6
- **Lines of Code:** ~2,500+

### 🔒 Security

- Lock mechanism prevents editing schedules used in payroll
- Audit trail: tracks who locked and when
- Versioning: prevents data loss

### 🚀 Performance

- Efficient date range filtering
- Pagination in list views
- Lazy loading of templates in schedule form

### 📈 Improvements

- **Better Data Structure:** Separation of template and schedule
- **Versioning:** Track all changes with versions
- **Locking:** Protect payroll data integrity
- **Reusability:** One template → many schedules
- **UX:** Color coding, clear status indicators
- **Flexibility:** Weekday bitmask for complex patterns

---

## [1.0.0] - Previous Version

### Initial Features
- Basic shift management
- Single Shift entity
- Create/Edit/Delete shifts
- Shift assignments
- Attendance logging

---

## Migration Notes

To upgrade from v1.0.0 to v2.0.0:

1. Follow `MIGRATION_GUIDE.md`
2. Run data migration scripts
3. Update routing configuration
4. Test all features
5. Deprecate old shift views

## Breaking Changes

⚠️ **API Changes:**
- ShiftAssignments will need `ShiftScheduleId` instead of `ShiftId`
- RepeatDays format changed from string "1,2,3" to bitmask number

⚠️ **Database Changes:**
- New tables: `ShiftTemplates`, `ShiftSchedules`
- `ShiftAssignments.ShiftScheduleId` will replace `ShiftId`

## Compatibility

- ✅ Backend API: v2.0.0+
- ✅ Frontend: React 18+
- ✅ UI Framework: MUI v5+
- ✅ TypeScript: 4.9+

---

**Maintained by:** Core Development Team
**Last Updated:** 2024-01-XX
