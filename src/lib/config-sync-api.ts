import { Provider } from "../types";

/**
 * Backend API 数据格式
 */
interface BackendConfig {
  userId: string;
  providerId: string;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 配置云同步 API 客户端
 */
export class ConfigSyncAPI {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // 从环境变量获取 API 基础 URL，如果未设置则使用传入的 baseUrl
    this.baseUrl =
      baseUrl || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  }

  /**
   * 将前端 Provider 格式转换为后端格式
   */
  private providerToBackendConfig(
    provider: Provider,
    userId: string,
  ): BackendConfig {
    return {
      userId,
      providerId: provider.id,
      config: {
        name: provider.name,
        settingsConfig: provider.settingsConfig,
        websiteUrl: provider.websiteUrl,
      },
      createdAt: provider.createdAt
        ? new Date(provider.createdAt).toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 将后端格式转换为前端 Provider 格式
   */
  private backendConfigToProvider(backendConfig: BackendConfig): Provider {
    return {
      id: backendConfig.providerId,
      name: backendConfig.config.name || backendConfig.providerId,
      settingsConfig: backendConfig.config.settingsConfig || {},
      websiteUrl: backendConfig.config.websiteUrl,
      createdAt: new Date(backendConfig.createdAt).getTime(),
    };
  }

  /**
   * 获取单个供应商配置
   */
  async getConfig(
    userId: string,
    providerId: string,
  ): Promise<Provider | null> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/configs/${providerId}?userId=${encodeURIComponent(userId)}`;
      console.log("[ConfigSyncAPI] 获取配置:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        console.log("[ConfigSyncAPI] 配置不存在:", providerId);
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data: BackendConfig = await response.json();
      return this.backendConfigToProvider(data);
    } catch (error) {
      console.error("[ConfigSyncAPI] 获取配置失败:", error);
      throw error;
    }
  }

  /**
   * 获取用户所有配置
   */
  async getAllConfigs(userId: string): Promise<Provider[]> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/configs?userId=${encodeURIComponent(userId)}`;
      console.log("[ConfigSyncAPI] 获取所有配置:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data: BackendConfig[] = await response.json();
      return data.map((config) => this.backendConfigToProvider(config));
    } catch (error) {
      console.error("[ConfigSyncAPI] 获取所有配置失败:", error);
      throw error;
    }
  }

  /**
   * 创建或更新单个配置
   */
  async upsertConfig(userId: string, provider: Provider): Promise<void> {
    try {
      const backendConfig = this.providerToBackendConfig(provider, userId);
      const url = `${this.baseUrl}/v1/switch-cc/configs`;
      console.log("[ConfigSyncAPI] 创建/更新配置:", url, backendConfig);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(backendConfig),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      console.log("[ConfigSyncAPI] 配置已保存:", provider.id);
    } catch (error) {
      console.error("[ConfigSyncAPI] 保存配置失败:", error);
      throw error;
    }
  }

  /**
   * 批量同步配置
   */
  async syncConfigs(userId: string, providers: Provider[]): Promise<void> {
    try {
      const backendConfigs = providers.map((provider) =>
        this.providerToBackendConfig(provider, userId),
      );
      const url = `${this.baseUrl}/v1/switch-cc/configs/sync`;
      console.log(
        "[ConfigSyncAPI] 批量同步配置:",
        url,
        `${backendConfigs.length} 个配置`,
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ configs: backendConfigs }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      console.log(
        "[ConfigSyncAPI] 批量同步成功:",
        backendConfigs.length,
        "个配置",
      );
    } catch (error) {
      console.error("[ConfigSyncAPI] 批量同步失败:", error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(userId: string, providerId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/configs/${providerId}?userId=${encodeURIComponent(userId)}`;
      console.log("[ConfigSyncAPI] 删除配置:", url);

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      console.log("[ConfigSyncAPI] 配置已删除:", providerId);
    } catch (error) {
      console.error("[ConfigSyncAPI] 删除配置失败:", error);
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(userId: string): Promise<{
    success: boolean;
    configCount?: number;
    error?: string;
  }> {
    try {
      const configs = await this.getAllConfigs(userId);
      return {
        success: true,
        configCount: configs.length,
      };
    } catch (error) {
      console.error("[ConfigSyncAPI] 测试连接失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }
}

// 导出单例实例
export const configSyncAPI = new ConfigSyncAPI();
