# ✅ Refactored - Schedule-Based Calendar Events

## 🎯 Thay Đổi Chính

**Trước đây:**
- Events = Assignments (mỗi user → 1 event)
- Không hiển thị schedule rõ ràng

**Bây giờ:**
- Events = Schedules (mỗi schedule → 1 event)
- Trong event box → list users được assigned

---

## 🎨 Visual Design

### Month View
```
┌─────────────────┐
│ Sáng         [3]│  ← Schedule name + user count
└─────────────────┘
```

### Week View
```
┌──────────────────────┐
│ Sáng                 │  ← Schedule name (header)
├──────────────────────┤
│ 👤 John Doe      ✅  │  ← User + check-in status
│ 👤 Jane Smith    ⏰  │  ← Late indicator
│ 👤 Bob Wilson        │  ← No check-in yet
└──────────────────────┘
```

---

## 📊 Data Flow

### 1. Generate Events from Schedules
```typescript
schedules.forEach(schedule => {
  // Loop through date range
  for (let date...) {
    // Check if schedule repeats on this day
    if (schedule.repeatDays & dayOfWeek) {
      // Find assigned users for this schedule on this date
      const assignedUsers = tableData
        .filter(a => 
          a.shiftScheduleId === schedule.id && 
          a.date === dateStr
        )
        .map(a => ({
          staffName: a.staffName,
          checkInTime: ...,
          isLate: ...,
        }));

      // Create event
      events.push({
        id: `schedule-${schedule.id}-${date}`,
        title: schedule.templateName,
        backgroundColor: schedule.color,
        extendedProps: { assignedUsers },
      });
    }
  }
});
```

### 2. Custom Event Rendering

**Week View:**
```typescript
<Box>
  {/* Schedule header */}
  <Typography>{event.title}</Typography>
  
  {/* Assigned users list */}
  {assignedUsers.map(user => (
    <Stack>
      <Icon user />
      <Text>{user.staffName}</Text>
      {user.checkInTime && <Icon check />}
      {user.isLate && <Icon alarm />}
    </Stack>
  ))}
  
  {/* Empty state */}
  {assignedUsers.length === 0 && (
    <Text>Chưa có nhân viên</Text>
  )}
</Box>
```

**Month View:**
```typescript
<Stack direction="row">
  <Text>{event.title}</Text>
  <Chip>{assignedUsers.length}</Chip>
</Stack>
```

---

## 🎯 Features

### Event Structure
```typescript
{
  id: 'schedule-abc-2026-03-15',
  title: 'Sáng',
  start: '2026-03-15T08:00:00',
  end: '2026-03-15T12:00:00',
  backgroundColor: '#2196F3',  // From schedule.color
  extendedProps: {
    type: 'schedule',
    scheduleId: 'abc',
    scheduleName: 'Sáng',
    version: 2,
    assignedUsers: [
      {
        assignmentId: 'xyz',
        staffName: 'John Doe',
        checkInTime: '08:05',
        checkOutTime: '12:00',
        isLate: false,
      },
      ...
    ]
  }
}
```

### User Display (Week View)
```typescript
// Each user in a row
<Stack 
  backgroundColor="rgba(255,255,255,0.15)"  // Semi-transparent
  borderRadius={0.5}
  px={0.5}
  py={0.25}
>
  <Icon user />
  <Text>{staffName}</Text>
  {checkInTime && <Icon check color="green" />}
  {isLate && <Icon alarm color="orange" />}
</Stack>
```

---

## ✅ Benefits

### 1. Better Organization
- ✅ Group by schedule (not individual users)
- ✅ See all users in same shift together
- ✅ Clear schedule structure

### 2. Visual Clarity
- ✅ Schedule color from template
- ✅ User count badge (month view)
- ✅ User list (week view)
- ✅ Check-in status at a glance

### 3. Scalability
- ✅ Works with many users per schedule
- ✅ Scroll within event box if needed
- ✅ Empty state when no assignments

---

## 🔄 Event Generation Logic

### Step 1: Loop Schedules
```typescript
schedules.forEach(schedule => { ... })
```

### Step 2: Generate Events for Each Date
```typescript
for (date in dateRange) {
  if (schedule.repeatDays & dayOfWeek) {
    // Create event for this date
  }
}
```

### Step 3: Find Assigned Users
```typescript
const assignedUsers = assignments
  .filter(a => 
    a.shiftScheduleId === schedule.id && 
    a.date === date
  )
  .map(a => ({
    staffName: a.staffName,
    checkInTime: a.attendanceLog?.checkInTime,
    isLate: a.attendanceLog?.isLate,
  }))
```

### Step 4: Create Event
```typescript
events.push({
  id: `schedule-${schedule.id}-${date}`,
  title: schedule.templateName,
  backgroundColor: schedule.color,
  extendedProps: { assignedUsers }
})
```

---

## 📱 Responsive Design

### Week View
- Desktop: Show all users in list
- Mobile: Scrollable list within event

### Month View
- Simple badge with count
- Click to see details

---

## 🎨 Visual Examples

### Empty Schedule
```
┌──────────────────┐
│ Sáng             │
├──────────────────┤
│ Chưa có nhân viên│
└──────────────────┘
```

### With Users (Normal)
```
┌──────────────────┐
│ Sáng             │
├──────────────────┤
│ 👤 John    ✅    │
│ 👤 Jane    ✅    │
│ 👤 Bob     ✅    │
└──────────────────┘
```

### With Users (Late)
```
┌──────────────────┐
│ Sáng             │
├──────────────────┤
│ 👤 John    ✅    │
│ 👤 Jane    ⏰    │  ← Late
│ 👤 Bob           │  ← Not checked in
└──────────────────┘
```

---

## 🔧 Technical Details

### Event ID Format
```
schedule-{scheduleId}-{date}
```

Example: `schedule-abc123-2026-03-15`

### User Data Structure
```typescript
{
  assignmentId: string;
  staffName: string;
  staffId: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  isLate: boolean;
  note?: string;
}
```

### Color Priority
1. Schedule color (from template)
2. Fallback: `#2196F3`

---

## 🎯 Use Cases

### UC1: View Schedule with Users
```
Manager: Opens calendar
System:
- Shows "Sáng" schedule (blue)
- Lists 3 users assigned
- Shows check-in status for each
```

### UC2: Empty Schedule
```
Manager: Sees schedule block
System:
- Shows "Chiều" schedule (orange)
- Shows "Chưa có nhân viên"
- Can click to assign users
```

### UC3: Late Arrival
```
Manager: Checks schedule
System:
- Shows user with ⏰ icon
- Indicates late check-in
- Can click for details
```

---

## ✅ Status

- ✅ **Events = Schedules** - Each schedule is an event
- ✅ **Users in box** - List of assigned users
- ✅ **Color from schedule** - Template color
- ✅ **Check-in status** - Icons for each user
- ✅ **Empty state** - "Chưa có nhân viên"
- ✅ **Month view** - Count badge
- ✅ **Week view** - Full list
- ✅ **Ready to use**

---

**Status:** ✅ COMPLETED  
**Approach:** Schedule-based events  
**Display:** Users list in event box  
**Ready:** ✅ YES

🎉 **Calendar giờ hiển thị schedules với list users bên trong!**
