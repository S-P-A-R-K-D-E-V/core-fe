# Frontend Integration với Core CMS Backend

## ✅ Đã hoàn thành

### 1. Cấu hình API Endpoint
- ✅ Tạo `.env.local` với `NEXT_PUBLIC_HOST_API=http://localhost:2510`
- ✅ Cập nhật `axios.ts` với endpoints cho backend API

### 2. Type Definitions
- ✅ Tạo `src/types/corecms-api.ts` với các interfaces:
  - `IUser` - User model
  - `IAuthResponse` - Response từ register/login
  - `ILoginRequest`, `IRegisterRequest` - Request types
  - `IUpdateUserRequest` - Update user request
  - `IRefreshTokenRequest`, `ILogoutRequest` - Auth requests

### 3. Authentication Integration
- ✅ Cập nhật `src/auth/context/jwt/utils.ts`:
  - Thêm refresh token storage
  - Auto refresh token khi expired
  - Error handling

- ✅ Cập nhật `src/auth/context/jwt/auth-provider.tsx`:
  - Tích hợp với backend API thực
  - Parse JWT token để lấy user info
  - Lưu refresh token
  - Call logout endpoint khi đăng xuất

### 4. API Services
- ✅ Tạo `src/api/users.ts` với các functions:
  - `getAllUsers()` - Lấy danh sách users
  - `getUserById(id)` - Lấy user theo ID
  - `updateUser(id, data)` - Cập nhật user
  - `deleteUser(id)` - Xóa user

## 🚀 Cách sử dụng

### 1. Start Backend API
```bash
cd G:\spark\github\Core\Core-be\CoreCms
dotnet run --project CoreCms.Api
```
Backend chạy tại: `http://localhost:2510`

### 2. Install Dependencies & Start Frontend
```bash
cd G:\spark\github\Core\core-fe

# Install dependencies
npm install
# or
yarn install

# Start development server
npm run dev
# or
yarn dev
```

Frontend chạy tại: `http://localhost:8082`

## 📝 Sử dụng Authentication trong Components

### Login Example
```tsx
import { useAuthContext } from 'src/auth/hooks';

export default function LoginPage() {
  const { login } = useAuthContext();

  const handleLogin = async () => {
    try {
      await login('admin@corecms.com', 'Admin@123');
      // Redirect to dashboard
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return <button onClick={handleLogin}>Login</button>;
}
```

### Register Example
```tsx
import { useAuthContext } from 'src/auth/hooks';

export default function RegisterPage() {
  const { register } = useAuthContext();

  const handleRegister = async () => {
    try {
      await register('user@example.com', 'Password123!', 'John', 'Doe');
      // Redirect to dashboard
    } catch (error) {
      console.error('Register failed:', error);
    }
  };

  return <button onClick={handleRegister}>Register</button>;
}
```

### Logout Example
```tsx
import { useAuthContext } from 'src/auth/hooks';

export default function LogoutButton() {
  const { logout } = useAuthContext();

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login page
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return <button onClick={handleLogout}>Logout</button>;
}
```

### Get Current User
```tsx
import { useAuthContext } from 'src/auth/hooks';

export default function Profile() {
  const { user, authenticated } = useAuthContext();

  if (!authenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.displayName}</h1>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
    </div>
  );
}
```

## 🔐 Protected Routes

Routes đã được protected bởi `AuthGuard`:
```tsx
// app/dashboard/layout.tsx
import { AuthGuard } from 'src/auth/guard';

export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  );
}
```

## 📊 User Management Example

```tsx
import { getAllUsers, updateUser, deleteUser } from 'src/api/users';

export default function UserManagement() {
  const [users, setUsers] = useState<IUser[]>([]);

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getAllUsers();
        setUsers(data);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    
    loadUsers();
  }, []);

  // Update user
  const handleUpdate = async (userId: string) => {
    try {
      await updateUser(userId, {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+84123456789',
        profileImageUrl: 'https://example.com/avatar.jpg',
      });
      // Reload users
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  // Delete user
  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      // Reload users
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  return (
    <div>
      {users.map((user) => (
        <div key={user.id}>
          <h3>{user.firstName} {user.lastName}</h3>
          <button onClick={() => handleUpdate(user.id)}>Update</button>
          <button onClick={() => handleDelete(user.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

## 🔄 Auto Refresh Token

Token sẽ tự động refresh khi sắp hết hạn. Nếu refresh thất bại, user sẽ được redirect về login page.

Cơ chế hoạt động:
1. JWT token có expiration time (default 24h)
2. Refresh token có expiration 7 ngày
3. Khi JWT token sắp hết hạn, system tự động call `/auth/refresh-token`
4. Backend trả về JWT mới và refresh token mới
5. Frontend lưu tokens mới và tiếp tục session

## ⚠️ Lưu ý

### CORS Configuration
Backend cần enable CORS cho frontend:

```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:8082")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// ...

app.UseCors("AllowFrontend");
```

### Environment Variables
Đảm bảo `.env.local` có cấu hình đúng:
```env
NEXT_PUBLIC_HOST_API=http://localhost:2510
```

### Token Storage
- Access Token: Stored in `sessionStorage` (key: `accessToken`)
- Refresh Token: Stored in `sessionStorage` (key: `refreshToken`)

Tokens sẽ mất khi đóng browser. Nếu muốn "Remember Me", có thể chuyển sang `localStorage`.

## 🧪 Testing

### 1. Test Login
1. Navigate to `/auth/jwt/login`
2. Enter credentials: `admin@corecms.com` / `Admin@123`
3. Click Login
4. Should redirect to `/dashboard`

### 2. Test Register
1. Navigate to `/auth/jwt/register`
2. Fill in the form
3. Click Register
4. Should redirect to `/dashboard`

### 3. Test Logout
1. Click on profile menu
2. Click Logout
3. Should redirect to `/auth/jwt/login`

### 4. Test Protected Routes
1. Logout
2. Try to access `/dashboard` directly
3. Should redirect to `/auth/jwt/login`

## 📈 Next Steps

- [ ] Thêm password strength validation
- [ ] Thêm email validation
- [ ] Thêm forgot password flow
- [ ] Thêm email confirmation flow
- [ ] Thêm role-based access control
- [ ] Thêm user profile edit page
- [ ] Thêm user avatar upload
- [ ] Thêm user management dashboard
- [ ] Thêm activity logs
- [ ] Thêm settings page

## 🐛 Troubleshooting

### 401 Unauthorized
- Token hết hạn → Sẽ auto refresh
- Token invalid → Logout và login lại

### CORS Error
- Kiểm tra CORS config trong backend
- Kiểm tra URL trong `.env.local`

### Connection Refused
- Kiểm tra backend đang chạy tại port 2510
- Kiểm tra firewall settings

### Token không lưu
- Kiểm tra browser console
- Kiểm tra sessionStorage
- Clear cache và thử lại
