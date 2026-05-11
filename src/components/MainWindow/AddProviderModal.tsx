import { useState } from "react";
import { Plus, Wand2 } from "lucide-react";
import { presetProviders, generateDefaultConfig } from "../../config/presets";
import { Provider, ProviderType } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { JsonEditor } from "../ui/json-editor";
import { Label } from "../ui/label";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { useDarkMode } from "../../hooks/useDarkMode";

interface AddProviderModalProps {
  onAdd: (provider: Omit<Provider, "id">) => void;
  onClose: () => void;
}

function AddProviderModal({ onAdd, onClose }: AddProviderModalProps) {
  const { isDarkMode } = useDarkMode();
  const [providerType, setProviderType] = useState<ProviderType | null>(null);
  const [claudeMode, setClaudeMode] = useState<"preset" | "custom">("preset");
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [claudeForm, setClaudeForm] = useState({
    name: "",
    websiteUrl: "",
    apiKey: "",
    customConfig: JSON.stringify(generateDefaultConfig(), null, 2),
  });
  const [codexForm, setCodexForm] = useState({
    providerName: "",
    upstreamUrl: "https://token-plan-sgp.xiaomimimo.com/v1",
    apiKey: "",
    modelName: "",
    websiteUrl: "",
  });
  const [error, setError] = useState("");

  const handlePresetSelect = (presetIndex: number) => {
    const preset = presetProviders[presetIndex];
    setClaudeForm({
      name: preset.name,
      websiteUrl: preset.websiteUrl || "",
      apiKey: "",
      customConfig: JSON.stringify(preset.settingsConfig, null, 2),
    });
    setSelectedPreset(presetIndex.toString());
    setError("");
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(claudeForm.customConfig);
      const formatted = JSON.stringify(parsed, null, 2);
      setClaudeForm((prev) => ({ ...prev, customConfig: formatted }));
      setError("");
    } catch {
      setError("JSON 格式错误，无法格式化");
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (providerType === "codex") {
        const providerName = codexForm.providerName.trim();
        const upstreamUrl = codexForm.upstreamUrl.trim();
        const apiKey = codexForm.apiKey.trim();
        const modelName = codexForm.modelName.trim();

        if (!providerName || !upstreamUrl || !apiKey || !modelName) {
          setError("请完整填写 Codex 供应商信息");
          return;
        }

        onAdd({
          name: providerName,
          providerType: "codex",
          codexConfig: {
            providerName,
            upstreamUrl,
            apiKey,
            modelName,
          },
          websiteUrl: codexForm.websiteUrl.trim() || undefined,
        });
        return;
      }

      let settingsConfig;
      if (claudeMode === "preset" && selectedPreset) {
        const preset = presetProviders[Number.parseInt(selectedPreset, 10)];
        settingsConfig = { ...preset.settingsConfig };

        if (claudeForm.apiKey.trim()) {
          settingsConfig.env = {
            ...settingsConfig.env,
            ANTHROPIC_AUTH_TOKEN: claudeForm.apiKey.trim(),
          };
        }
      } else {
        settingsConfig = JSON.parse(claudeForm.customConfig);
      }

      onAdd({
        name: claudeForm.name.trim(),
        providerType: "claude",
        settingsConfig,
        websiteUrl: claudeForm.websiteUrl.trim() || undefined,
      });
    } catch (submitError) {
      setError(`配置格式错误，请检查输入: ${submitError}`);
    }
  };

  const renderTypeSelection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading text-foreground mb-4">
          选择供应商类型
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Card
            className="cursor-pointer p-0 transition-colors hover:ring-2 hover:ring-border"
            onClick={() => {
              setProviderType("claude");
              setClaudeMode("preset");
              setError("");
            }}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-foreground">Claude</h4>
                <Badge variant="default">现有逻辑</Badge>
              </div>
              <p className="text-sm text-foreground opacity-80">
                管理 Claude settings.json 供应商配置，兼容当前 API Gateway。
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer p-0 transition-colors hover:ring-2 hover:ring-border"
            onClick={() => {
              setProviderType("codex");
              setError("");
            }}
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-foreground">Codex</h4>
                <Badge variant="neutral">新增逻辑</Badge>
              </div>
              <p className="text-sm text-foreground opacity-80">
                添加只支持 OpenAI Chat API 的模型供应商，用于本地 Codex Gateway。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onClose} variant="neutral">
          取消
        </Button>
      </DialogFooter>
    </div>
  );

  const renderClaudePreset = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-heading text-foreground mb-4">
          选择 Claude 供应商预设
        </h3>
        <div className="space-y-3">
          {presetProviders.map((preset, index) => (
            <Card
              key={preset.name}
              className={`cursor-pointer transition-colors p-0 ${
                selectedPreset === index.toString()
                  ? "ring-4 ring-main"
                  : "hover:ring-2 hover:ring-border"
              }`}
              onClick={() => handlePresetSelect(index)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading text-foreground">{preset.name}</h4>
                  {preset.websiteUrl && <Badge variant="default">有官网</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedPreset && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="claude-apikey">
              API Key（可选，不填写将使用默认占位符）
            </Label>
            <Input
              id="claude-apikey"
              type="password"
              value={claudeForm.apiKey}
              onChange={(e) =>
                setClaudeForm((prev) => ({ ...prev, apiKey: e.target.value }))
              }
              placeholder="输入您的 API Key"
            />
          </div>
        )}
      </div>

      <DialogFooter className="flex justify-between">
        <div className="flex gap-3">
          <Button type="button" onClick={() => setProviderType(null)} variant="neutral">
            返回类型
          </Button>
          <Button type="button" onClick={() => setClaudeMode("custom")} variant="neutral">
            自定义配置
          </Button>
        </div>
        <div className="flex gap-3">
          <Button type="button" onClick={onClose} variant="neutral">
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedPreset} className="disabled:opacity-50">
            添加
          </Button>
        </div>
      </DialogFooter>
    </div>
  );

  const renderClaudeCustom = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="claude-name">供应商名称 *</Label>
          <Input
            id="claude-name"
            type="text"
            required
            value={claudeForm.name}
            onChange={(e) =>
              setClaudeForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="输入供应商名称"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="claude-website">官网地址（可选）</Label>
          <Input
            id="claude-website"
            type="url"
            value={claudeForm.websiteUrl}
            onChange={(e) =>
              setClaudeForm((prev) => ({ ...prev, websiteUrl: e.target.value }))
            }
            placeholder="https://example.com"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="claude-config">配置 JSON *</Label>
            <Button type="button" variant="ghost" size="sm" onClick={handleFormatJson} className="gap-2">
              <Wand2 size={14} />
              格式化
            </Button>
          </div>
          <JsonEditor
            value={claudeForm.customConfig}
            onChange={(value) =>
              setClaudeForm((prev) => ({ ...prev, customConfig: value }))
            }
            isDarkMode={isDarkMode}
            className={error ? "ring-2 ring-red-500" : ""}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <DialogFooter className="flex justify-between">
        <div className="flex gap-3">
          <Button type="button" onClick={() => setProviderType(null)} variant="neutral">
            返回类型
          </Button>
          <Button type="button" onClick={() => setClaudeMode("preset")} variant="neutral">
            返回预设
          </Button>
        </div>
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
  );

  const renderCodexForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="codex-provider-name">供应商名称 *</Label>
          <Input
            id="codex-provider-name"
            type="text"
            required
            value={codexForm.providerName}
            onChange={(e) =>
              setCodexForm((prev) => ({ ...prev, providerName: e.target.value }))
            }
            placeholder="例如 Xiaomi MiMo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codex-upstream-url">上游地址 *</Label>
          <Input
            id="codex-upstream-url"
            type="url"
            required
            value={codexForm.upstreamUrl}
            onChange={(e) =>
              setCodexForm((prev) => ({ ...prev, upstreamUrl: e.target.value }))
            }
            placeholder="https://token-plan-sgp.xiaomimimo.com/v1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codex-api-key">API Key *</Label>
          <Input
            id="codex-api-key"
            type="password"
            required
            value={codexForm.apiKey}
            onChange={(e) =>
              setCodexForm((prev) => ({ ...prev, apiKey: e.target.value }))
            }
            placeholder="输入供应商 API Key"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codex-model-name">模型名称 *</Label>
          <Input
            id="codex-model-name"
            type="text"
            required
            value={codexForm.modelName}
            onChange={(e) =>
              setCodexForm((prev) => ({ ...prev, modelName: e.target.value }))
            }
            placeholder="例如 mimo-v2-pro"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codex-website">官网地址（可选）</Label>
          <Input
            id="codex-website"
            type="url"
            value={codexForm.websiteUrl}
            onChange={(e) =>
              setCodexForm((prev) => ({ ...prev, websiteUrl: e.target.value }))
            }
            placeholder="https://example.com"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <DialogFooter className="flex justify-between">
        <Button type="button" onClick={() => setProviderType(null)} variant="neutral">
          返回类型
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
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加供应商</DialogTitle>
        </DialogHeader>

        {!providerType && renderTypeSelection()}
        {providerType === "claude" && claudeMode === "preset" && renderClaudePreset()}
        {providerType === "claude" && claudeMode === "custom" && renderClaudeCustom()}
        {providerType === "codex" && renderCodexForm()}
      </DialogContent>
    </Dialog>
  );
}

export default AddProviderModal;
