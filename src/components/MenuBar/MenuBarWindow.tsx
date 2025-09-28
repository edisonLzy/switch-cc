import { useState, useEffect } from 'react';
import { Provider } from '../../types';
import { Settings, Monitor, Check, ChevronRight } from 'lucide-react';
import { buttonStyles, cardStyles } from '../../lib/styles';
import { api } from '../../lib/tauri-api';

function MenuBarWindow() {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [currentProviderId, setCurrentProviderId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProviders();
    setupEventListeners();
  }, []);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      const loadedProviders = await api.getProviders();
      const currentId = await api.getCurrentProvider();
      setProviders(loadedProviders);
      setCurrentProviderId(currentId);
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupEventListeners = async () => {
    try {
      // 监听供应商切换事件
      await api.onProviderSwitched(async () => {
        await loadProviders();
      });
    } catch (error) {
      console.error('设置事件监听器失败:', error);
    }
  };

  const handleSwitchProvider = async (providerId: string) => {
    try {
      const success = await api.switchProvider(providerId);
      if (success) {
        setCurrentProviderId(providerId);
        // 更新托盘菜单
        await api.updateTrayMenu();
        // MenuBar模式下可以自动隐藏窗口
        setTimeout(() => {
          api.hideMenuBar();
        }, 500);
      }
    } catch (error) {
      console.error('切换供应商失败:', error);
    }
  };

  const switchToMainWindow = async () => {
    try {
      await api.setAppMode('main');
    } catch (error) {
      console.error('切换到主界面失败:', error);
    }
  };

  const openSettings = async () => {
    try {
      // 在MenuBar模式下，设置需要切换到主界面
      await api.setAppMode('main');
      // 这里可以发送事件通知主界面打开设置
    } catch (error) {
      console.error('打开设置失败:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <div className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  const providersList = Object.values(providers);
  const currentProvider = providers[currentProviderId];

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
      {/* 头部 */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">Switch CC</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={openSettings}
              className={`p-1.5 ${buttonStyles.icon} text-xs`}
              title="设置"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={switchToMainWindow}
              className={`p-1.5 ${buttonStyles.icon} text-xs`}
              title="打开主界面"
            >
              <Monitor size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 当前供应商显示 */}
      {currentProvider && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              当前: {currentProvider.name}
            </span>
          </div>
          {currentProvider.websiteUrl && (
            <button
              onClick={() => api.openExternal(currentProvider.websiteUrl!)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
            >
              访问官网 →
            </button>
          )}
        </div>
      )}

      {/* 供应商列表 */}
      <div className="max-h-96 overflow-y-auto">
        {providersList.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-gray-400 mb-2">
              <Settings size={32} className="mx-auto" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              还没有配置供应商
            </p>
            <button
              onClick={switchToMainWindow}
              className={`text-sm ${buttonStyles.primary}`}
            >
              去添加供应商
            </button>
          </div>
        ) : (
          <div className="py-2">
            {providersList.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleSwitchProvider(provider.id)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150 flex items-center justify-between group ${
                  provider.id === currentProviderId ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {provider.id === currentProviderId ? (
                    <Check size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${
                      provider.id === currentProviderId 
                        ? 'text-blue-900 dark:text-blue-100' 
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {provider.name}
                    </p>
                    {provider.category && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {getCategoryName(provider.category)}
                      </p>
                    )}
                  </div>
                </div>
                {provider.id !== currentProviderId && (
                  <ChevronRight size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{providersList.length} 个供应商</span>
          <button
            onClick={switchToMainWindow}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            管理供应商 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 获取分类名称
function getCategoryName(category: string): string {
  const categoryMap: Record<string, string> = {
    official: '官方',
    cn_official: '国产官方',
    aggregator: '聚合平台',
    third_party: '第三方',
    custom: '自定义'
  };
  return categoryMap[category] || category;
}

export default MenuBarWindow;