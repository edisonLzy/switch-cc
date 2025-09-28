import { Provider, ProviderCategory } from '../types';

// 预设供应商配置
export const presetProviders: Omit<Provider, 'id' | 'createdAt'>[] = [
  {
    name: 'Claude 官方',
    category: 'official',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: ''
      }
    },
    websiteUrl: 'https://claude.ai'
  },
  {
    name: '阿里云百炼',
    category: 'cn_official',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-api-key',
        ANTHROPIC_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }
    },
    websiteUrl: 'https://bailian.console.aliyun.com'
  },
  {
    name: '智谱清言',
    category: 'cn_official',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-api-key',
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4'
      }
    },
    websiteUrl: 'https://open.bigmodel.cn'
  },
  {
    name: 'OpenRouter',
    category: 'aggregator',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'sk-or-v1-your-api-key',
        ANTHROPIC_BASE_URL: 'https://openrouter.ai/api/v1'
      }
    },
    websiteUrl: 'https://openrouter.ai'
  },
  {
    name: 'Together AI',
    category: 'third_party',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-together-api-key',
        ANTHROPIC_BASE_URL: 'https://api.together.xyz/v1'
      }
    },
    websiteUrl: 'https://together.ai'
  }
];

// 根据分类获取预设
export const getPresetsByCategory = (category?: ProviderCategory) => {
  if (!category) return presetProviders;
  return presetProviders.filter(preset => preset.category === category);
};

// 生成默认配置
export const generateDefaultConfig = (baseUrl?: string, apiKey?: string) => {
  const config: Record<string, any> = {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey || 'your-api-key'
    }
  };

  if (baseUrl) {
    config.env.ANTHROPIC_BASE_URL = baseUrl;
  }

  return config;
};

// 验证配置格式
export const validateClaudeConfig = (config: any): { valid: boolean; error?: string } => {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: '配置必须是一个对象' };
  }

  if (!config.env) {
    return { valid: false, error: '缺少 env 配置节' };
  }

  if (!config.env.ANTHROPIC_AUTH_TOKEN) {
    return { valid: false, error: '缺少 ANTHROPIC_AUTH_TOKEN' };
  }

  if (config.env.ANTHROPIC_BASE_URL && typeof config.env.ANTHROPIC_BASE_URL !== 'string') {
    return { valid: false, error: 'ANTHROPIC_BASE_URL 必须是字符串' };
  }

  return { valid: true };
};