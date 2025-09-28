import { useState } from 'react';
import { Provider } from '../../types';
import { X, Save } from 'lucide-react';
import { buttonStyles, inputStyles, modalStyles } from '../../lib/styles';

interface EditProviderModalProps {
  provider: Provider;
  onSave: (provider: Provider) => void;
  onClose: () => void;
}

function EditProviderModal({ provider, onSave, onClose }: EditProviderModalProps) {
  const [formData, setFormData] = useState({
    name: provider.name,
    websiteUrl: provider.websiteUrl || '',
    category: provider.category || 'custom',
    configJson: JSON.stringify(provider.settingsConfig, null, 2),
  });

  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const settingsConfig = JSON.parse(formData.configJson);
      
      const updatedProvider: Provider = {
        ...provider,
        name: formData.name.trim(),
        websiteUrl: formData.websiteUrl.trim() || undefined,
        category: formData.category,
        settingsConfig,
      };

      onSave(updatedProvider);
    } catch (error) {
      setError('配置 JSON 格式错误，请检查语法');
    }
  };

  return (
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              编辑供应商 - {provider.name}
            </h2>
            <button onClick={onClose} className={buttonStyles.icon}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  供应商名称 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={inputStyles.base}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  官网地址（可选）
                </label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
                  className={inputStyles.base}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  供应商分类
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className={inputStyles.base}
                >
                  <option value="official">官方</option>
                  <option value="cn_official">国产官方</option>
                  <option value="aggregator">聚合平台</option>
                  <option value="third_party">第三方</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  配置 JSON *
                </label>
                <textarea
                  required
                  rows={12}
                  value={formData.configJson}
                  onChange={(e) => setFormData(prev => ({ ...prev, configJson: e.target.value }))}
                  className={`${inputStyles.base} font-mono text-sm ${error ? inputStyles.error : ''}`}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className={buttonStyles.secondary}>
                取消
              </button>
              <button type="submit" className={buttonStyles.primary}>
                <Save size={16} className="mr-2" />
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default EditProviderModal;