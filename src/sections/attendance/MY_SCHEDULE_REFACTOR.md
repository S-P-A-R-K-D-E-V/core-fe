# ✅ Refactored - My Schedule View

## 🎯 Thay Đổi Chính

**Trước:** Assignment-based calendar  
**Bây giờ:** Schedule-based calendar (tương tự attendance-assignments-view-v2)

---

## 🎨 Visual Design

### Month View
```
┌──────────────┐
│ Sáng      ✅ │  ← Schedule + check-in status
└──────────────┘
```

### Week View
```
┌──────────────┐
│ Sáng         │  ← Schedule name
├──────────────┤
│ ✅ In: 08:05 │  ← My check-in
│ 🚪 Out: 12:00│  ← My check-out
└──────────────┘

Or (if late):
┌──────────────┐
│ Chiều        │
├──────────────┤
│ ⏰ In: 12:16 │  ← Late indicator
│ 🚪 Out: 18:00│
└──────────────┘

Or (not checked in):
┌──────────────┐
│ Tối          │
├──────────────┤
│ Chưa chấm công│
└──────────────┘
```

---

## 📊 Key Changes

### 1. Data Flow
```typescript
// Before: Assignment-based
assignments.map(a => createEvent(a))

// After: Schedule-based
schedules.map(schedule => {
  const myAssignment = findMyAssignment(schedule, date)
  return createEvent(schedule, myAssignment)
})
```

### 2. Event Structure
```typescript
{
  id: 'schedule-abc-2026-03-15',
  title: 'Sáng',
  backgroundColor: '#2196F3',  // From schedule.color
  borderColor: isLate ? '#FFA726' : '#2196F3',
  extendedProps: {
    scheduleId: 'abc',
    myAssignment: {
      checkInTime: '08:05',
      checkOutTime: '12:00',
      isLate: false,
      workedHours: 4.0,
      status: 'Present',
    }
  }
}
```

### 3. Custom Rendering

**Week View:**
- Schedule name header
- Check-in time with icon (green if on-time, orange if late)
- Check-out time with icon
- "Chưa chấm công" if not checked in

**Month View:**
- Schedule name
- Status icon (✅ completed, 🚪 checked-in, ⏰ late)

---

## ✨ Benefits

### 1. Consistent UI
- ✅ Same design as manager view (attendance-assignments-view-v2)
- ✅ Schedule-based layout
- ✅ Color from schedule template

### 2. Better Visualization
- ✅ Schedule blocks show context
- ✅ My attendance overlaid on schedule
- ✅ Late indicators clear

### 3. Complete Info
- ✅ Schedule color
- ✅ Check-in/out status
- ✅ Late minutes
- ✅ Worked hours

---

## 🔧 Technical Details

### Imports
```typescript
import { 
  IShiftSchedule,        // ← Added
  IShiftAssignment, 
  IAttendanceLog 
} from 'src/types/corecms-api';

import { 
  getMySchedule, 
  getMyAttendanceLogs,
  getShiftSchedulesByDateRange  // ← Added
} from 'src/api/attendance';
```

### State
```typescript
const [schedules, setSchedules] = useState<IShiftSchedule[]>([]);  // ← Added
const [assignments, setAssignments] = useState<IAssignmentWithDetails[]>([]);
```

### Fetch Logic
```typescript
const [schedulesData, assignmentsData, logsData] = await Promise.all([
  getShiftSchedulesByDateRange(from, to),  // ← Get schedules
  getMySchedule(from, to),                 // My assignments
  getMyAttendanceLogs(from, to),          // My attendance
]);

// Map assignments with details
const assignmentsWithDetails = assignmentsData.map(assignment => {
  const schedule = schedulesData.find(s => s.id === assignment.shiftScheduleId);
  const log = logsData.find(l => l.shiftAssignmentId === assignment.id);
  return {
    ...assignment,
    scheduleColor: schedule?.color,
    attendanceLog: log,
  };
});
```

