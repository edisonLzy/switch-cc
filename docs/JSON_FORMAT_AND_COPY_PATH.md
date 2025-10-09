# JSON 格式化和配置路径复制功能

## 功能概述

本次更新为 Switch CC 添加了两个实用的 UI 增强功能：

1. **JSON 格式化功能**：在配置 JSON 编辑区域添加格式化按钮
2. **配置路径复制功能**：在 Claude Code 配置信息弹窗中添加复制路径按钮

## 功能详情

### 1. JSON 格式化功能

#### 影响的组件
- `src/components/MainWindow/EditProviderModal.tsx` - 编辑供应商弹窗
- `src/components/MainWindow/AddProviderModal.tsx` - 添加供应商弹窗（自定义配置模式）

#### 实现细节
- 在 "配置 JSON" 标签旁添加了 "格式化" 按钮
- 点击按钮会自动格式化 JSON 内容（2 空格缩进）
- 如果 JSON 格式无效，会显示错误提示："JSON 格式错误，无法格式化"
- 使用 `Wand2` 图标表示格式化操作
- 按钮使用 `ghost` 变体和 `sm` 尺寸，保持 UI 简洁

#### 用户体验
- 用户可以输入压缩的或格式混乱的 JSON
- 点击格式化按钮即可自动整理成易读的格式
- 提高了配置编辑的便利性

### 2. 配置路径复制功能

#### 影响的组件
- `src/components/MainWindow/ClaudeConfigModal.tsx` - Claude Code 配置信息弹窗

#### 实现细节
- 在 "配置路径" 显示区域添加了 "复制" 按钮
- 点击按钮会复制完整的配置文件路径到剪贴板
- 复制成功后，按钮文字和图标会变化：
  - 未复制：显示 `Copy` 图标 + "复制" 文字
  - 已复制：显示 `Check` 图标 + "已复制" 文字
- 2 秒后自动恢复为未复制状态
- 使用状态管理 `pathCopied` 追踪复制状态

#### 用户体验
- 用户可以快速复制配置文件路径
- 便于在终端或文件管理器中定位配置文件
- 视觉反馈清晰，用户知道复制是否成功

## 技术实现

### JSON 格式化逻辑
```typescript
const handleFormatJson = () => {
  try {
    const parsed = JSON.parse(formData.configJson); // 或 customConfig
    const formatted = JSON.stringify(parsed, null, 2);
    setFormData((prev) => ({ ...prev, configJson: formatted }));
    setError("");
  } catch (error) {
    setError("JSON 格式错误，无法格式化");
  }
};
```

### 路径复制逻辑
```typescript
const handleCopyPath = async () => {
  if (configData?.path) {
    try {
      await navigator.clipboard.writeText(configData.path);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch (error) {
      console.error("复制路径失败:", error);
    }
  }
};
```

## UI 变化

### 编辑供应商弹窗
```tsx
<div className="flex items-center justify-between">
  <Label htmlFor="edit-config">配置 JSON *</Label>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={handleFormatJson}
    className="gap-2"
  >
    <Wand2 size={14} />
    格式化
  </Button>
</div>
```

### Claude 配置信息弹窗
```tsx
<div className="space-y-2">
  <span className="text-foreground/70">配置路径：</span>
  <div className="flex items-center gap-2">
    <span className="text-sm font-mono text-foreground/80 flex-1 truncate">
      {configData?.path}
    </span>
    <Button
      onClick={handleCopyPath}
      variant="ghost"
      size="sm"
      className="gap-2 flex-shrink-0"
    >
      {pathCopied ? (
        <>
          <Check size={14} />
          已复制
        </>
      ) : (
        <>
          <Copy size={14} />
          复制
        </>
      )}
    </Button>
  </div>
</div>
```

## 依赖变更

新增图标导入：
- `Wand2` from `lucide-react` - 用于格式化按钮
- `Check` from `lucide-react` - 已复制状态（已存在于 ClaudeConfigModal）

## 测试验证

### 手动测试步骤

#### 测试 JSON 格式化功能
1. 打开编辑供应商弹窗或添加供应商（自定义配置）
2. 在配置 JSON 区域输入压缩的 JSON（如：`{"key":"value","nested":{"data":123}}`）
3. 点击 "格式化" 按钮
4. 验证 JSON 被格式化为易读格式
5. 输入无效 JSON（如：`{invalid}`）
6. 点击 "格式化" 按钮
7. 验证显示错误提示："JSON 格式错误，无法格式化"

#### 测试配置路径复制功能
1. 打开 "Claude Code 配置信息" 弹窗
2. 找到 "配置路径" 行
3. 点击 "复制" 按钮
4. 验证按钮变为 "已复制" 状态（带 Check 图标）
5. 打开文本编辑器，粘贴剪贴板内容
6. 验证粘贴的内容是正确的配置文件路径
7. 等待 2 秒，验证按钮恢复为 "复制" 状态

## 代码质量

- ✅ TypeScript 类型检查通过
- ✅ 无 Linter 错误
- ✅ 构建成功
- ✅ 遵循项目现有代码风格
- ✅ 使用项目现有的 UI 组件

## Git 提交信息

```
feat: 添加 JSON 格式化和配置路径复制功能

- 在 EditProviderModal 添加 JSON 格式化按钮
- 在 AddProviderModal 添加 JSON 格式化按钮
- 在 ClaudeConfigModal 的配置路径旁添加复制按钮
- 添加错误提示以处理无效的 JSON 格式
- 使用 Wand2 图标表示格式化功能
- 使用 Copy/Check 图标表示复制状态
```

## 分支信息

- **分支名称**：`feature/json-format-and-copy-path`
- **基于分支**：`master`
- **提交哈希**：`ec863aa`

## 后续步骤

1. 测试功能是否正常工作
2. 如果需要，可以进一步优化 UI 样式
3. 准备合并到 master 分支
4. 更新 CHANGELOG.md（如果需要）

## 注意事项

- JSON 格式化使用浏览器原生的 `JSON.parse()` 和 `JSON.stringify()`，性能良好
- 路径复制使用 Clipboard API（`navigator.clipboard.writeText()`），需要 HTTPS 或 localhost 环境
- 在 Tauri 应用中，Clipboard API 应该正常工作

