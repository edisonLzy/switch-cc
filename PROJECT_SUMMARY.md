# Switch CC 项目总结

## 🎯 项目概述

**Switch CC** 是一个专为 Claude Code 设计的配置管理工具，基于原始的 cc-switch 项目进行了定制化改造。该项目专注于 Claude Code 的供应商切换，移除了 Codex 相关功能，并新增了 MenuBar 快捷操作模式。

## 🏗️ 核心特性

### ✅ 已实现功能

1. **Claude Code 专属配置管理**
   - 专门管理 `~/.claude/settings.json` 配置文件
   - 支持多个 Claude API 供应商配置
   - 安全的原子写入，防止配置损坏

2. **双界面模式**
   - **主界面**：完整的供应商管理功能（添加、编辑、删除、切换）
   - **MenuBar**：简洁的快速切换界面，常驻系统菜单栏

3. **系统集成**
   - 系统托盘/菜单栏图标
   - 动态托盘菜单，支持快速切换
   - 跨平台支持（Windows、macOS、Linux）

4. **预设供应商模板**
   - Claude 官方
   - 阿里云百炼
   - 智谱清言  
   - OpenRouter
   - Together AI

5. **用户体验优化**
   - 暗色主题支持
   - 响应式界面设计
   - 友好的错误处理和用户反馈

### 🔧 技术架构

- **前端**: React 18 + TypeScript + Tailwind CSS 4
- **后端**: Rust + Tauri 2.8
- **构建工具**: Vite + pnpm
- **包大小**: ~15MB（相比 Electron 版本减少 90%）

## 📁 项目结构

```
switch-cc/
├── src/                    # React 前端
│   ├── components/
│   │   ├── MainWindow/     # 主界面组件
│   │   └── MenuBar/        # MenuBar 组件
│   ├── config/             # 配置和预设
│   ├── hooks/              # React Hooks
│   ├── lib/                # API 封装和样式
│   └── utils/              # 工具函数
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands.rs     # Tauri 命令
│   │   ├── config.rs       # 配置文件管理
│   │   ├── lib.rs          # 主入口
│   │   ├── menubar.rs      # MenuBar 逻辑
│   │   ├── provider.rs     # 供应商数据结构
│   │   ├── settings.rs     # 应用设置
│   │   └── store.rs        # 状态管理
│   └── tauri.conf.json     # Tauri 配置
└── 配置文件...
```

## 🎨 界面设计

### 主界面
- 供应商列表展示
- 添加/编辑/删除供应商
- 配置预览和验证
- 设置面板

### MenuBar 界面
- 紧凑的供应商列表
- 当前供应商状态显示
- 一键切换功能
- 快速访问主界面

## 🔄 与原项目的差异

### 移除的功能
1. **Codex 支持** - 专注于 Claude Code，简化项目复杂度
2. **VS Code 集成** - 移除 VS Code 设置同步功能
3. **多应用切换** - 不再需要应用类型选择器

### 新增的功能
1. **MenuBar 模式** - 全新的简洁切换界面
2. **模式切换** - 主界面和 MenuBar 间的无缝切换
3. **优化的托盘菜单** - 更好的用户体验

### 改进的功能
1. **简化的配置流程** - 专注于 Claude 配置
2. **更好的预设模板** - 针对 Claude API 优化
3. **增强的错误处理** - 更友好的用户反馈

## 🚀 开发环境设置

### 环境要求
- Node.js 18+
- pnpm 8+  
- Rust 1.75+
- Tauri CLI 2.0+

### 快速开始
```bash
# 1. 安装依赖
pnpm install

# 2. 开发模式
pnpm dev

# 3. 构建应用
pnpm build
```

### 开发命令
```bash
pnpm dev                 # 启动开发环境
pnpm build              # 构建生产版本
pnpm typecheck          # TypeScript 检查
pnpm format             # 代码格式化
```

## 📦 部署和分发

### 构建产物
- **Windows**: `.exe` 安装程序和便携版
- **macOS**: `.dmg` 磁盘映像和 `.app` 应用包
- **Linux**: `.deb`、`.rpm` 包和 `AppImage`

### 发布流程
1. 更新版本号
2. 运行 `pnpm build`
3. 测试构建产物
4. 创建 GitHub Release
5. 上传平台特定的安装包

## 🎯 使用场景

### 适用用户
- Claude Code 用户
- 需要频繁切换 API 供应商的开发者
- 使用多个 Claude API 服务的团队

### 典型工作流
1. 添加多个 Claude API 供应商配置
2. 根据需要切换供应商（通过主界面或 MenuBar）
3. 重启 Claude Code 终端使配置生效
4. 通过托盘菜单快速切换

## 🔮 未来规划

### 近期目标
- [ ] 配置文件加密存储
- [ ] 配置导入/导出功能  
- [ ] 自动更新检查
- [ ] 更多预设供应商模板

### 长期目标
- [ ] 插件系统支持
- [ ] 多语言界面
- [ ] 云端配置同步
- [ ] API 使用统计

## 🤝 贡献方式

1. **报告问题**: 在 GitHub Issues 中提交 bug 报告
2. **功能建议**: 提出新功能的想法和建议
3. **代码贡献**: Fork 项目，提交 Pull Request
4. **文档改进**: 改善项目文档和使用指南

## 📄 许可证

MIT License - 允许商用、修改和分发

## 🙏 致谢

- 原始 cc-switch 项目提供的灵感和基础架构
- Tauri 团队提供的优秀跨平台框架
- React 和 Rust 社区的技术支持

---

**项目地址**: https://github.com/edisonLzy/switch-cc  
**文档**: 查看项目 Wiki 获取详细使用说明  
**支持**: 通过 GitHub Issues 获取帮助