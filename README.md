# Switch CC

<div align="center">

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/edisonLzy/switch-cc/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](https://github.com/edisonLzy/switch-cc/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**一个专为 Claude Code 打造的智能配置管理工具**

优雅地管理多个 API 供应商，一键切换不同配置，让你的 Claude Code 使用体验更加流畅。

[下载安装](#下载安装) • [功能特性](#功能特性) • [使用指南](#使用说明) • [开发文档](#开发)

</div>

---

## ✨ 项目简介

**Switch CC** 是一个轻量级的桌面应用程序，专门为 [Claude Code](https://claude.ai/code) 用户设计，用于管理和快速切换不同的 API 供应商配置。

### 🎯 解决什么问题？

使用 Claude Code 时，你可能需要在不同的 API 供应商之间切换：
- 🌍 **官方 API** vs **中国区代理服务**
- 💰 **不同的付费计划**和配额管理
- 🔄 **开发环境** vs **生产环境**配置
- 🏢 **个人账号** vs **团队账号**

传统方式需要手动编辑 `~/.claude/settings.json` 文件，容易出错且效率低下。Switch CC 提供了一个可视化的解决方案，让配置切换变得简单、安全、快速。

### 💡 核心价值

- ✅ **零学习成本** - 直观的图形界面，无需记忆复杂的配置格式
- ⚡ **极速切换** - 通过系统托盘一键切换，无需打开完整界面
- 🔒 **安全可靠** - 原子化文件操作，避免配置损坏
- 🎨 **优雅体验** - 现代化 UI 设计，支持深色模式
- 🔄 **智能合并** - 保留你的自定义配置，只更新必要的字段

---

## 🚀 功能特性

### 🖥️ 双界面模式

<table>
<tr>
<td width="50%">

#### 主窗口模式
- ➕ 添加/编辑/删除供应商配置
- 📋 管理多个 API 提供商
- ⚙️ 自定义配置参数
- 📖 查看当前 Claude 配置
- 🔍 预设供应商模板

</td>
<td width="50%">

#### MenuBar 模式
- 🎯 系统托盘常驻
- ⚡ 快速切换供应商
- 📊 显示当前激活配置
- 🎨 简洁的下拉菜单
- ⌨️ 支持键盘快捷键

</td>
</tr>
</table>

### 📦 预设供应商模板

内置多个主流 API 供应商模板，开箱即用：

- 🌟 **Claude Official** - Anthropic 官方 API
- 🇨🇳 **阿里云百炼** - 阿里巴巴通义千问兼容接口
- 🤖 **智谱 AI** - GLM 系列模型接口
- 🔀 **OpenRouter** - 多模型聚合服务
- 🚀 **Together AI** - 高性能推理平台

### 🔧 高级特性

- 🔄 **智能配置合并** - 只覆盖必要字段，保留用户自定义设置
- 📝 **JSON 配置编辑器** - 支持高级用户直接编辑完整配置
- 🎨 **主题切换** - 亮色/暗色模式自动适配系统
- 💾 **配置导入导出** - 备份和迁移配置更简单
- 🔍 **配置预览** - 切换前查看完整的配置内容
- 🔔 **切换提醒** - 操作反馈清晰，避免误操作

---

## 📥 下载安装

### 系统要求

| 平台 | 最低版本 | 推荐配置 |
|------|----------|---------|
| 🍎 **macOS** | macOS 10.15 (Catalina) | macOS 12+ (Apple Silicon 原生支持) |
| 🪟 **Windows** | Windows 10 | Windows 11 x64 |
| 🐧 **Linux** | Ubuntu 20.04+ | Ubuntu 22.04+ / Fedora 38+ |

### 📦 下载说明

前往 [**Releases**](https://github.com/edisonLzy/switch-cc/releases) 页面下载最新版本：

#### macOS
```bash
# 下载 .dmg 文件
Switch_CC_1.0.1_universal.dmg

# 安装步骤
1. 双击挂载磁盘镜像
2. 拖拽 Switch CC 到 Applications 文件夹
3. 首次运行：右键点击 -> "打开" (绕过 Gatekeeper 安全检查)
```

**注意**：应用使用 ad-hoc 签名，首次运行需要右键"打开"确认。

#### Windows
```bash
# 下载 .exe 安装程序
Switch_CC_1.0.1_x64_setup.exe

# 安装步骤
1. 双击安装程序
2. 按照向导完成安装
3. 从开始菜单或桌面快捷方式启动
```

#### Linux
```bash
# AppImage (推荐 - 无需安装)
chmod +x Switch_CC_1.0.1_amd64.AppImage
./Switch_CC_1.0.1_amd64.AppImage

# Debian/Ubuntu (.deb)
sudo dpkg -i switch-cc_1.0.1_amd64.deb
sudo apt-get install -f  # 修复依赖

# 启动应用
switch-cc
```

### 🔄 自动更新机制

- ✅ 每次代码合并到 master 自动构建新版本
- ✅ 语义化版本管理（fix: patch, feat: minor, BREAKING: major）
- ✅ Release 页面总是提供最新稳定版
- ✅ 支持多平台同步发布

---

## 📖 使用说明

### 🎬 快速开始

#### 1️⃣ 首次运行

启动 Switch CC 后，应用会：
1. 检查 `~/.claude/settings.json` 是否存在
2. 如果存在，自动导入为默认配置
3. 如果不存在，引导你创建第一个配置

#### 2️⃣ 添加供应商

**方式 A：使用预设模板**（推荐）
1. 点击"添加供应商"按钮
2. 从预设模板中选择一个供应商
3. 输入你的 API Key（可选）
4. 点击"添加"

**方式 B：自定义配置**
1. 点击"添加供应商"→"自定义配置"
2. 输入供应商名称
3. 编辑 JSON 配置
4. 保存

#### 3️⃣ 切换配置

**主窗口切换：**
- 在供应商列表中点击"切换"按钮
- 等待成功提示
- 重启 Claude Code 终端

**MenuBar 快速切换：**
- 点击系统托盘图标
- 选择要切换的供应商
- 当前激活的配置会显示 ✓ 标记

#### 4️⃣ 配置生效

切换配置后，需要**重启 Claude Code 终端**使新配置生效：

```bash
# 关闭当前 Claude Code 终端
# 然后重新打开，新配置即生效
```

### 💡 使用技巧

#### 📝 配置最佳实践

1. **命名规范**
   ```
   ✅ 好的命名：Claude Official (个人)
   ✅ 好的命名：百炼-开发环境
   ❌ 差的命名：配置1
   ```

2. **配置组织**
   - 按用途分组：个人/工作/测试
   - 按供应商分类：官方/代理/自建
   - 标注额度信息：GPT-4 月度配额

3. **安全建议**
   - ⚠️ API Key 存储在本地配置文件中
   - 🔒 定期轮换 API 密钥
   - 🚫 不要在公共设备上使用

#### 🎯 常见使用场景

**场景 1：个人 + 公司账号切换**
```
配置 A: Claude Official (个人) - 个人项目使用
配置 B: Claude Official (公司) - 工作项目使用
```

**场景 2：国内网络环境**
```
配置 A: 阿里云百炼 - 国内稳定访问
配置 B: Claude Official - 海外网络环境
```

**场景 3：配额管理**
```
配置 A: 主账号 (高配额)
配置 B: 备用账号 (应急使用)
```

### 🔧 高级功能

#### 查看当前 Claude 配置

点击顶部的"👁️ 眼睛"图标，可以查看当前 `~/.claude/settings.json` 的完整内容。

#### 自定义配置

对于高级用户，可以直接编辑 JSON 配置：

```json
{
  "api": "anthropic",
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  },
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 8192
}
```

#### 配置文件位置

- **应用配置**：
  - macOS: `~/Library/Application Support/switch-cc/config.json`
  - Windows: `%APPDATA%\switch-cc\config.json`
  - Linux: `~/.config/switch-cc/config.json`

- **Claude 配置**：`~/.claude/settings.json`

---

## 🛠️ 开发

### 环境要求

确保你的开发环境满足以下要求：

| 工具 | 版本 | 安装方式 |
|------|------|---------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 8+ | `npm install -g pnpm` |
| **Rust** | 1.80+ | [rustup.rs](https://rustup.rs/) |
| **Tauri CLI** | 2.0+ | 自动安装（通过 pnpm） |

### 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/edisonLzy/switch-cc.git
cd switch-cc

# 2. 安装依赖（使用 pnpm）
pnpm install

# 3. 启动开发服务器（支持热重载）
pnpm dev

# 4. 构建生产版本
pnpm build
```

### 开发命令

```bash
# 前端开发
pnpm dev:renderer          # 仅启动前端开发服务器
pnpm build:renderer        # 构建前端

# 完整应用
pnpm dev                   # Tauri 开发模式（前端 + 后端）
pnpm build                 # 构建完整应用

# 代码质量
pnpm typecheck             # TypeScript 类型检查
pnpm format                # Prettier 代码格式化
pnpm format:check          # 检查代码格式

# Rust 后端（在 src-tauri/ 目录下）
cd src-tauri
cargo fmt                  # Rust 代码格式化
cargo clippy              # Rust 代码检查
cargo test                # 运行 Rust 测试
```

### 项目结构

```
switch-cc/
├── src/                          # 前端代码（React + TypeScript）
│   ├── components/               # React 组件
│   │   ├── MainWindow/           # 主窗口组件
│   │   │   ├── MainWindow.tsx    # 主界面容器
│   │   │   ├── ProviderList.tsx  # 供应商列表
│   │   │   ├── AddProviderModal.tsx  # 添加供应商弹窗
│   │   │   └── EditProviderModal.tsx # 编辑供应商弹窗
│   │   ├── MenuBar/              # MenuBar 组件
│   │   │   └── MenuBarWindow.tsx # MenuBar 窗口
│   │   └── ui/                   # UI 组件库
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       └── ...
│   ├── config/                   # 配置
│   │   └── presets.ts            # 预设供应商模板
│   ├── lib/                      # 库函数
│   │   ├── tauri-api.ts          # Tauri API 封装
│   │   └── utils.ts              # 工具函数
│   ├── hooks/                    # React Hooks
│   │   └── useDarkMode.ts        # 深色模式
│   ├── utils/                    # 工具函数
│   │   └── errorUtils.ts         # 错误处理
│   ├── types.ts                  # TypeScript 类型定义
│   ├── App.tsx                   # 根组件
│   └── main.tsx                  # 入口文件
│
├── src-tauri/                    # 后端代码（Rust）
│   ├── src/                      # Rust 源代码
│   │   ├── main.rs               # 程序入口
│   │   ├── lib.rs                # 库入口，托盘菜单
│   │   ├── commands.rs           # Tauri 命令（供前端调用）
│   │   ├── config.rs             # 配置文件管理
│   │   ├── provider.rs           # 供应商数据结构
│   │   ├── settings.rs           # 应用设置
│   │   ├── store.rs              # 应用状态管理
│   │   └── menubar.rs            # MenuBar 窗口管理
│   ├── capabilities/             # Tauri 权限配置
│   │   └── default.json          # 默认权限
│   ├── icons/                    # 应用图标
│   ├── tauri.conf.json           # Tauri 配置文件
│   └── Cargo.toml                # Rust 依赖配置
│
├── docs/                         # 文档
│   ├── GITHUB_RULESETS_BYPASS.md # GitHub Rulesets 配置指南
│   └── ...
│
├── .github/                      # GitHub 配置
│   └── workflows/                # GitHub Actions
│       └── release.yml           # 自动发布工作流
│
├── package.json                  # Node.js 依赖配置
├── pnpm-lock.yaml                # pnpm 锁文件
├── tsconfig.json                 # TypeScript 配置
├── vite.config.mts               # Vite 配置
├── tailwind.config.js            # Tailwind CSS 配置
├── CLAUDE.md                     # Claude Code 指南
└── README.md                     # 项目说明
```

### 技术栈

#### 前端
- ⚛️ **React 18** - 用户界面库
- 📘 **TypeScript** - 类型安全的 JavaScript 超集
- ⚡ **Vite** - 下一代前端构建工具
- 🎨 **Tailwind CSS 4** - 实用优先的 CSS 框架
- 🎯 **Radix UI** - 无样式的高质量 UI 组件

#### 后端
- 🦀 **Rust** - 系统级编程语言，内存安全
- 🖼️ **Tauri 2.8** - 跨平台桌面应用框架
- 🔧 **serde** - Rust 序列化/反序列化框架
- 📁 **dirs** - 跨平台目录路径获取

#### 工具链
- 📦 **pnpm** - 快速、节省磁盘空间的包管理器
- 🎨 **Prettier** - 代码格式化工具
- ✅ **Clippy** - Rust 代码检查工具

### 架构说明

Switch CC 采用 **Tauri 2.x 架构**，前后端分离：

```
┌─────────────────────────────────────────┐
│          Frontend (React)               │
│  ┌───────────────────────────────────┐  │
│  │  MainWindow  │  MenuBarWindow    │  │
│  └───────────────────────────────────┘  │
│               │ Tauri API                │
└───────────────┼─────────────────────────┘
                │
┌───────────────┼─────────────────────────┐
│               ▼                          │
│          Backend (Rust)                  │
│  ┌───────────────────────────────────┐  │
│  │  Commands  │  Config  │  Store   │  │
│  └───────────────────────────────────┘  │
│               │                          │
│               ▼                          │
│      ~/.claude/settings.json             │
└─────────────────────────────────────────┘
```

**核心设计原则：**
- 🔒 **原子化文件操作** - 避免配置文件损坏
- 🔄 **智能合并策略** - 保留用户自定义设置
- ⚡ **事件驱动通信** - 前后端解耦
- 🎯 **单一状态源** - AppState 统一管理

### 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. **Fork 项目**
2. **创建特性分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'feat: add some amazing feature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **创建 Pull Request**

**提交信息规范**（遵循 [Conventional Commits](https://www.conventionalcommits.org/)）：
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链更新
```

---

## 🐛 问题反馈

遇到问题？请通过以下方式反馈：

- 🐞 [提交 Issue](https://github.com/edisonLzy/switch-cc/issues/new)
- 💬 [讨论区](https://github.com/edisonLzy/switch-cc/discussions)

**提交 Issue 前请确保：**
- ✅ 使用最新版本
- ✅ 搜索过已有 Issue
- ✅ 提供系统信息和错误日志
- ✅ 描述复现步骤

---

## 📋 常见问题

<details>
<summary><strong>Q: 切换配置后 Claude Code 没有生效？</strong></summary>

A: 需要重启 Claude Code 终端窗口才能加载新配置。关闭当前终端，重新打开即可。
</details>

<details>
<summary><strong>Q: macOS 提示"应用已损坏"怎么办？</strong></summary>

A: 这是因为应用使用了 ad-hoc 签名。解决方法：
1. 在 Finder 中找到应用
2. **右键点击** → 选择"打开"
3. 在安全警告中点击"打开"
4. 首次成功运行后，后续可正常双击启动
</details>

<details>
<summary><strong>Q: 支持哪些 API 供应商？</strong></summary>

A: 理论上支持所有兼容 Anthropic API 格式的供应商。内置了常用的预设模板，你也可以自定义配置。
</details>

<details>
<summary><strong>Q: 配置文件存储在哪里？</strong></summary>

A: 
- 应用配置：平台特定的应用数据目录（见"使用说明"章节）
- Claude 配置：`~/.claude/settings.json`
</details>

<details>
<summary><strong>Q: 如何备份我的配置？</strong></summary>

A: 复制应用配置文件即可：
```bash
# macOS
cp -r ~/Library/Application\ Support/switch-cc ~/backup/

# Linux
cp -r ~/.config/switch-cc ~/backup/
```
</details>

---

## 🗺️ 开发路线图

- [x] ✅ 基础配置管理功能
- [x] ✅ 系统托盘集成
- [x] ✅ 预设供应商模板
- [x] ✅ 深色模式支持
- [x] ✅ 跨平台构建和发布
- [ ] 🚧 配置导入/导出功能
- [ ] 🚧 配置备份和恢复
- [ ] 📅 多语言支持（英文）
- [ ] 📅 键盘快捷键
- [ ] 📅 应用内更新检查
- [ ] 💡 配置模板市场

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 🙏 致谢

感谢以下优秀的开源项目：

- [Tauri](https://tauri.app/) - 强大的跨平台应用框架
- [React](https://react.dev/) - 优秀的 UI 库
- [Rust](https://www.rust-lang.org/) - 安全高效的系统编程语言
- [Vite](https://vitejs.dev/) - 极速的构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 实用的 CSS 框架
- [Radix UI](https://www.radix-ui.com/) - 高质量的 UI 组件

---

## 👨‍💻 作者

**Edison** - [@edisonLzy](https://github.com/edisonLzy)

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by Edison

</div>
