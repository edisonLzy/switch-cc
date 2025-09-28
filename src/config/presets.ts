import { Provider } from '../types';

// 预设供应商配置
export const presetProviders: Omit<Provider, 'id' | 'createdAt'>[] = [
  {
    name: '智谱清言',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-api-key',
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4'
      }
    },
    websiteUrl: 'https://open.bigmodel.cn'
  },
  {
    name: 'AnyRouter',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-anyrouter-api-key',
        ANTHROPIC_BASE_URL: 'https://api.anyrouter.ai/v1'
      }
    },
    websiteUrl: 'https://anyrouter.ai'
  },
  {
    name: 'PackyCode',
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: 'your-packycode-api-key', 
        ANTHROPIC_BASE_URL: 'https://api.packycode.com/v1'
      }
    },
    websiteUrl: 'https://packycode.com'
  }
];

// 生成默认配置
export const generateDefaultConfig = (baseUrl?: string, apiKey?: string) => {
  const config: Record<string, any> = {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey || 'your-api-key',
      ANTHROPIC_BASE_URL: baseUrl || 'https://api.anthropic.com'
    }
  };

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