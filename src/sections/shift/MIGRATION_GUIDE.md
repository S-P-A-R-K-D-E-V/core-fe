# Migration Guide: Old Shift System → New Template + Schedule System

## Tổng quan

Hệ thống cũ sử dụng một bảng `Shifts` duy nhất để lưu cả master data và schedule data.
Hệ thống mới tách thành 2 phần:
1. **ShiftTemplate** - Master data (tên ca, loại ca, màu sắc)
2. **ShiftSchedule** - Lịch ca cụ thể (thời gian, ngày, versioning, lock)

## Lợi ích của hệ thống mới

### 1. Separation of Concerns
- Template: Định nghĩa "loại" ca làm việc
- Schedule: Định nghĩa "khi nào" áp dụng ca đó

### 2. Versioning
- Mỗi lần update schedule tạo version mới
- Giữ lại lịch sử thay đổi
- Có thể rollback nếu cần

### 3. Payroll Locking
- Lock schedules khi tính lương
- Ngăn chặn thay đổi dữ liệu đã tính lương
- Audit trail: ai lock, khi nào

### 4. Reusability
- Một template có thể tạo nhiều schedules
- Dễ dàng tạo lịch mới từ template có sẵn

## Data Migration Steps

### Bước 1: Tạo Templates từ Shifts hiện có

```sql
-- Create templates from existing unique shift definitions
INSERT INTO ShiftTemplates (Id, Name, Description, ShiftType, IsActive, CreatedAt)
SELECT 
    NEWID() as Id,
    Name,
    Description,
    ShiftType,
    IsActive,
    GETDATE() as CreatedAt
FROM Shifts
GROUP BY Name, Description, ShiftType, IsActive;
```

### Bước 2: Tạo Schedules từ Shifts

```sql
-- Create schedules from existing shifts
INSERT INTO ShiftSchedules (
    Id, 
    ShiftTemplateId, 
    StartTime, 
    EndTime, 
    FromDate, 
    ToDate, 
    RepeatDays,
    CheckInAllowedMinutesBefore,
    Version,
    IsActive,
    TotalHours,
    CreatedAt
)
SELECT 
    NEWID() as Id,
    (SELECT TOP 1 Id FROM ShiftTemplates t 
     WHERE t.Name = s.Name AND t.ShiftType = s.ShiftType) as ShiftTemplateId,
    s.StartTime,
    s.EndTime,
    GETDATE() as FromDate, -- Hoặc lấy từ ShiftAssignments
    NULL as ToDate,
    -- Convert RepeatDays string "1,2,3,4,5" to bitmask
    CASE 
        WHEN s.RepeatDays LIKE '%1%' THEN 1 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%2%' THEN 2 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%3%' THEN 4 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%4%' THEN 8 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%5%' THEN 16 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%6%' THEN 32 ELSE 0 END |
        CASE WHEN s.RepeatDays LIKE '%7%' THEN 64 ELSE 0 END
    as RepeatDays,
    s.CheckInAllowedMinutesBefore,
    1 as Version,
    s.IsActive,
    s.TotalHours,
    s.CreatedAt
FROM Shifts s;
```

### Bước 3: Update ShiftAssignments

```sql
-- Add new column
ALTER TABLE ShiftAssignments 
ADD ShiftScheduleId uniqueidentifier NULL;

-- Update with corresponding schedule
UPDATE sa
SET sa.ShiftScheduleId = (
    SELECT TOP 1 ss.Id 
    FROM ShiftSchedules ss
    INNER JOIN ShiftTemplates st ON ss.ShiftTemplateId = st.Id
    INNER JOIN Shifts s ON s.Name = st.Name
    WHERE sa.ShiftId = s.Id
)
FROM ShiftAssignments sa;

-- Make it required after data migration
ALTER TABLE ShiftAssignments
ALTER COLUMN ShiftScheduleId uniqueidentifier NOT NULL;

-- Add foreign key
ALTER TABLE ShiftAssignments
ADD CONSTRAINT FK_ShiftAssignments_ShiftSchedules
FOREIGN KEY (ShiftScheduleId) REFERENCES ShiftSchedules(Id);
```

### Bước 4: Backup và Archive old Shifts table

```sql
-- Create backup
SELECT * INTO Shifts_Backup FROM Shifts;

-- Archive old data
-- Don't drop immediately, keep for reference
```

## Code Migration

### Old Code (Deprecated)

```typescript
// ❌ Old way
const shifts = await getAllShifts();
const shift = await getShiftById(id);
await createShift(data);
```

### New Code (Recommended)

```typescript
// ✅ New way - Step 1: Create Template
const template = await createShiftTemplate({
  name: 'Morning Shift',
  description: 'Standard morning shift',
  shiftType: 'Normal',
  color: '#1976d2',
});

// ✅ New way - Step 2: Create Schedule from Template
const schedule = await createShiftSchedule({
  shiftTemplateId: template.id,
  startTime: '08:00',
  endTime: '17:00',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  repeatDays: 31, // Mon-Fri (1|2|4|8|16 = 31)
  checkInAllowedMinutesBefore: 15,
});

// ✅ Update schedule (auto creates new version)
const updatedSchedule = await updateShiftSchedule(schedule.id, {
  startTime: '08:30', // Changed
  endTime: '17:00',
  fromDate: '2024-01-01',
  toDate: '2024-12-31',
  repeatDays: 31,
  checkInAllowedMinutesBefore: 15,
});
// Now schedule.version = 2

// ✅ Lock for payroll
await lockShiftSchedule(schedule.id, { isLocked: true });
```

## Frontend Migration

### Update Imports

```typescript
// ❌ Old
import { ShiftListView } from 'src/sections/shift/view';

// ✅ New
import { 
  ShiftTemplateListView,
  ShiftScheduleListView 
} from 'src/sections/shift/view';
```

### Update Routes

```typescript
// ❌ Old
router.push(paths.dashboard.shift.list);

// ✅ New
router.push(paths.dashboard.shift.templates.list);
router.push(paths.dashboard.shift.schedules.list);
```

## Testing Checklist

- [ ] Templates được tạo thành công từ shifts cũ
- [ ] Schedules được tạo thành công và link đúng templates
- [ ] ShiftAssignments có ShiftScheduleId hợp lệ
- [ ] UI hiển thị đúng templates và schedules
- [ ] Versioning hoạt động khi update schedule
- [ ] Lock/Unlock schedules hoạt động
- [ ] RepeatDays bitmask chuyển đổi đúng
- [ ] API endpoints hoạt động đúng
- [ ] Permissions được kiểm tra đúng

## Rollback Plan

Nếu cần rollback:

1. Restore `Shifts` table từ backup
2. Remove ShiftScheduleId từ ShiftAssignments
3. Restore old API endpoints
4. Rollback frontend code

## Timeline

- **Phase 1 (Week 1):** Deploy backend API mới
- **Phase 2 (Week 2):** Deploy frontend UI mới
- **Phase 3 (Week 3):** Data migration
- **Phase 4 (Week 4):** Testing và bug fixes
- **Phase 5 (Week 5):** Deprecate old system

## Support

Nếu gặp vấn đề trong quá trình migration:
1. Check backend logs
2. Verify data migration scripts
3. Test API endpoints với Postman
4. Check frontend console errors

## Notes

- Old Shift system vẫn hoạt động song song trong giai đoạn chuyển đổi
- Đánh dấu `[Deprecated]` trong code cũ
- Cập nhật documentation
- Training cho team về hệ thống mới
