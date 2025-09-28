# Switch CC

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/edisonLzy/switch-cc/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/edisonLzy/switch-cc/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)

一个专注于 Claude Code 配置管理和快速切换的桌面应用，提供主界面和 MenuBar 两种使用方式。

## 功能特性

- **Claude Code 专属**：专门为 Claude Code 设计的配置管理工具
- **双界面模式**：
  - 主界面：完整的供应商管理功能
  - MenuBar：简洁的快速切换界面
- **系统集成**：menubar 常驻，一键切换配置
- **配置管理**：安全的配置文件管理，支持备份和恢复
- **跨平台支持**：Windows、macOS、Linux 统一体验

## 界面预览

### 主界面
完整的供应商管理界面，支持添加、编辑、删除供应商配置。

### MenuBar 界面
简洁的下拉菜单界面，快速切换当前使用的供应商。

## 下载安装

### 系统要求

- **Windows**: Windows 10 及以上
- **macOS**: macOS 10.15 (Catalina) 及以上
- **Linux**: Ubuntu 20.04+ / Debian 11+ / Fedora 34+ 等主流发行版

### 安装方式

从 [Releases](../../releases) 页面下载对应平台的安装包。

## 使用说明

### 主界面使用
1. 点击"添加供应商"添加 Claude API 配置
2. 在供应商列表中选择要切换的配置
3. 点击"切换"按钮应用配置
4. 重启 Claude Code 终端以生效

### MenuBar 使用
1. 应用启动后会在系统 menubar 显示图标
2. 点击图标打开快速切换菜单
3. 直接选择要切换的供应商
4. 配置立即生效，重启终端即可使用

## 技术栈

- **[Tauri 2](https://tauri.app/)** - 跨平台桌面应用框架
- **[React 18](https://react.dev/)** - 用户界面库
- **[TypeScript](https://www.typescriptlang.org/)** - 类型安全的 JavaScript
- **[Vite](https://vitejs.dev/)** - 极速的前端构建工具
- **[Rust](https://www.rust-lang.org/)** - 系统级编程语言（后端）

## 开发

### 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.75+
- Tauri CLI 2.0+

### 开发命令

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 类型检查
pnpm typecheck

# 代码格式化
pnpm format

# 构建应用
pnpm build
```

## 项目结构

```
├── src/                   # 前端代码 (React + TypeScript)
│   ├── components/       # React 组件
│   │   ├── MainWindow/   # 主界面组件
│   │   └── MenuBar/      # MenuBar 组件
│   ├── config/          # 预设供应商配置
│   ├── lib/             # Tauri API 封装
│   └── utils/           # 工具函数
├── src-tauri/            # 后端代码 (Rust)
│   ├── src/             # Rust 源代码
│   │   ├── commands.rs  # Tauri 命令定义
│   │   ├── config.rs    # 配置文件管理
│   │   └── menubar.rs   # MenuBar 逻辑
│   └── capabilities/    # 权限配置
└── screenshots/          # 界面截图
```

## License

MIT © Edison