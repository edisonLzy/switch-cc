# Login Feature Implementation Summary

## UI Changes

### Before Login (Login Form)
```
┌─────────────────────────────────────────────┐
│  ☁️ 配置云同步                          [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  用户名                                      │
│  ┌─────────────────────────────────────┐   │
│  │ [Input: 请输入用户名]               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  密码                                        │
│  ┌─────────────────────────────────────┐   │
│  │ [Input: ••••••••••]                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ℹ️ 状态消息显示区域                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │  [🔐 登录]                           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### After Login (Sync Interface)
```
┌─────────────────────────────────────────────┐
│  ☁️ 配置云同步                          [×]  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  已登录                              │   │
│  │  username123          ID: user_xxx   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 连接状态          🟢 已连接          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │  本地配置         │ │  远程配置         │ │
│  │     5            │ │     3            │ │
│  └──────────────────┘ └──────────────────┘ │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ ✓ 已连接云端，共有 3 个配置          │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐   │
│  │  [☁️ 测试连接]                       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │[↑ 上传]  │ │[↓ 下载]  │ │[⟳ 同步]  │  │
│  └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────┘
```

## Implementation Details

### API Client Changes (`src/lib/config-sync-api.ts`)

**Updated to use Bearer Token Authentication:**
- Added `authToken` private property to store JWT token
- Added `setAuthToken()`, `getAuthToken()`, `clearAuthToken()` methods
- Added `getAuthHeaders()` method to include Authorization header
- Updated `login()` method:
  - Endpoint: `POST /v1/switch-cc/auth/login`
  - Request: `{ username: string, password: string }`
  - Response: `{ token: string, userId?: string }`
  - Automatically stores token after successful login

**API Endpoint Changes:**
- `GET /v1/switch-cc/config/:providerId` (was `/configs/:providerId`)
- `GET /v1/switch-cc/configs` (unchanged)
- `POST /v1/switch-cc/config` (was `/configs`)
- `DELETE /v1/switch-cc/config/:providerId` (was `/configs/:providerId`)

**Method Signature Changes:**
- All methods now use Bearer token from `authToken` property
- Removed `userId` parameters from all methods (userId comes from token)
- Methods: `getConfig(providerId)`, `getAllConfigs()`, `upsertConfig(provider)`, `syncConfigs(providers)`, `deleteConfig(providerId)`, `testConnection()`

### Modal Component Changes (`src/components/MainWindow/ConfigSyncModal.tsx`)

#### New State Variables
```typescript
const [username, setUsername] = useState<string>("");
const [password, setPassword] = useState<string>("");
const [userId, setUserId] = useState<string>("");
const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
```

#### New Status Type
```typescript
type SyncStatus =
  | "idle"
  | "connecting"
  | "uploading"
  | "downloading"
  | "syncing"
  | "success"
  | "error"
  | "logging_in";  // NEW
```

#### Login Handler
```typescript
const handleLogin = async () => {
  // Validates username and password
  // Calls configSyncAPI.login()
  // Sets isLoggedIn and userId on success
  // Auto-tests connection after successful login
}
```

#### UI Rendering Logic
```typescript
{!isLoggedIn ? (
  // Show login form
  <> 
    <Input id="username" ... />
    <Input id="password" type="password" ... />
    <Button onClick={handleLogin}>登录</Button>
  </>
) : (
  // Show sync interface
  <>
    <UserInfoDisplay />
    <ConnectionStatus />
    <ConfigCounts />
    <SyncButtons />
  </>
)}
```

### Security Features
1. Password input field uses `type="password"` for masking
2. Enter key support for quick login
3. **Bearer Token Authentication** - JWT token stored and sent with all API requests
4. Login required before any sync operations
5. Username and userId displayed after login
6. All sync operations check `isLoggedIn` state and require valid token

### User Experience
1. Clear separation between login and sync interfaces
2. Auto-connection test after successful login
3. User info prominently displayed when logged in
4. Loading states for login process
5. Error messages for failed login attempts
6. Token automatically included in all authenticated requests

## Backend API Requirements

The backend uses **Bearer Token Authentication** with `authMiddleware`.

### Authentication Endpoint

**POST /v1/switch-cc/auth/login**

Request body:
```json
{
  "username": "user123",
  "password": "secret123"
}
```

Success response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user_abc123"
}
```

Error response:
```json
{
  "error": "Invalid credentials"
}
```

### All Other Endpoints (Authenticated)

All sync endpoints require `Authorization: Bearer <token>` header:

**GET /v1/switch-cc/config/:providerId**
- Headers: `Authorization: Bearer <token>`
- userId extracted from token by `authMiddleware`

**GET /v1/switch-cc/configs**
- Headers: `Authorization: Bearer <token>`
- Returns all configs for authenticated user

**POST /v1/switch-cc/config**
- Headers: `Authorization: Bearer <token>`
- Body: `{ providerId: string, config: object }`
- userId automatically added from token

**DELETE /v1/switch-cc/config/:providerId**
- Headers: `Authorization: Bearer <token>`
- userId extracted from token by `authMiddleware`

## Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Token stored after successful login
- [ ] Token sent with all authenticated requests
- [ ] Auto-connection after login
- [ ] Password field masking
- [ ] Enter key to submit login
- [ ] Upload requires login and valid token
- [ ] Download requires login and valid token
- [ ] Smart sync requires login and valid token
- [ ] Error message display for unauthorized requests
- [ ] Loading state during login
- [ ] Dark mode compatibility

## Migration Notes

**Breaking Changes:**
- All API methods now require Bearer token authentication
- `userId` parameter removed from all API methods
- API URLs changed from plural to singular (`/configs` → `/config`)
- Login response now returns `token` which must be stored

**For Frontend:**
- Login must return and store JWT token
- All API calls use token from `configSyncAPI.authToken`
- No need to pass userId to API methods anymore
