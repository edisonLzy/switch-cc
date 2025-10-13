import { useState, useEffect } from "react";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { Settings } from "../../types";
import { api } from "../../lib/tauri-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

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
      console.error("加载设置失败:", error);
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
      console.error("保存设置失败:", error);
      alert("保存设置失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckUpdates = async () => {
    try {
      await api.checkForUpdates();
    } catch (error) {
      console.error("检查更新失败:", error);
    }
  };

  if (isLoading) {
    return (
      <Dialog open>
        <DialogContent>
          <div className="p-6 text-center">
            <div className="w-8 h-8 border-4 border-main border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-foreground">加载设置中...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!settings) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="p-6 text-center">
            <p className="text-red-600">加载设置失败</p>
            <Button onClick={onClose} className="mt-4">
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon size={20} />
            <DialogTitle>应用设置</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* 托盘设置 */}
          <Card>
            <CardHeader>
              <CardTitle>系统托盘</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="showInTray"
                  checked={settings.showInTray}
                  onCheckedChange={(checked) =>
                    setSettings((prev) =>
                      prev ? { ...prev, showInTray: !!checked } : prev,
                    )
                  }
                />
                <Label htmlFor="showInTray" className="text-sm">
                  在系统托盘显示图标
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="minimizeToTray"
                  checked={settings.minimizeToTrayOnClose}
                  onCheckedChange={(checked) =>
                    setSettings((prev) =>
                      prev
                        ? { ...prev, minimizeToTrayOnClose: !!checked }
                        : prev,
                    )
                  }
                />
                <Label htmlFor="minimizeToTray" className="text-sm">
                  点击关闭按钮时最小化到托盘
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* MenuBar 设置 */}
          <Card>
            <CardHeader>
              <CardTitle>MenuBar 模式</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="enableMenuBar"
                  checked={settings.enableMenuBar}
                  onCheckedChange={(checked) =>
                    setSettings((prev) =>
                      prev ? { ...prev, enableMenuBar: !!checked } : prev,
                    )
                  }
                />
                <Label htmlFor="enableMenuBar" className="text-sm">
                  启用 MenuBar 快捷模式
                </Label>
              </div>
              <p className="text-xs text-foreground opacity-70 mt-2 ml-7">
                启用后可通过系统菜单栏快速切换供应商
              </p>
            </CardContent>
          </Card>

          {/* 配置路径 */}
          <Card>
            <CardHeader>
              <CardTitle>配置路径</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="claudeConfigDir">Claude 配置目录（可选）</Label>
                <Input
                  id="claudeConfigDir"
                  type="text"
                  value={settings.claudeConfigDir || ""}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            claudeConfigDir: e.target.value || undefined,
                          }
                        : prev,
                    )
                  }
                  placeholder="默认使用 ~/.claude"
                />
                <p className="text-xs text-foreground opacity-70">
                  留空使用默认路径 ~/.claude
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 应用信息 */}
          <Card>
            <CardHeader>
              <CardTitle>应用信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground opacity-70">版本:</span>
                  <Badge variant="neutral">1.0.0</Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-foreground opacity-70">构建于:</span>
                  <Badge variant="neutral">Tauri 2.8</Badge>
                </div>
              </div>
              <Button
                onClick={handleCheckUpdates}
                variant="neutral"
                className="w-full"
              >
                检查更新
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="neutral">
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className={isSaving ? "opacity-50" : ""}
          >
            <Save size={16} />
            {isSaving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsModal;
