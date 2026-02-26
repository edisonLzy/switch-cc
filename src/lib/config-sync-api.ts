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
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    // Get API base URL from environment variable
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    
    // Initialize token from localStorage
    this.accessToken = localStorage.getItem("switch_cc_sync_token");
    this.refreshToken = localStorage.getItem("switch_cc_sync_refresh_token");
  }

  /**
   * 保存用户信息
   */
  setUserData(email: string, username: string): void {
    localStorage.setItem("switch_cc_sync_email", email);
    localStorage.setItem("switch_cc_sync_username", username);
  }

  /**
   * 获取用户信息
   */
  getUserData(): { email: string | null; username: string | null } {
    return {
      email: localStorage.getItem("switch_cc_sync_email"),
      username: localStorage.getItem("switch_cc_sync_username"),
    };
  }

  /**
   * 设置认证令牌
   */
  setAuthToken(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    localStorage.setItem("switch_cc_sync_token", accessToken);
    
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem("switch_cc_sync_refresh_token", refreshToken);
    }
  }

  /**
   * 获取认证令牌
   */
  getAuthToken(): string | null {
    return this.accessToken;
  }

  /**
   * 清除认证令牌和用户信息
   */
  clearAuthToken(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem("switch_cc_sync_token");
    localStorage.removeItem("switch_cc_sync_refresh_token");
    localStorage.removeItem("switch_cc_sync_email");
    localStorage.removeItem("switch_cc_sync_username");
  }

  /**
   * 获取认证请求头
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
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
   * 通用请求方法，处理 Token 刷新
   */
  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const doRequest = async (token?: string) => {
      const headers = {
        ...this.getAuthHeaders(),
        ...(options.headers as Record<string, string>),
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      return fetch(url, {
        ...options,
        headers,
      });
    };

    try {
      const response = await doRequest();

      // 如果是 401 且即使有 Token，尝试刷新
      if (response.status === 401 && this.refreshToken) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const newTokens = await this.refreshAuthToken();
            this.isRefreshing = false;
            this.onRefreshed(newTokens.accessToken);
            return doRequest(newTokens.accessToken);
          } catch (error) {
            this.isRefreshing = false;
            this.clearAuthToken();
            throw error;
          }
        } else {
          // 如果正在刷新，等待刷新完成
          return new Promise((resolve) => {
            this.subscribeTokenRefresh((token) => {
              resolve(doRequest(token));
            });
          });
        }
      }

      return response;
    } catch (error) {
      throw error;
    }
  }

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  /**
   * 刷新 Token
   */
  private async refreshAuthToken(): Promise<{ accessToken: string; refreshToken: string }> {
    console.log("[ConfigSyncAPI] 正在刷新 Token...");
    const url = `${this.baseUrl}/v1/auth/refresh`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh token");
      }

      const result = await response.json();
      const { accessToken, refreshToken } = result.data;
      
      this.setAuthToken(accessToken, refreshToken);
      console.log("[ConfigSyncAPI] Token 刷新成功");
      
      return { accessToken, refreshToken };
    } catch (error) {
      console.error("[ConfigSyncAPI] Token 刷新失败:", error);
      throw error;
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    if (this.refreshToken) {
      try {
        const url = `${this.baseUrl}/v1/auth/logout`;
        // 不等待结果，直接清除本地状态
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        }).catch(e => console.error("Logout API call failed", e));
      } catch (error) {
        console.error("[ConfigSyncAPI] 登出请求失败:", error);
      }
    }
    this.clearAuthToken();
  }

  /**
   * 获取单个供应商配置
   */
  async getConfig(providerId: string): Promise<Provider | null> {
    try {
      const url = `${this.baseUrl}/v1/switch-cc/config/${providerId}`;
      console.log("[ConfigSyncAPI] 获取配置:", url);

      const response = await this.request(url, {
        method: "GET",
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

      const result = await response.json();
      return result.data ? this.backendConfigToProvider(result.data) : null;
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

      const response = await this.request(url, {
        method: "GET",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();
      const data: BackendConfig[] = result.data || [];
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

      const response = await this.request(url, {
        method: "POST",
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

      const response = await this.request(url, {
        method: "DELETE",
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
    email: string,
    password: string,
  ): Promise<{
    success: boolean;
    token?: string;
    username?: string;
    error?: string;
  }> {
    try {
      const url = `${this.baseUrl}/v1/auth/login`;
      console.log("[ConfigSyncAPI] 登录:", url);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorText || response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("[ConfigSyncAPI] 登录成功");

      const accessToken = result.data?.accessToken;
      const refreshToken = result.data?.refreshToken;
      const username = result.data?.user?.username;

      if (accessToken) {
        this.setAuthToken(accessToken, refreshToken);
      }

      return {
        success: true,
        token: accessToken,
        username: username,
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