### Event Generation
```typescript
schedules.forEach(schedule => {
  for (date in dateRange) {
    if (schedule.repeatDays & dayOfWeek) {
      // Find my assignment for this schedule on this date
      const myAssignment = assignments.find(a => 
        a.shiftScheduleId === schedule.id && 
        a.date === dateStr
      );

      events.push({
        title: schedule.templateName,
        backgroundColor: schedule.color,
        extendedProps: {
          myAssignment: myAssignment ? {
            checkInTime: ...,
            checkOutTime: ...,
            isLate: ...,
          } : null
        }
      });
    }
  }
});
```

---

## 📱 Custom Rendering

### Week View
```typescript
if (view === 'timeGridWeek') {
  return (
    <Box>
      {/* Schedule header */}
      <Typography>{schedule.templateName}</Typography>
      
      {myAssignment ? (
        <>
          {/* Check-in */}
          <Stack>
            <Icon checkIn color={isLate ? 'orange' : 'green'} />
            <Text>In: {checkInTime}</Text>
          </Stack>
          
          {/* Check-out */}
          <Stack>
            <Icon checkOut />
            <Text>Out: {checkOutTime}</Text>
          </Stack>
        </>
      ) : (
        <Text>Chưa chấm công</Text>
      )}
    </Box>
  );
}
```

### Month View
```typescript
if (view === 'dayGridMonth') {
  return (
    <Stack direction="row">
      <Text>{schedule.templateName}</Text>
      {myAssignment && (
        <>
          {hasCheckIn && <Icon checkIn />}
          {hasCheckOut && <Icon checkOut />}
          {isLate && <Icon alarm />}
        </>
      )}
    </Stack>
  );
}
```

---

## 📊 Summary Stats

Updated to use `attendanceLog`:
```typescript
// Before
assignments.filter(a => a.attendance?.checkInTime)

// After
assignments.filter(a => a.attendanceLog?.checkInTime)
```

---

## ✅ Features

### Calendar
- ✅ Schedule-based events
- ✅ Color from schedule template
- ✅ My attendance status overlay
- ✅ Late indicator
- ✅ Custom rendering for month/week views

### Summary
- ✅ Total shifts
- ✅ Checked-in count
- ✅ Completed count
- ✅ Late count
- ✅ Not checked-in count

### Detail Dialog
- ✅ Schedule color badge
- ✅ Schedule name + version
- ✅ Date and time
- ✅ Check-in/out details
- ✅ Late minutes if applicable
- ✅ Worked hours
- ✅ Status label

---

## 🎯 Use Cases

### UC1: View My Schedule
```
Staff: Opens "Lịch làm việc"
System:
- Shows schedules with colors
- Overlays my check-in/out status
- Highlights late arrivals
```

### UC2: Check Attendance Status
```
Staff: Looks at calendar
System:
- ✅ = Checked in on-time
- ⏰ = Late
- No icon = Not checked in yet
```

### UC3: View Details
```
Staff: Clicks on schedule event
System:
- Shows schedule info
- Shows my attendance details
- Shows worked hours
```

---

## 🔄 Before vs After

### Before
```
Events = Assignments
Color = Based on attendance status (gray/orange/green/blue)
Data = Assignment-centric
```

### After
```
Events = Schedules
Color = From schedule template
Data = Schedule-centric with my assignment overlaid
Layout = Same as manager view
```

---

## ✅ Status

- ✅ **Schedule-based** - Events from schedules
- ✅ **Color support** - From schedule templates
- ✅ **Attendance overlay** - My check-in/out on schedule
- ✅ **Custom rendering** - Week and month views
- ✅ **Late indicator** - Orange icon when late
- ✅ **Consistent UI** - Matches manager view
- ✅ **Ready to use**

---

**Status:** ✅ COMPLETED  
**Approach:** Schedule-based (like manager view)  
**UI:** Personal schedule with attendance overlay  
**Ready:** ✅ YES

🎉 **My Schedule giờ hiển thị schedules với attendance status!**
