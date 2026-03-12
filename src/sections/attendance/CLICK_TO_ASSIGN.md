# ✅ Enhanced - Click Event to Assign

## 🎯 Feature Update

**Trước:** Click event → Không làm gì / Show detail  
**Bây giờ:** Click event → Mở dialog tạo phân công với date + schedule đã set sẵn

---

## 🖱️ User Interactions

### 1. Click vào Event (Schedule Box)
```
User: Clicks on "Sáng" schedule on 2026-03-15
System:
- Opens "Phân công ca làm việc" dialog
- Pre-fills date: 2026-03-15 ✅
- Pre-fills schedule: Sáng ✅
- User only needs to select staff
```

### 2. Click vào Empty Date (Select Range)
```
User: Clicks on empty space on 2026-03-20
System:
- Opens "Phân công ca làm việc" dialog
- Pre-fills date: 2026-03-20 ✅
- Schedule: Empty (user chooses)
```

---

## 💡 Implementation

### handleClickEvent
```typescript
const handleClickEvent = useCallback(
  (arg: EventClickArg) => {
    const { extendedProps } = arg.event;
    
    // Extract from event
    const clickedDate = extendedProps.date;        // "2026-03-15"
    const clickedScheduleId = extendedProps.scheduleId;  // "abc-123"
    
    // Pre-fill form
    if (clickedDate) setNewDate(clickedDate);
    if (clickedScheduleId) setNewScheduleId(clickedScheduleId);
    
    // Open create dialog
    setAssignMode('single');
    createDialog.onTrue();
  },
  [createDialog]
);
```

### handleSelectRange (Empty Date)
```typescript
const handleSelectRange = useCallback(
  (arg: DateSelectArg) => {
    // Unselect in calendar
    calendarApi.unselect();
    
    // Pre-fill date only
    const dateStr = new Date(arg.start).toISOString().split('T')[0];
    setNewDate(dateStr);
    
    // Clear schedule (user will choose)
    setNewScheduleId('');
    
    // Open create dialog
    setAssignMode('single');
    createDialog.onTrue();
  },
  [createDialog]
);
```

---

## 🎨 User Flow

### Flow 1: Quick Assign from Schedule
```
1. User sees "Sáng" schedule on 2026-03-15
2. User clicks on schedule box
3. Dialog opens with:
   - Date: 2026-03-15 ✅
   - Schedule: Sáng ✅
   - Staff: [Empty - User selects]
4. User selects staff
5. Click "Phân công"
6. Assignment created!
```

### Flow 2: Select Date First
```
1. User clicks empty date 2026-03-20
2. Dialog opens with:
   - Date: 2026-03-20 ✅
   - Schedule: [Empty - User selects]
   - Staff: [Empty - User selects]
3. User selects schedule and staff
4. Click "Phân công"
5. Assignment created!
```

---

## ✨ Benefits

### 1. Faster Assignment
- ✅ 2 clicks instead of 4+ clicks
- ✅ Date and schedule pre-filled
- ✅ Focus on selecting staff only

### 2. Better UX
- ✅ Visual feedback (click on what you see)
- ✅ Context-aware (knows what you clicked)
- ✅ Less typing required

### 3. Intuitive
- ✅ Click on schedule → Assign to that schedule
- ✅ Click on date → Create for that date
- ✅ Natural workflow

---

## 🔧 Technical Details

### Event Data Structure
```typescript
{
  id: 'schedule-abc-2026-03-15',
  title: 'Sáng',
  extendedProps: {
    scheduleId: 'abc-123',    // ← Used for pre-fill
    date: '2026-03-15',       // ← Used for pre-fill
    color: '#2196F3',
    users: [...]
  }
}
```

### Form State
```typescript
// Click on event
setNewDate('2026-03-15');        // From extendedProps.date
setNewScheduleId('abc-123');     // From extendedProps.scheduleId

// Click on empty date
setNewDate('2026-03-20');        // From DateSelectArg
setNewScheduleId('');            // Clear (user chooses)
```

---

## 📊 Before vs After

### Before
```
Step 1: Click "Phân công ca" button
Step 2: Select date (type or pick)
Step 3: Select schedule (scroll dropdown)
Step 4: Select staff
Step 5: Submit

Total: 5 steps
```

### After
```
Step 1: Click on schedule box (date + schedule auto-filled!)
Step 2: Select staff
Step 3: Submit

Total: 3 steps ✅
```

**Saved:** 2 steps (40% faster!)

---

## 🎯 Use Cases

### UC1: Assign User to Existing Schedule
```
Manager: "I need to assign John to Sáng shift on March 15"
Action: Click "Sáng" box on March 15
Result: Form opens with date and schedule ready
Manager: Select John → Submit
Done! ✅
```

### UC2: Create New Assignment on Specific Date
```
Manager: "Need to assign someone on March 20"
Action: Click empty space on March 20
Result: Form opens with date ready
Manager: Select schedule → Select staff → Submit
Done! ✅
```

### UC3: Multiple Assignments Same Schedule
```
Manager: "Assign 3 people to Chiều on March 16"
Action: 
1. Click "Chiều" box on March 16
2. Select User 1 → Submit
3. Click "Chiều" box again (still pre-filled!)
4. Select User 2 → Submit
5. Click "Chiều" box again
6. Select User 3 → Submit
Done! ✅
```

---

## ✅ Summary

### Changes
1. ✅ `handleClickEvent` - Pre-fill date + schedule from event
2. ✅ `handleSelectRange` - Pre-fill date, clear schedule

### Benefits
- ✅ **40% faster** assignment creation
- ✅ **Context-aware** pre-filling
- ✅ **Intuitive** click-to-assign workflow

### User Experience
- ✅ Click on schedule → Assign to that schedule
- ✅ Click on date → Create for that date
- ✅ Less clicks, more productivity!

---

## 🚀 Ready to Use

```typescript
// Click on schedule event
onClick(scheduleEvent) → Dialog opens with:
  date: ✅ Pre-filled
  schedule: ✅ Pre-filled
  staff: Select here

// Click on empty date
onClick(emptyDate) → Dialog opens with:
  date: ✅ Pre-filled
  schedule: Select here
  staff: Select here
```

**Status:** ✅ IMPLEMENTED  
**Workflow:** Optimized (5 steps → 3 steps)  
**UX:** Improved significantly!

🎉 **Click vào event để phân công nhanh chóng!**
