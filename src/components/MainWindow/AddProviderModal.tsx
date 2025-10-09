import { useState } from "react";
import { Provider } from "../../types";
import { Plus, Wand2 } from "lucide-react";
import { presetProviders, generateDefaultConfig } from "../../config/presets";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

interface AddProviderModalProps {
  onAdd: (provider: Omit<Provider, "id">) => void;
  onClose: () => void;
}

function AddProviderModal({ onAdd, onClose }: AddProviderModalProps) {
  const [step, setStep] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    websiteUrl: "",
    apiKey: "",
    baseUrl: "",
    customConfig: "{}",
  });
  const [error, setError] = useState("");

  const handlePresetSelect = (presetIndex: number) => {
    const preset = presetProviders[presetIndex];
    setFormData({
      name: preset.name,
      websiteUrl: preset.websiteUrl || "",
      apiKey: "",
      baseUrl: "",
      customConfig: JSON.stringify(preset.settingsConfig, null, 2),
    });
    setSelectedPreset(presetIndex.toString());
  };

  const handleCustomConfig = () => {
    setStep("custom");
    setFormData((prev) => ({
      ...prev,
      name: "",
      customConfig: JSON.stringify(generateDefaultConfig(), null, 2),
    }));
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formData.customConfig);
      const formatted = JSON.stringify(parsed, null, 2);
      setFormData((prev) => ({ ...prev, customConfig: formatted }));
      setError("");
    } catch (error) {
      setError("JSON 格式错误，无法格式化");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let settingsConfig;

      if (step === "preset" && selectedPreset) {
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

      const provider: Omit<Provider, "id"> = {
        name: formData.name.trim(),
        settingsConfig,
        websiteUrl: formData.websiteUrl.trim() || undefined,
      };

      onAdd(provider);
    } catch (error) {
      alert("配置格式错误，请检查JSON格式");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加供应商</DialogTitle>
        </DialogHeader>

        {step === "preset" ? (
          // 预设选择界面
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-heading text-foreground mb-4">
                选择预设供应商
              </h3>
              <div className="space-y-3">
                {presetProviders.map((preset, index) => (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-colors p-0 ${
                      selectedPreset === index.toString()
                        ? "ring-4 ring-main"
                        : "hover:ring-2 hover:ring-border"
                    }`}
                    onClick={() => handlePresetSelect(index)}
                  >
                    <CardContent className="p-4">
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
                          <h4 className="font-heading text-foreground">
                            {preset.name}
                          </h4>
                        </div>
                        {preset.websiteUrl && (
                          <Badge variant="default">有官网</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* API Key 输入 */}
              {selectedPreset && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="apikey">
                    API Key（可选，不填写将使用默认占位符）
                  </Label>
                  <Input
                    id="apikey"
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                    placeholder="输入您的 API Key"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                onClick={handleCustomConfig}
                variant="neutral"
              >
                自定义配置
              </Button>
              <div className="flex gap-3">
                <Button type="button" onClick={onClose} variant="neutral">
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedPreset}
                  className="disabled:opacity-50"
                >
                  添加
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : (
          // 自定义配置界面
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">供应商名称 *</Label>
                <Input
                  id="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="输入供应商名称"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">官网地址（可选）</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      websiteUrl: e.target.value,
                    }))
                  }
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="config">配置 JSON *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFormatJson}
                    className="gap-2"
                  >
                    <Wand2 size={14} />
                    格式化
                  </Button>
                </div>
                <Textarea
                  id="config"
                  required
                  rows={10}
                  value={formData.customConfig}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customConfig: e.target.value,
                    }))
                  }
                  className={`font-mono text-sm ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  placeholder="输入完整的配置 JSON"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button
                type="button"
                onClick={() => setStep("preset")}
                variant="neutral"
              >
                返回预设
              </Button>
              <div className="flex gap-3">
                <Button type="button" onClick={onClose} variant="neutral">
                  取消
                </Button>
                <Button type="submit">
                  <Plus size={16} />
                  添加
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AddProviderModal;
