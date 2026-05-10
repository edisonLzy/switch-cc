export type ProviderType = "claude" | "codex";

export interface CodexProviderConfig {
  providerName: string;
  upstreamUrl: string;
  apiKey: string;
  modelName: string;
}

interface ProviderBase {
  id: string;
  name: string;
  providerType?: ProviderType;
  websiteUrl?: string;
  category?: string;
  createdAt?: number; // 添加时间戳（毫秒）
}

export interface ClaudeProvider extends ProviderBase {
  providerType?: "claude";
  settingsConfig: Record<string, any>; // Claude settings.json 配置对象
  codexConfig?: never;
}

export interface CodexProvider extends ProviderBase {
  providerType: "codex";
  codexConfig: CodexProviderConfig;
  settingsConfig?: never;
}

export type Provider = ClaudeProvider | CodexProvider;

export function getProviderType(provider: Pick<Provider, "providerType">): ProviderType {
  return provider.providerType === "codex" ? "codex" : "claude";
}

export function isClaudeProvider(provider: Provider): provider is ClaudeProvider {
  return getProviderType(provider) === "claude";
}

export function isCodexProvider(provider: Provider): provider is CodexProvider {
  return getProviderType(provider) === "codex";
}

export interface AppConfig {
  providers: Record<string, Provider>;
  current: string;
}

export interface ApiGatewayStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  localBaseUrl: string;
  targetProviderId?: string;
  targetProviderName?: string;
  targetBaseUrl?: string;
}

export interface ApiGatewayLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface CodexGatewayStatus {
  enabled: boolean;
  running: boolean;
  port: number;
  localBaseUrl: string;
  healthUrl: string;
  targetProviderId?: string;
  targetProviderName?: string;
  targetBaseUrl?: string;
  targetModelName?: string;
  codexConfigPath: string;
  installedInCodexConfig: boolean;
  providerKey: string;
}

// 应用设置类型
export interface Settings {
  // 是否在系统托盘（macOS 菜单栏）显示图标
  showInTray: boolean;
  // 点击关闭按钮时是否最小化到托盘而不是关闭应用
  minimizeToTrayOnClose: boolean;
  // 覆盖 Claude Code 配置目录（可选）
  claudeConfigDir?: string;
  // 是否启用 MenuBar 模式
  enableMenuBar: boolean;
}

// MenuBar 模式类型
export type AppMode = "main" | "menubar";

// 配置同步相关类型
export interface SyncConfig {
  userId: string;
  providerId: string;
  config: Record<string, any>;
}

export interface SyncStatus {
  lastSyncTime?: number;
  syncEnabled: boolean;
  userId?: string;
}
