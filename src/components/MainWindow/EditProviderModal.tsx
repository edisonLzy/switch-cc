import { useState } from "react";
import { Provider } from "../../types";
import { Save } from "lucide-react";
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
  const [formData, setFormData] = useState({
    name: provider.name,
    websiteUrl: provider.websiteUrl || "",
    configJson: JSON.stringify(provider.settingsConfig, null, 2),
  });

  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const settingsConfig = JSON.parse(formData.configJson);

      const updatedProvider: Provider = {
        ...provider,
        name: formData.name.trim(),
        websiteUrl: formData.websiteUrl.trim() || undefined,
        settingsConfig,
      };

      onSave(updatedProvider);
    } catch (error) {
      setError("配置 JSON 格式错误，请检查语法");
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑供应商 - {provider.name}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">供应商名称 *</Label>
              <Input
                id="edit-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-website">官网地址（可选）</Label>
              <Input
                id="edit-website"
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
              <Label htmlFor="edit-config">配置 JSON *</Label>
              <Textarea
                id="edit-config"
                required
                rows={12}
                value={formData.configJson}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    configJson: e.target.value,
                  }))
                }
                className={`font-mono text-sm ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
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
