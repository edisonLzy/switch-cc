import { Provider } from '../../types';
import { Trash2, Edit, Play, ExternalLink } from 'lucide-react';
import { buttonStyles, cardStyles } from '../../lib/styles';
import { formatTimestamp } from '../../utils/errorUtils';

interface ProviderListProps {
  providers: Record<string, Provider>;
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onNotify: (message: string, type: 'success' | 'error') => void;
}

function ProviderList({
  providers,
  currentProviderId,
  onSwitch,
  onDelete,
  onEdit,
}: ProviderListProps) {
  const providerList = Object.values(providers);

  if (providerList.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <Play size={48} className="mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          还没有供应商配置
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          点击上方"添加供应商"按钮开始配置您的第一个 Claude 供应商
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          供应商列表
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {providerList.length} 个供应商
        </span>
      </div>

      <div className="grid gap-4">
        {providerList.map((provider) => (
          <div
            key={provider.id}
            className={`${cardStyles.base} p-6 ${
              provider.id === currentProviderId
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                    {provider.name}
                  </h3>
                  {provider.id === currentProviderId && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      当前使用
                    </span>
                  )}
                  {provider.category && (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full dark:bg-gray-800 dark:text-gray-400">
                      {getCategoryName(provider.category)}
                    </span>
                  )}
                </div>

                {provider.websiteUrl && (
                  <button
                    onClick={() => window.api?.openExternal(provider.websiteUrl!)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-2"
                  >
                    <ExternalLink size={14} />
                    访问官网
                  </button>
                )}

                {provider.createdAt && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    创建于 {formatTimestamp(provider.createdAt)}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                {provider.id !== currentProviderId && (
                  <button
                    onClick={() => onSwitch(provider.id)}
                    className={`${buttonStyles.primary} text-sm`}
                  >
                    切换
                  </button>
                )}
                
                <button
                  onClick={() => onEdit(provider.id)}
                  className={buttonStyles.icon}
                  title="编辑"
                >
                  <Edit size={16} />
                </button>
                
                <button
                  onClick={() => onDelete(provider.id)}
                  className={`${buttonStyles.icon} text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20`}
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* 配置预览 */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                配置预览：
              </h4>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                {JSON.stringify(provider.settingsConfig, null, 2)}
              </pre>
            </div>
          </div>
        ))}
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
    custom: '自定义',
  };
  return categoryMap[category] || category;
}

export default ProviderList;