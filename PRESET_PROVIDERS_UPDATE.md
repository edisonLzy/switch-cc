# 预设供应商更新

本文档记录了预设供应商配置的更改。

## 更改内容

### 移除的预设供应商

以下供应商已从预设列表中移除：
- ❌ **Claude 官方** - 移除
- ❌ **阿里云百炼** - 移除  
- ❌ **OpenRouter** - 移除
- ❌ **Together AI** - 移除

### 保留的预设供应商

- ✅ **智谱清言** - 保留并完善配置

### 新增的预设供应商

- ➕ **AnyRouter** - 新增聚合平台供应商
- ➕ **PackyCode** - 新增第三方供应商

## 完整的新预设配置

```typescript
export const presetProviders: Omit<Provider, 'id' | 'createdAt'>[] = [
  {
    name: '智谱清言',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-api-key',
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4'
      }
    },
    websiteUrl: 'https://open.bigmodel.cn',
    category: 'cn_official'
  },
  {
    name: 'AnyRouter',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-anyrouter-api-key',
        ANTHROPIC_BASE_URL: 'https://api.anyrouter.ai/v1'
      }
    },
    websiteUrl: 'https://anyrouter.ai',
    category: 'aggregator'
  },
  {
    name: 'PackyCode',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-packycode-api-key', 
        ANTHROPIC_BASE_URL: 'https://api.packycode.com/v1'
      }
    },
    websiteUrl: 'https://packycode.com',
    category: 'third_party'
  }
];
```

## 供应商详细信息

### 1. 智谱清言
- **类型**: 国产官方 (`cn_official`)
- **API端点**: `https://open.bigmodel.cn/api/paas/v4`
- **官网**: https://open.bigmodel.cn
- **说明**: 智谱AI推出的大语言模型服务

### 2. AnyRouter
- **类型**: 聚合平台 (`aggregator`)  
- **API端点**: `https://api.anyrouter.ai/v1`
- **官网**: https://anyrouter.ai
- **说明**: 多模型API聚合服务平台

### 3. PackyCode  
- **类型**: 第三方 (`third_party`)
- **API端点**: `https://api.packycode.com/v1`
- **官网**: https://packycode.com
- **说明**: 面向开发者的AI代码助手服务

## 技术更改

### 类型定义增强

在 `src/types.ts` 中添加了供应商分类类型：

```typescript
export type ProviderCategory = 'official' | 'cn_official' | 'aggregator' | 'third_party' | 'custom';

export interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>;
  websiteUrl?: string;
  category?: ProviderCategory;  // 新增字段
  createdAt?: number;
}
```

### 修改文件列表

1. **`src/config/presets.ts`** - 更新预设供应商配置
2. **`src/types.ts`** - 添加ProviderCategory类型和category字段

## 用户体验改进

### 分类标识
每个预设供应商都有明确的分类标识：
- 🏢 **国产官方** - 智谱清言
- 🔗 **聚合平台** - AnyRouter  
- 🛠️ **第三方** - PackyCode

### 配置模板
每个供应商都提供了标准的配置模板：
- 包含正确的API端点
- 提供API密钥占位符
- 附带官方网站链接

## 使用说明

1. **添加供应商时**：用户可从3个预设中选择
2. **配置步骤**：
   - 选择预设供应商
   - 输入对应的API密钥
   - 点击添加即可使用

3. **API密钥获取**：
   - **智谱清言**: 在 https://open.bigmodel.cn 注册并获取API Key
   - **AnyRouter**: 在 https://anyrouter.ai 注册并获取API Key  
   - **PackyCode**: 在 https://packycode.com 注册并获取API Key

## 构建验证

✅ **TypeScript编译**: 通过  
✅ **前端构建**: 成功  
✅ **类型检查**: 无错误  
✅ **文件大小**: 优化良好

此更改保持了应用的功能完整性，同时提供了更精准的预设供应商选择，满足用户对特定服务的需求。