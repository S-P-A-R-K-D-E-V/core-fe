# Quick Test - Frontend Backend Integration

## Bước 1: Kiểm tra Backend đang chạy

```bash
# Terminal 1 - Backend
cd G:\spark\github\Core\Core-be\CoreCms
dotnet run --project CoreCms.Api
```

Backend API: http://localhost:2510

## Bước 2: Test Backend với cURL/PowerShell

```powershell
# Test Register
$body = @{
    firstName = "Test"
    lastName = "User"
    email = "test@example.com"
    password = "Test@123"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:2510/auth/register" `
    -Method POST -Body $body -ContentType "application/json"
```

Nếu thành công, bạn sẽ nhận được response với `token` và `refreshToken`.

## Bước 3: Start Frontend

```bash
# Terminal 2 - Frontend
cd G:\spark\github\Core\core-fe

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend: http://localhost:8082

## Bước 4: Test Login Flow

1. Mở browser: http://localhost:8082
2. Navigate đến: http://localhost:8082/auth/jwt/login
3. Login với:
   - Email: `test@example.com`
   - Password: `Test@123`
4. Nếu thành công, sẽ redirect đến dashboard

## Bước 5: Kiểm tra Auth State

Mở Browser DevTools (F12):

### Console
```javascript
// Check access token
sessionStorage.getItem('accessToken')

// Check refresh token
sessionStorage.getItem('refreshToken')

// Check if user is logged in
// Should see user data in React DevTools
```

### Network Tab
- Kiểm tra request đến `http://localhost:2510/auth/login`
- Response status nên là 200
- Response body nên có `token` và `refreshToken`

## Bước 6: Test Protected Routes

1. Sau khi login, navigate đến dashboard: http://localhost:8082/dashboard
2. Nên thấy dashboard content
3. Logout và thử access dashboard lại
4. Nên redirect về login page

## Bước 7: Test Logout

1. Click vào profile avatar (góc phải trên)
2. Click "Logout"
3. Kiểm tra sessionStorage đã clear
4. Nên redirect về login page

## 🐛 Common Issues & Solutions

### Issue 1: CORS Error
```
Access to XMLHttpRequest at 'http://localhost:2510/auth/login' from origin 'http://localhost:8082' has been blocked by CORS policy
```

**Solution:**
- Kiểm tra backend đã enable CORS (đã thêm trong Program.cs)
- Restart backend API

### Issue 2: Connection Refused
```
net::ERR_CONNECTION_REFUSED
```

**Solution:**
- Kiểm tra backend đang chạy
- Kiểm tra port 2510 có bị chiếm không

### Issue 3: 401 Unauthorized trên protected routes
```
401 Unauthorized
```

**Solution:**
- Token không được gửi đúng
- Kiểm tra `axios.defaults.headers.common.Authorization`
- Login lại

### Issue 4: Token không lưu vào sessionStorage
**Solution:**
- Check browser console có lỗi không
- Clear browser cache
- Restart frontend dev server

### Issue 5: Frontend không connect được backend
**Solution:**
1. Check `.env.local`:
```env
NEXT_PUBLIC_HOST_API=http://localhost:2510
```

2. Restart frontend dev server sau khi thay đổi .env:
```bash
# Stop (Ctrl+C)
npm run dev
```

## ✅ Success Checklist

- [ ] Backend chạy tại http://localhost:2510
- [ ] Frontend chạy tại http://localhost:8082
- [ ] CORS đã enable ở backend
- [ ] `.env.local` đã cấu hình đúng
- [ ] Register thành công qua frontend
- [ ] Login thành công qua frontend
- [ ] Token lưu trong sessionStorage
- [ ] Dashboard load được sau login
- [ ] Protected routes hoạt động đúng
- [ ] Logout hoạt động đúng

## 📊 Test Data

Có thể dùng account sau để test (nếu đã register trước đó):

**Admin Account:**
- Email: `admin@corecms.com`
- Password: `Admin@123`

**Test Account:**
- Email: `test@example.com`
- Password: `Test@123`

## 🔍 Debug Tips

### View JWT Token Content
```javascript
// In browser console
const token = sessionStorage.getItem('accessToken');
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log(payload);
```

### Watch Network Requests
1. Open DevTools → Network tab
2. Filter: XHR
3. Login và watch requests
4. Check request/response headers và body

### React DevTools
1. Install React DevTools extension
2. Open Components tab
3. Search for "AuthContext"
4. View current auth state

## 🎯 Next Steps

Sau khi test thành công:

1. **Customize UI**: Update login/register pages theo design của bạn
2. **Add Features**: Implement user profile, settings, etc.
3. **Error Handling**: Add better error messages
4. **Loading States**: Add loading indicators
5. **Validation**: Add form validation
6. **Testing**: Write unit tests
7. **Production Build**: Test production build
