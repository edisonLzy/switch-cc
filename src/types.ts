export type ProviderType = "claude" | "codex";

export interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>; // Claude/Codex settings 配置对象
  websiteUrl?: string;
  createdAt?: number; // 添加时间戳（毫秒）
  providerType?: ProviderType; // 供应商类型，默认为 "claude"
}

export interface AppConfig {
  providers: Record<string, Provider>;
  current: string;
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
