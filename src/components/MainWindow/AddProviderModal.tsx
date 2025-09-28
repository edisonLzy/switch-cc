import { useState } from 'react';
import { Provider, ProviderCategory } from '../../types';
import { X, Plus } from 'lucide-react';
import { buttonStyles, inputStyles, modalStyles } from '../../lib/styles';
import { presetProviders, generateDefaultConfig } from '../../config/presets';

interface AddProviderModalProps {
  onAdd: (provider: Omit<Provider, 'id'>) => void;
  onClose: () => void;
}

function AddProviderModal({ onAdd, onClose }: AddProviderModalProps) {
  const [step, setStep] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    websiteUrl: '',
    category: 'custom' as ProviderCategory,
    apiKey: '',
    baseUrl: '',
    customConfig: '{}',
  });

  const handlePresetSelect = (presetIndex: number) => {
    const preset = presetProviders[presetIndex];
    setFormData({
      name: preset.name,
      websiteUrl: preset.websiteUrl || '',
      category: preset.category || 'custom',
      apiKey: '',
      baseUrl: '',
      customConfig: JSON.stringify(preset.settingsConfig, null, 2),
    });
    setSelectedPreset(presetIndex.toString());
  };

  const handleCustomConfig = () => {
    setStep('custom');
    setFormData(prev => ({
      ...prev,
      name: '',
      customConfig: JSON.stringify(generateDefaultConfig(), null, 2),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let settingsConfig;
      
      if (step === 'preset' && selectedPreset) {
        const preset = presetProviders[parseInt(selectedPreset)];
        settingsConfig = { ...preset.settingsConfig };
        
        // 如果有API Key，替换配置中的token
        if (formData.apiKey.trim()) {
          settingsConfig.env = {
            ...settingsConfig.env,
            ANTHROPIC_AUTH_TOKEN: formData.apiKey.trim(),
          };
        }
      } else {
        // 自定义配置
        settingsConfig = JSON.parse(formData.customConfig);
      }

      const provider: Omit<Provider, 'id'> = {
        name: formData.name.trim(),
        settingsConfig,
        websiteUrl: formData.websiteUrl.trim() || undefined,
        category: formData.category,
      };

      onAdd(provider);
    } catch (error) {
      alert('配置格式错误，请检查JSON格式');
    }
  };

  return (
    <div className={modalStyles.backdrop} onClick={onClose}>
      <div className={modalStyles.content} onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              添加供应商
            </h2>
            <button onClick={onClose} className={buttonStyles.icon}>
              <X size={20} />
            </button>
          </div>

          {step === 'preset' ? (
            // 预设选择界面
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  选择预设供应商
                </h3>
                <div className="space-y-3">
                  {presetProviders.map((preset, index) => (
                    <label
                      key={index}
                      className={`block p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedPreset === index.toString()
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="preset"
                        value={index}
                        checked={selectedPreset === index.toString()}
                        onChange={() => handlePresetSelect(index)}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {preset.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {getCategoryName(preset.category || 'custom')}
                          </p>
                        </div>
                        {preset.websiteUrl && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            有官网
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                {/* API Key 输入 */}
                {selectedPreset && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      API Key（可选，不填写将使用默认占位符）
                    </label>
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                      className={inputStyles.base}
                      placeholder="输入您的 API Key"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleCustomConfig}
                  className={buttonStyles.secondary}
                >
                  自定义配置
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className={buttonStyles.secondary}>
                    取消
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!selectedPreset}
                    className={`${buttonStyles.primary} disabled:opacity-50`}
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // 自定义配置界面
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
                    placeholder="输入供应商名称"
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
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ProviderCategory }))}
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
                    rows={10}
                    value={formData.customConfig}
                    onChange={(e) => setFormData(prev => ({ ...prev, customConfig: e.target.value }))}
                    className={`${inputStyles.base} font-mono text-sm`}
                    placeholder="输入完整的配置 JSON"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep('preset')}
                  className={buttonStyles.secondary}
                >
                  返回预设
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className={buttonStyles.secondary}>
                    取消
                  </button>
                  <button type="submit" className={buttonStyles.primary}>
                    <Plus size={16} className="mr-2" />
                    添加
                  </button>
                </div>
              </div>
            </form>
          )}
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
    custom: '自定义',
  };
  return categoryMap[category] || category;
}

export default AddProviderModal;