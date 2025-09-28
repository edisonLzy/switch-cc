import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Save } from 'lucide-react';
import { buttonStyles, inputStyles, modalStyles } from '../../lib/styles';
import { Settings } from '../../types';
import { api } from '../../lib/tauri-api';

interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await api.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('加载设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      await api.saveSettings(settings);
      onClose();
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      await api.checkForUpdates();
    } catch (error) {
      console.error('检查更新失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={modalStyles.backdrop}>
        <div className={modalStyles.content}>
          <div className="p-6 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>加载设置中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={modalStyles.backdrop} onClick={onClose}>
        <div className={modalStyles.content} onClick={(e) => e.stopPropagation()}>
          <div className="p-6 text-center">
            <p className="text-red-600">加载设置失败</p>
            <button onClick={onClose} className={`${buttonStyles.primary} mt-4`}>
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SettingsIcon size={20} />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                应用设置
              </h2>
            </div>
            <button onClick={onClose} className={buttonStyles.icon}>
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            {/* 托盘设置 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                系统托盘
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.showInTray}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, showInTray: e.target.checked } : prev)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    在系统托盘显示图标
                  </span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.minimizeToTrayOnClose}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, minimizeToTrayOnClose: e.target.checked } : prev)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    点击关闭按钮时最小化到托盘
                  </span>
                </label>
              </div>
            </div>

            {/* MenuBar 设置 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                MenuBar 模式
              </h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.enableMenuBar}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, enableMenuBar: e.target.checked } : prev)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  启用 MenuBar 快捷模式
                </span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-6">
                启用后可通过系统菜单栏快速切换供应商
              </p>
            </div>

            {/* 配置路径 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                配置路径
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Claude 配置目录（可选）
                  </label>
                  <input
                    type="text"
                    value={settings.claudeConfigDir || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, claudeConfigDir: e.target.value || undefined } : prev)}
                    className={inputStyles.base}
                    placeholder="默认使用 ~/.claude"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    留空使用默认路径 ~/.claude
                  </p>
                </div>
              </div>
            </div>

            {/* 应用信息 */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                应用信息
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">版本：</span>
                  <span className="text-gray-900 dark:text-gray-100">1.0.0</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">构建于：</span>
                  <span className="text-gray-900 dark:text-gray-100">Tauri 2.8</span>
                </div>
              </div>
              <button
                onClick={handleCheckUpdates}
                className={`${buttonStyles.secondary} w-full mt-4`}
              >
                检查更新
              </button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-3 mt-8">
            <button onClick={onClose} className={buttonStyles.secondary}>
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`${buttonStyles.primary} ${isSaving ? 'opacity-50' : ''}`}
            >
              <Save size={16} className="mr-2" />
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;