import { Provider, ProviderType } from "../types";

// 预设供应商配置
export const presetProviders: Omit<Provider, "id" | "createdAt">[] = [
  // Claude 供应商
  {
    name: "智谱清言",
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: "your-api-key",
        ANTHROPIC_BASE_URL: "https://open.bigmodel.cn/api/paas/v4",
      },
    },
    websiteUrl: "https://open.bigmodel.cn",
    providerType: "claude",
  },
  {
    name: "AnyRouter",
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: "your-anyrouter-api-key",
        ANTHROPIC_BASE_URL: "https://api.anyrouter.ai/v1",
      },
    },
    websiteUrl: "https://anyrouter.ai",
    providerType: "claude",
  },
  {
    name: "PackyCode",
    settingsConfig: {
      env: {
        ANTHROPIC_AUTH_TOKEN: "your-packycode-api-key",
        ANTHROPIC_BASE_URL: "https://api.packycode.com/v1",
      },
    },
    websiteUrl: "https://packycode.com",
    providerType: "claude",
  },
  // Codex 供应商
  {
    name: "OpenAI Codex",
    settingsConfig: {
      openai: {
        api_key: "your-openai-api-key",
        organization_id: "your-org-id",
      },
    },
    websiteUrl: "https://openai.com",
    providerType: "codex",
  },
  {
    name: "Azure OpenAI",
    settingsConfig: {
      openai: {
        api_key: "your-azure-api-key",
        api_base: "https://your-resource.openai.azure.com",
        api_version: "2023-05-15",
      },
    },
    websiteUrl: "https://azure.microsoft.com/products/cognitive-services/openai-service",
    providerType: "codex",
  },
];

// 生成默认配置
export const generateDefaultConfig = (
  providerType: ProviderType = "claude",
  baseUrl?: string,
  apiKey?: string,
) => {
  if (providerType === "codex") {
    return {
      openai: {
        api_key: apiKey || "your-api-key",
        ...(baseUrl && { api_base: baseUrl }),
      },
    };
  }

  // Claude 配置
  const config: Record<string, any> = {
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey || "your-api-key",
      ANTHROPIC_BASE_URL: baseUrl || "https://api.anthropic.com",
    },
  };

  return config;
};

// 验证配置格式
export const validateProviderConfig = (
  config: any,
  providerType: ProviderType = "claude",
): { valid: boolean; error?: string } => {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "配置必须是一个对象" };
  }

  if (providerType === "codex") {
    return validateCodexConfig(config);
  }

  return validateClaudeConfig(config);
};

// 验证 Claude 配置格式
export const validateClaudeConfig = (
  config: any,
): { valid: boolean; error?: string } => {
  if (!config.env) {
    return { valid: false, error: "缺少 env 配置节" };
  }

  if (!config.env.ANTHROPIC_AUTH_TOKEN && !config.env.ANTHROPIC_API_KEY) {
    return {
      valid: false,
      error: "缺少认证配置 (ANTHROPIC_AUTH_TOKEN 或 ANTHROPIC_API_KEY)",
    };
  }

  if (
    config.env.ANTHROPIC_BASE_URL &&
    typeof config.env.ANTHROPIC_BASE_URL !== "string"
  ) {
    return { valid: false, error: "ANTHROPIC_BASE_URL 必须是字符串" };
  }

  return { valid: true };
};

// 验证 Codex 配置格式
export const validateCodexConfig = (
  config: any,
): { valid: boolean; error?: string } => {
  if (!config.openai) {
    return { valid: false, error: "缺少 openai 配置节" };
  }

  if (!config.openai.api_key) {
    return { valid: false, error: "缺少认证配置 (openai.api_key)" };
  }

  if (config.openai.api_base && typeof config.openai.api_base !== "string") {
    return { valid: false, error: "openai.api_base 必须是字符串" };
  }

  return { valid: true };
};
