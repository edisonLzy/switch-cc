# Switch CC 开发指南

## 项目结构

```
switch-cc/
├── src/                      # React 前端代码
│   ├── components/           
│   │   ├── MainWindow/       # 主界面组件
│   │   │   ├── MainWindow.tsx
│   │   │   ├── ProviderList.tsx
│   │   │   ├── AddProviderModal.tsx
│   │   │   ├── EditProviderModal.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── SettingsModal.tsx
│   │   │   └── UpdateBadge.tsx
│   │   └── MenuBar/          # MenuBar 组件
│   │       └── MenuBarWindow.tsx
│   ├── config/               # 配置相关
│   │   └── presets.ts        # 预设供应商配置
│   ├── hooks/                # React Hooks
│   │   └── useDarkMode.ts
│   ├── lib/                  # 库文件
│   │   ├── tauri-api.ts      # Tauri API 封装
│   │   └── styles.ts         # 样式定义
│   ├── utils/                # 工具函数
│   │   └── errorUtils.ts
│   ├── App.tsx               # 根组件
│   ├── main.tsx              # 入口文件
│   ├── types.ts              # 类型定义
│   └── index.css             # 全局样式
├── src-tauri/                # Rust 后端代码
│   ├── src/
│   │   ├── commands.rs       # Tauri 命令
│   │   ├── config.rs         # 配置文件管理
│   │   ├── lib.rs            # 主库文件
│   │   ├── main.rs           # 入口点
│   │   ├── menubar.rs        # MenuBar 逻辑
│   │   ├── provider.rs       # 供应商数据结构
│   │   ├── settings.rs       # 应用设置
│   │   └── store.rs          # 状态管理
│   ├── Cargo.toml            # Rust 依赖配置
│   └── tauri.conf.json       # Tauri 配置
└── package.json              # Node.js 依赖配置
```

## 环境要求

- **Node.js**: 18+
- **pnpm**: 8+
- **Rust**: 1.75+
- **Tauri CLI**: 2.0+

## 快速开始

1. **克隆仓库**
   ```bash
   git clone https://github.com/edisonLzy/switch-cc.git
   cd switch-cc
   ```

2. **安装依赖**
   ```bash
   # 安装前端依赖
   pnpm install
   
   # 安装 Tauri CLI (如果还没有)
   pnpm add -D @tauri-apps/cli
   ```

3. **开发模式**
   ```bash
   pnpm dev
   ```

4. **构建应用**
   ```bash
   pnpm build
   ```

## 开发命令

```bash
# 前端开发
pnpm dev:renderer          # 仅启动前端开发服务器
pnpm build:renderer        # 构建前端

# Tauri 开发
pnpm dev                   # 启动完整的 Tauri 开发环境
pnpm build                 # 构建生产版本

# 代码质量
pnpm typecheck             # TypeScript 类型检查
pnpm format                # 格式化代码
pnpm format:check          # 检查代码格式

# Rust 相关
cd src-tauri
cargo fmt                  # 格式化 Rust 代码
cargo clippy               # Rust 代码检查
cargo test                 # 运行 Rust 测试
```

## 核心功能实现

### 1. 双界面模式

应用支持两种界面模式：

- **主界面模式** (`MainWindow`): 完整的供应商管理界面
- **MenuBar模式** (`MenuBarWindow`): 简洁的快速切换界面

模式切换通过 `AppMode` 枚举实现：

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppMode {
    Main,
    MenuBar,
}
```

### 2. 配置管理

配置文件存储在 `~/.switch-cc/config.json`，包含：

```json
{
  "providers": {},
  "current": "",
  "app_mode": "Main"
}
```

Claude Code 配置写入到 `~/.claude/settings.json`。

### 3. 供应商预设

在 `src/config/presets.ts` 中定义了多个预设供应商模板：

- Claude 官方
- 阿里云百炼
- 智谱清言
- OpenRouter
- Together AI

### 4. 系统托盘集成

使用 Tauri 的 `tray-icon` 功能实现系统托盘，支持：

- 动态菜单生成
- 快速切换供应商
- 显示/隐藏主界面

## API 设计

### Tauri 命令

```rust
// 供应商管理
get_providers() -> HashMap<String, Provider>
add_provider(provider: Provider) -> Result<(), String>
update_provider(provider: Provider) -> Result<(), String>
delete_provider(id: String) -> Result<(), String>
switch_provider(provider_id: String) -> Result<bool, String>

// 应用模式
set_app_mode(mode: AppMode) -> Result<(), String>
get_app_mode() -> Result<String, String>

// 设置管理
get_settings() -> Result<Settings, String>
save_settings(settings: Settings) -> Result<(), String>
```

### 前端 API 封装

```typescript
class TauriAPI {
  async getProviders(): Promise<Record<string, Provider>>
  async switchProvider(id: string): Promise<boolean>
  async setAppMode(mode: AppMode): Promise<void>
  // ... 其他方法
}
```

## 自定义开发

### 添加新的预设供应商

1. 在 `src/config/presets.ts` 中添加新的预设：

```typescript
{
  name: '新供应商',
  category: 'third_party',
  settingsConfig: {
    env: {
      ANTHROPIC_AUTH_TOKEN: 'your-api-key',
      ANTHROPIC_BASE_URL: 'https://api.example.com/v1'
    }
  },
  websiteUrl: 'https://example.com'
}
```

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/commands.rs` 中定义命令：

```rust
#[tauri::command]
pub async fn your_command() -> Result<String, String> {
    Ok("Hello from Rust!".to_string())
}
```

2. 在 `src-tauri/src/lib.rs` 中注册命令：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 其他命令
    commands::your_command,
])
```

3. 在前端 `src/lib/tauri-api.ts` 中添加调用：

```typescript
async yourCommand(): Promise<string> {
  return await invoke('your_command');
}
```

### 自定义 UI 组件

使用项目中定义的样式系统：

```typescript
import { buttonStyles, cardStyles, modalStyles } from '../lib/styles';

// 使用预定义样式
<button className={buttonStyles.primary}>
  按钮
</button>
```

## 构建和发布

### 开发构建

```bash
pnpm build
```

构建产物在 `src-tauri/target/release/` 目录下。

### 生产构建

```bash
# 优化构建
pnpm tauri build --release
```

### 平台特定构建

```bash
# Windows
pnpm tauri build --target x86_64-pc-windows-msvc

# macOS
pnpm tauri build --target x86_64-apple-darwin
pnpm tauri build --target aarch64-apple-darwin

# Linux
pnpm tauri build --target x86_64-unknown-linux-gnu
```

## 调试技巧

### 前端调试

1. 使用浏览器开发工具
2. React DevTools 支持
3. TypeScript 类型检查

### 后端调试

1. 使用 `log::info!()` 等宏输出日志
2. `RUST_LOG=debug pnpm dev` 查看详细日志
3. 使用 `cargo test` 运行单元测试

### 系统集成调试

1. 检查配置文件路径和权限
2. 验证 Claude Code 配置格式
3. 测试托盘菜单功能

## 贡献指南

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License - 查看 [LICENSE](LICENSE) 文件了解详情。