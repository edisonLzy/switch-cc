import { useState } from "react";
import { Provider, isCodexProvider } from "../../types";
import { Save, Wand2, Copy } from "lucide-react";
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
import { useDarkMode } from "../../hooks/useDarkMode";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

interface EditProviderModalProps {
  provider: Provider;
  onSave: (provider: Provider) => void;
  onClose: () => void;
}

function EditProviderModal({
  provider,
  onSave,
  onClose,
}: EditProviderModalProps) {
  const { isDarkMode } = useDarkMode();
  const isCodex = isCodexProvider(provider);
  const [name, setName] = useState(provider.name);
  const [websiteUrl, setWebsiteUrl] = useState(provider.websiteUrl || "");
  const [configJson, setConfigJson] = useState(
    isCodex ? "" : JSON.stringify(provider.settingsConfig, null, 2),
  );
  const [providerName, setProviderName] = useState(
    isCodex ? provider.codexConfig.providerName : "",
  );
  const [upstreamUrl, setUpstreamUrl] = useState(
    isCodex ? provider.codexConfig.upstreamUrl : "",
  );
  const [apiKey, setApiKey] = useState(
    isCodex ? provider.codexConfig.apiKey : "",
  );
  const [modelName, setModelName] = useState(
    isCodex ? provider.codexConfig.modelName : "",
  );

  const [error, setError] = useState("");

  const handleFormatJson = () => {
    if (isCodex) {
      return;
    }

    try {
      const parsed = JSON.parse(configJson);
      const formatted = JSON.stringify(parsed, null, 2);
      setConfigJson(formatted);
      setError("");
    } catch (error) {
      setError("JSON 格式错误，无法格式化");
    }
  };

  const handleCopyConfig = async () => {
    if (isCodex) {
      return;
    }

    try {
      await writeText(configJson);
    } catch (error) {
      console.error("复制失败:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const updatedProvider: Provider = isCodex
        ? {
            ...provider,
            name: providerName.trim(),
            providerType: "codex",
            websiteUrl: websiteUrl.trim() || undefined,
            codexConfig: {
              providerName: providerName.trim(),
              upstreamUrl: upstreamUrl.trim(),
              apiKey: apiKey.trim(),
              modelName: modelName.trim(),
            },
          }
        : {
            ...provider,
            name: name.trim(),
            providerType: "claude",
            websiteUrl: websiteUrl.trim() || undefined,
            settingsConfig: JSON.parse(configJson),
          };

      onSave(updatedProvider);
    } catch (error) {
      setError("配置 JSON 格式错误，请检查语法");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>编辑供应商 - {provider.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {isCodex ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-codex-provider-name">供应商名称 *</Label>
                  <Input
                    id="edit-codex-provider-name"
                    type="text"
                    required
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-codex-upstream-url">上游地址 *</Label>
                  <Input
                    id="edit-codex-upstream-url"
                    type="url"
                    required
                    value={upstreamUrl}
                    onChange={(e) => setUpstreamUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-codex-api-key">API Key *</Label>
                  <Input
                    id="edit-codex-api-key"
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-codex-model-name">模型名称 *</Label>
                  <Input
                    id="edit-codex-model-name"
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-codex-website">官网地址（可选）</Label>
                  <Input
                    id="edit-codex-website"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">供应商名称 *</Label>
                  <Input
                    id="edit-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-website">官网地址（可选）</Label>
                  <Input
                    id="edit-website"
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-config">配置 JSON *</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyConfig}
                        className="gap-2"
                      >
                        <Copy size={14} />
                        复制配置
                      </Button>
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
                  </div>
                  <JsonEditor
                    value={configJson}
                    onChange={setConfigJson}
                    isDarkMode={isDarkMode}
                    className={error ? "ring-2 ring-red-500" : ""}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={onClose} variant="neutral">
              取消
            </Button>
            <Button type="submit">
              <Save size={16} />
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditProviderModal;
