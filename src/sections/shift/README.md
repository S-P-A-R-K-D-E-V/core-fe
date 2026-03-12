# Shift Management System - Updated Architecture

## Cấu trúc mới

Hệ thống quản lý ca đã được tái cấu trúc theo mô hình:

```
ShiftTemplate (Master Data)
    ↓
ShiftSchedule (Versioned + Locked)
    ↓
ShiftAssignment (sẽ update để dùng ShiftScheduleId)
    ↓
AttendanceLog
    ↓
Payroll
```

## Components Created

### 1. ShiftTemplate (Master Data)
- **Views:**
  - `ShiftTemplateListView` - Danh sách templates
  - `ShiftTemplateCreateView` - Tạo template mới
  - `ShiftTemplateEditView` - Chỉnh sửa template
- **Components:**
  - `ShiftTemplateNewEditForm` - Form tạo/sửa template
  - `ShiftTemplateTableRow` - Row hiển thị trong table
- **Features:**
  - Quản lý template ca (tên, loại ca, màu sắc)
  - Active/Inactive status
  - View schedules từ template

### 2. ShiftSchedule (Versioned + Locked)
- **Views:**
  - `ShiftScheduleListView` - Danh sách schedules với filter theo date range
  - `ShiftScheduleCreateView` - Tạo schedule mới từ template
  - `ShiftScheduleEditView` - Chỉnh sửa schedule (auto version)
- **Components:**
  - `ShiftScheduleNewEditForm` - Form tạo/sửa schedule
  - `ShiftScheduleTableRow` - Row hiển thị trong table
- **Features:**
  - Tạo lịch ca từ template
  - Versioning tự động khi update
  - Lock/Unlock cho payroll
  - Filter theo date range
  - Repeat days (Monday-Sunday bitmask)

## API Endpoints

### ShiftTemplate
```typescript
POST   /shift-templates              // Create template
PUT    /shift-templates/{id}         // Update template  
DELETE /shift-templates/{id}         // Delete template
GET    /shift-templates/{id}         // Get by ID
GET    /shift-templates              // Get all
```

### ShiftSchedule
```typescript
POST   /shift-schedules                     // Create schedule
PUT    /shift-schedules/{id}                // Update (auto version)
PUT    /shift-schedules/{id}/lock           // Lock/unlock
GET    /shift-schedules/{id}                // Get by ID
GET    /shift-schedules/template/{id}       // Get by template
GET    /shift-schedules/range?from&to       // Get by date range
```

## Routes

### Templates
- `/dashboard/shift/templates` - List templates
- `/dashboard/shift/templates/new` - Create template
- `/dashboard/shift/templates/:id/edit` - Edit template

### Schedules
- `/dashboard/shift/schedules` - List schedules
- `/dashboard/shift/schedules/new` - Create schedule
- `/dashboard/shift/schedules/:id/edit` - Edit schedule
- `/dashboard/shift/schedules/template/:templateId` - View schedules by template

## Types Added

### IShiftTemplate
```typescript
{
  id: string;
  name: string;
  description?: string;
  shiftType: ShiftType;
  color?: string;
  isActive: boolean;
  createdAt: string;
}
```

### IShiftSchedule
```typescript
{
  id: string;
  shiftTemplateId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  fromDate: string;
  toDate?: string;
  repeatDays: number;  // Bitmask
  repeatDaysNames: string[];
  checkInAllowedMinutesBefore: number;
  version: number;
  isPayrollLocked: boolean;
  payrollLockedAt?: string;
  payrollLockedBy?: string;
  payrollLockerName?: string;
  isActive: boolean;
  totalHours: number;
  createdAt: string;
}
```

## Usage Flow

1. **Tạo Template:**
   - Đi đến Shift Templates
   - Click "New Template"
   - Nhập tên, loại ca (Normal/Holiday), màu sắc
   - Lưu template

2. **Tạo Schedule từ Template:**
   - Đi đến Shift Schedules
   - Click "New Schedule"
   - Chọn template
   - Thiết lập thời gian, date range, repeat days
   - Lưu schedule

3. **Chỉnh sửa Schedule:**
   - Edit schedule sẽ tự động tạo version mới
   - Version cũ vẫn được giữ lại trong database

4. **Lock/Unlock Schedule:**
   - Click icon lock/unlock trong schedule list
   - Schedule bị lock không thể edit (dùng cho payroll)

## Migration Notes

### Legacy Shift (Deprecated)
Các views cũ vẫn được giữ lại:
- `ShiftListView`
- `ShiftCreateView`
- `ShiftEditView`

Nên migrate sang hệ thống mới (Template + Schedule) để có:
- Versioning
- Lock mechanism
- Better separation of concerns

## Next Steps

1. **ShiftAssignment Update:**
   - Cập nhật ShiftAssignment để sử dụng `ShiftScheduleId` thay vì `ShiftId`
   - Migrate data từ old shifts sang new schedules

2. **Routing:**
   - Thêm routes trong routing configuration
   - Cập nhật navigation menu

3. **Permissions:**
   - Chỉ Admin/Manager mới có quyền tạo/sửa templates và schedules
   - Staff chỉ được xem

## Files Changed/Created

### Modified:
- `core-fe/src/types/corecms-api.ts` - Added new types
- `core-fe/src/utils/axios.ts` - Added new endpoints
- `core-fe/src/api/attendance.ts` - Added new API functions
- `core-fe/src/routes/paths.ts` - Added new routes
- `core-fe/src/sections/shift/view/index.ts` - Added new exports

### Created:
- `core-fe/src/sections/shift/view/shift-template-list-view.tsx`
- `core-fe/src/sections/shift/view/shift-template-create-view.tsx`
- `core-fe/src/sections/shift/view/shift-template-edit-view.tsx`
- `core-fe/src/sections/shift/shift-template-table-row.tsx`
- `core-fe/src/sections/shift/shift-template-new-edit-form.tsx`
- `core-fe/src/sections/shift/view/shift-schedule-list-view.tsx`
- `core-fe/src/sections/shift/view/shift-schedule-create-view.tsx`
- `core-fe/src/sections/shift/view/shift-schedule-edit-view.tsx`
- `core-fe/src/sections/shift/shift-schedule-table-row.tsx`
- `core-fe/src/sections/shift/shift-schedule-new-edit-form.tsx`
