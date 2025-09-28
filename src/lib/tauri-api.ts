import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Provider, Settings, AppMode } from '../types';

export class TauriAPI {
  // 获取所有供应商
  async getProviders(): Promise<Record<string, Provider>> {
    return await invoke('get_providers');
  }

  // 获取当前供应商ID
  async getCurrentProvider(): Promise<string> {
    return await invoke('get_current_provider');
  }

  // 添加供应商
  async addProvider(provider: Provider): Promise<void> {
    return await invoke('add_provider', { provider });
  }

  // 更新供应商
  async updateProvider(provider: Provider): Promise<void> {
    return await invoke('update_provider', { provider });
  }

  // 删除供应商
  async deleteProvider(id: string): Promise<void> {
    return await invoke('delete_provider', { id });
  }

  // 切换供应商
  async switchProvider(id: string): Promise<boolean> {
    return await invoke('switch_provider', { providerId: id });
  }

  // 导入当前配置作为默认供应商
  async importCurrentConfigAsDefault(): Promise<{ success: boolean; message?: string }> {
    return await invoke('import_current_config_as_default');
  }

  // 获取Claude配置状态
  async getClaudeConfigStatus(): Promise<{ exists: boolean; path: string }> {
    return await invoke('get_claude_config_status');
  }

  // 获取Claude配置内容
  async getClaudeConfig(): Promise<{ exists: boolean; content?: any; path: string }> {
    return await invoke('get_claude_config');
  }

  // 打开配置文件夹
  async openConfigFolder(): Promise<void> {
    return await invoke('open_config_folder');
  }

  // 选择目录
  async pickDirectory(): Promise<string | null> {
    return await invoke('pick_directory');
  }

  // 打开外部链接
  async openExternal(url: string): Promise<void> {
    return await invoke('open_external', { url });
  }

  // 获取应用配置路径
  async getAppConfigPath(): Promise<string> {
    return await invoke('get_app_config_path');
  }

  // 打开应用配置文件夹
  async openAppConfigFolder(): Promise<void> {
    return await invoke('open_app_config_folder');
  }

  // 获取设置
  async getSettings(): Promise<Settings> {
    return await invoke('get_settings');
  }

  // 保存设置
  async saveSettings(settings: Settings): Promise<void> {
    return await invoke('save_settings', { settings });
  }

  // 检查更新
  async checkForUpdates(): Promise<void> {
    return await invoke('check_for_updates');
  }

  // 是否为便携模式
  async isPortableMode(): Promise<boolean> {
    return await invoke('is_portable_mode');
  }

  // 更新托盘菜单
  async updateTrayMenu(): Promise<boolean> {
    return await invoke('update_tray_menu');
  }

  // 设置应用模式（主界面或MenuBar）
  async setAppMode(mode: AppMode): Promise<void> {
    return await invoke('set_app_mode', { mode });
  }

  // 获取当前应用模式
  async getAppMode(): Promise<AppMode> {
    return await invoke('get_app_mode');
  }

  // 显示MenuBar窗口
  async showMenuBar(): Promise<void> {
    return await invoke('show_menubar');
  }

  // 隐藏MenuBar窗口
  async hideMenuBar(): Promise<void> {
    return await invoke('hide_menubar');
  }

  // 监听供应商切换事件
  async onProviderSwitched(callback: (data: { providerId: string }) => void) {
    return await listen('provider-switched', (event) => {
      callback(event.payload as { providerId: string });
    });
  }

  // 监听应用模式切换事件
  async onAppModeChanged(callback: (data: { mode: AppMode }) => void) {
    return await listen('app-mode-changed', (event) => {
      callback(event.payload as { mode: AppMode });
    });
  }
}

// 全局API实例
export const api = new TauriAPI();

// 挂载到window对象供组件使用
declare global {
  interface Window {
    api: TauriAPI;
  }
}

if (typeof window !== 'undefined') {
  window.api = api;
}