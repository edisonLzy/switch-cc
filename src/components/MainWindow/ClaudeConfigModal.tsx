import { useState, useEffect } from "react";
import { Eye, Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { api } from "../../lib/tauri-api";

interface ClaudeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ClaudeConfigModal({ isOpen, onClose }: ClaudeConfigModalProps) {
  const [configData, setConfigData] = useState<{
    exists: boolean;
    content?: any;
    path: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClaudeConfig();
    }
  }, [isOpen]);

  const loadClaudeConfig = async () => {
    try {
      setIsLoading(true);
      const config = await api.getClaudeConfig();
      setConfigData(config);
    } catch (error) {
      console.error("获取Claude配置失败:", error);
      setConfigData({ exists: false, path: "未知路径" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyConfig = async () => {
    if (configData?.content) {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(configData.content, null, 2),
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("复制失败:", error);
      }
    }
  };

  const handleCopyPath = async () => {
    if (configData?.path) {
      try {
        await navigator.clipboard.writeText(configData.path);
        setPathCopied(true);
        setTimeout(() => setPathCopied(false), 2000);
      } catch (error) {
        console.error("复制路径失败:", error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Eye size={20} />
            <DialogTitle>Claude Code 配置信息</DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-main border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p>加载配置信息中...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 配置状态 */}
            <Card>
              <CardHeader>
                <CardTitle>配置状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground/70">配置文件存在：</span>
                    <Badge
                      variant={configData?.exists ? "default" : "destructive"}
                    >
                      {configData?.exists ? "是" : "否"}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <span className="text-foreground/70">配置路径：</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-foreground/80 flex-1 truncate">
                        {configData?.path}
                      </span>
                      <Button
                        onClick={handleCopyPath}
                        variant="ghost"
                        size="sm"
                        className="gap-2 flex-shrink-0"
                      >
                        {pathCopied ? (
                          <>
                            <Check size={14} />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            复制
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 配置内容 */}
            {configData?.exists && configData.content ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>配置内容</CardTitle>
                    <Button
                      onClick={handleCopyConfig}
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                    >
                      {copied ? (
                        <>
                          <Check size={16} />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          复制配置
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-secondary-background border-2 border-border rounded-base p-4 max-h-96 overflow-auto">
                    <pre className="text-sm font-mono text-foreground/80 whitespace-pre-wrap break-all">
                      {JSON.stringify(configData.content, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <div className="text-foreground/40 mb-4">
                    <Eye size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-heading text-foreground mb-2">
                    配置文件不存在
                  </h3>
                  <p className="text-foreground/60">
                    Claude Code 配置文件未找到，请确保已正确安装并配置 Claude
                    Code
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 说明信息 */}
            <Card>
              <CardHeader>
                <CardTitle>说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-foreground/70 space-y-2">
                  <p>• 此配置信息显示当前 Claude Code 的实际配置内容</p>
                  <p>• 使用 Switch CC 切换供应商会修改此配置文件</p>
                  <p>• 切换后需要重启 Claude Code 终端才能生效</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ClaudeConfigModal;
