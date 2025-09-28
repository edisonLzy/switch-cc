# Changelog

所有对 Switch CC 项目的重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)，
项目遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [1.0.0] - 2025-01-25

### ✨ Features
- **Claude Code 专属配置管理**：专门为 Claude Code 设计的供应商配置工具
- **双界面模式**：
  - 主界面：完整的供应商管理功能（添加、编辑、删除、切换）
  - MenuBar：简洁的快速切换界面
- **系统托盘集成**：常驻后台，快速访问
- **预设供应商模板**：内置多个常用 Claude API 供应商配置
- **安全配置管理**：原子写入，防止配置损坏
- **跨平台支持**：Windows、macOS、Linux 统一体验

### 🔧 Technical
- 使用 Tauri 2.8 构建，相比 Electron 体积减少 90%
- React 18 + TypeScript 前端，类型安全
- Rust 后端，高性能文件操作
- Tailwind CSS 4 现代化 UI 设计

### 📦 Built With
- **Frontend**: React 18, TypeScript, Tailwind CSS 4, Vite
- **Backend**: Rust, Tauri 2.8
- **Tools**: pnpm, cargo

---

## 预设供应商

项目内置以下 Claude API 供应商配置模板：

- **Claude 官方** - Anthropic 官方 API
- **阿里云百炼** - 国产 Claude API 服务
- **智谱清言** - GLM 系列模型服务
- **OpenRouter** - AI 模型聚合平台
- **Together AI** - 第三方 AI 服务平台

## 开发路线图

- [ ] 配置文件加密存储
- [ ] 更多预设供应商模板
- [ ] 配置导入/导出功能
- [ ] 自动更新检查
- [ ] 多语言支持

## License

MIT © Edison