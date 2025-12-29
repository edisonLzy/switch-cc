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
  private authToken: string | null = null;

  constructor() {
    // Get API base URL from environment variable
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * 获取认证令牌
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * 清除认证令牌
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * 获取认证请求头
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
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
  async getConfig(providerId: string): Promise<Provider | null> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/config/${providerId}`;
      console.log("[ConfigSyncAPI] 获取配置:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
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
  async getAllConfigs(): Promise<Provider[]> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/configs`;
      console.log("[ConfigSyncAPI] 获取所有配置:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: this.getAuthHeaders(),
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
  async upsertConfig(provider: Provider): Promise<void> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/config`;
      console.log("[ConfigSyncAPI] 创建/更新配置:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          providerId: provider.id,
          config: {
            name: provider.name,
            settingsConfig: provider.settingsConfig,
            websiteUrl: provider.websiteUrl,
          },
        }),
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
  async syncConfigs(providers: Provider[]): Promise<void> {
    try {
      // Use upsertConfig for each provider since there's no batch endpoint
      for (const provider of providers) {
        await this.upsertConfig(provider);
      }
      console.log("[ConfigSyncAPI] 批量同步成功:", providers.length, "个配置");
    } catch (error) {
      console.error("[ConfigSyncAPI] 批量同步失败:", error);
      throw error;
    }
  }

  /**
   * 删除配置
   */
  async deleteConfig(providerId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/config/${providerId}`;
      console.log("[ConfigSyncAPI] 删除配置:", url);

      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
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
  async testConnection(): Promise<{
    success: boolean;
    configCount?: number;
    error?: string;
  }> {
    try {
      const configs = await this.getAllConfigs();
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

  /**
   * 用户登录
   */
  async login(
    username: string,
    password: string,
  ): Promise<{
    success: boolean;
    token?: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/auth/login`;
      console.log("[ConfigSyncAPI] 登录:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const data = await response.json();
      console.log("[ConfigSyncAPI] 登录成功");

      // Store the auth token
      if (data.token) {
        this.setAuthToken(data.token);
      }

      return {
        success: true,
        token: data.token,
        userId: data.userId || data.id || username,
      };
    } catch (error) {
      console.error("[ConfigSyncAPI] 登录失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }
}

// 导出单例实例
export const configSyncAPI = new ConfigSyncAPI();
