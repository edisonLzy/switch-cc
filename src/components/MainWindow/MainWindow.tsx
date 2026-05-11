import { useState, useEffect, useRef } from "react";
import {
  ApiGatewayLogEntry,
  ApiGatewayStatus,
  CodexGatewayStatus,
  Provider,
  getProviderType,
  isClaudeProvider,
} from "../../types";
import ProviderList from "./ProviderList";
import AddProviderModal from "./AddProviderModal";
import EditProviderModal from "./EditProviderModal";
import { ConfirmDialog } from "./ConfirmDialog";
import SettingsModal from "./SettingsModal";
import ClaudeConfigModal from "./ClaudeConfigModal";
import ConfigSyncModal from "./ConfigSyncModal";
import ApiGatewayLogModal from "./ApiGatewayLogModal";
import { UpdateBadge } from "./UpdateBadge";
import { Plus, Settings, Moon, Sun, Eye, Cloud, Waypoints, Bot } from "lucide-react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { useDarkMode } from "../../hooks/useDarkMode";
import { extractErrorMessage } from "../../utils/errorUtils";
import { api } from "../../lib/tauri-api";

function MainWindow() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [currentProviderId, setCurrentProviderId] = useState<string>("");
  const [currentCodexProviderId, setCurrentCodexProviderId] = useState<string>("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClaudeConfigOpen, setIsClaudeConfigOpen] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isApiGatewayLogOpen, setIsApiGatewayLogOpen] = useState(false);
  const [isCodexGatewayLogOpen, setIsCodexGatewayLogOpen] = useState(false);
  const [apiGatewayStatus, setApiGatewayStatus] = useState<ApiGatewayStatus | null>(null);
  const [codexGatewayStatus, setCodexGatewayStatus] = useState<CodexGatewayStatus | null>(null);
  const [apiGatewayLogs, setApiGatewayLogs] = useState<ApiGatewayLogEntry[]>([]);
  const [codexGatewayLogs, setCodexGatewayLogs] = useState<ApiGatewayLogEntry[]>([]);
  const [isApiGatewayPending, setIsApiGatewayPending] = useState(false);
  const [isCodexGatewayPending, setIsCodexGatewayPending] = useState(false);
  const [isCodexGatewayDiskLoggingPending, setIsCodexGatewayDiskLoggingPending] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 设置通知的辅助函数
  const showNotification = (
    message: string,
    type: "success" | "error",
    duration = 3000,
  ) => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 立即显示通知
    setNotification({ message, type });
    setIsNotificationVisible(true);

    // 设置淡出定时器
    timeoutRef.current = setTimeout(() => {
      setIsNotificationVisible(false);
      // 等待淡出动画完成后清除通知
      setTimeout(() => {
        setNotification(null);
        timeoutRef.current = null;
      }, 300); // 与CSS动画时间匹配
    }, duration);
  };

  // 加载供应商列表
  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupLogListener = async () => {
      try {
        unlisten = await api.onApiGatewayLog((entry) => {
          setApiGatewayLogs((currentLogs) => {
            const nextLogs = [...currentLogs, entry];
            return nextLogs.slice(-100);
          });
        });
      } catch (error) {
        console.error("设置 API Gateway 日志监听失败:", error);
      }
    };

    setupLogListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupLogListener = async () => {
      try {
        unlisten = await api.onCodexGatewayLog((entry) => {
          setCodexGatewayLogs((currentLogs) => {
            const nextLogs = [...currentLogs, entry];
            return nextLogs.slice(-100);
          });
        });
      } catch (error) {
        console.error("设置 Codex Gateway 日志监听失败:", error);
      }
    };

    setupLogListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 监听托盘切换事件
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await api.onProviderSwitched(async (data) => {
          if (import.meta.env.DEV) {
            console.log("收到供应商切换事件:", data);
          }
          await loadProviders();
        });
      } catch (error) {
        console.error("设置供应商切换监听器失败:", error);
      }
    };

    setupListener();

    // 清理监听器
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const loadProviders = async () => {
    try {
      const [
        loadedProviders,
        currentId,
        currentCodexId,
        gatewayStatus,
        loadedCodexGatewayStatus,
      ] = await Promise.all([
        api.getProviders(),
        api.getCurrentProvider(),
        api.getCurrentCodexProvider(),
        api.getApiGatewayStatus(),
        api.getCodexGatewayStatus(),
      ]);
      setProviders(loadedProviders);
      setCurrentProviderId(currentId);
      setCurrentCodexProviderId(currentCodexId);
      setApiGatewayStatus(gatewayStatus);
      setCodexGatewayStatus(loadedCodexGatewayStatus);

      // 如果供应商列表为空，尝试自动从 live 导入一条默认供应商
      if (Object.keys(loadedProviders).length === 0) {
        await handleAutoImportDefault();
      }
    } catch (error) {
      console.error("加载供应商列表失败:", error);
      showNotification("加载供应商列表失败", "error");
    }
  };

  // 生成唯一ID
  const generateId = () => {
    return crypto.randomUUID();
  };

  const handleAddProvider = async (provider: Omit<Provider, "id">) => {
    try {
      let newProvider: Provider;

      if ("codexConfig" in provider && provider.codexConfig) {
        newProvider = {
          id: generateId(),
          name: provider.name,
          websiteUrl: provider.websiteUrl,
          category: provider.category,
          createdAt: Date.now(),
          providerType: "codex",
          codexConfig: provider.codexConfig,
        };
      } else if ("settingsConfig" in provider && provider.settingsConfig) {
        newProvider = {
          id: generateId(),
          name: provider.name,
          websiteUrl: provider.websiteUrl,
          category: provider.category,
          createdAt: Date.now(),
          providerType: "claude",
          settingsConfig: provider.settingsConfig,
        };
      } else {
        throw new Error("供应商配置无效");
      }

      await api.addProvider(newProvider);
      await loadProviders();
      setIsAddModalOpen(false);
      showNotification("供应商添加成功", "success");
      // 更新托盘菜单
      await api.updateTrayMenu();
    } catch (error) {
      console.error("添加供应商失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`添加失败：${errorMessage}`, "error");
    }
  };

  const handleEditProvider = async (provider: Provider) => {
    try {
      await api.updateProvider(provider);
      await loadProviders();
      setEditingProviderId(null);
      showNotification("供应商配置已保存", "success", 2000);
      // 更新托盘菜单
      await api.updateTrayMenu();
    } catch (error) {
      console.error("更新供应商失败:", error);
      setEditingProviderId(null);
      const errorMessage = extractErrorMessage(error);
      const message = errorMessage
        ? `保存失败：${errorMessage}`
        : "保存失败，请重试";
      showNotification(message, "error", errorMessage ? 6000 : 3000);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    const provider = providers[id];
    setConfirmDialog({
      isOpen: true,
      title: "删除供应商",
      message: `确定要删除供应商 "${provider?.name}" 吗？此操作无法撤销。`,
      onConfirm: async () => {
        try {
          await api.deleteProvider(id);
          await loadProviders();
          setConfirmDialog(null);
          showNotification("供应商删除成功", "success");
          await api.updateTrayMenu();
        } catch (error) {
          console.error("删除供应商失败:", error);
          const errorMessage = extractErrorMessage(error);
          showNotification(`删除失败：${errorMessage}`, "error");
        }
      },
    });
  };

  const handleSwitchProvider = async (provider: Provider) => {
    try {
      if (getProviderType(provider) === "codex") {
        const success = await api.switchCodexProvider(provider.id);
        if (success) {
          setCurrentCodexProviderId(provider.id);
          const gatewayStatus = await api.getCodexGatewayStatus();
          setCodexGatewayStatus(gatewayStatus);
          showNotification(
            gatewayStatus.installedInCodexConfig
              ? "切换成功！Codex 供应商和本地 gateway 配置已同步"
              : "切换成功！Codex 供应商已更新，可在 Codex Gateway 弹窗中添加本地 gateway",
            "success",
            2500,
          );
        } else {
          showNotification("切换失败，请检查配置", "error");
        }
        return;
      }

      const success = await api.switchProvider(provider.id);
      if (success) {
        setCurrentProviderId(provider.id);
        const gatewayStatus = await api.getApiGatewayStatus();
        setApiGatewayStatus(gatewayStatus);
        showNotification(
          "切换成功！Claude Code 配置已更新，请重启 Claude Code 终端以生效",
          "success",
          2000,
        );
        await api.updateTrayMenu();
      } else {
        showNotification("切换失败，请检查配置", "error");
      }
    } catch (error) {
      console.error("切换供应商失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`切换失败：${errorMessage}`, "error");
    }
  };

  const handleToggleApiGateway = async (checked: boolean) => {
    try {
      setIsApiGatewayPending(true);
      const status = await api.setApiGatewayEnabled(checked);
      setApiGatewayStatus(status);
      showNotification(
        checked
          ? `API Gateway 已启动，目标供应商 ${status.targetProviderName ?? "当前供应商"}，本地地址 ${status.localBaseUrl}`
          : "API Gateway 已关闭；Claude Code 配置保持当前供应商",
        "success",
        2500,
      );
    } catch (error) {
      console.error("切换 API Gateway 失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`API Gateway 操作失败：${errorMessage}`, "error");
    } finally {
      setIsApiGatewayPending(false);
    }
  };

  const handleToggleCodexGateway = async (checked: boolean) => {
    try {
      setIsCodexGatewayPending(true);
      const status = await api.setCodexGatewayEnabled(checked);
      setCodexGatewayStatus(status);
      showNotification(
        checked
          ? `Codex Gateway 已启动，目标供应商 ${status.targetProviderName ?? "当前供应商"}，本地地址 ${status.localBaseUrl}`
          : "Codex Gateway 已关闭；已写入的 Codex 本地 provider 配置会保留",
        "success",
        2500,
      );
    } catch (error) {
      console.error("切换 Codex Gateway 失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`Codex Gateway 操作失败：${errorMessage}`, "error");
    } finally {
      setIsCodexGatewayPending(false);
    }
  };

  const handleInstallCodexGateway = async () => {
    try {
      const status = await api.installCodexGatewayProvider();
      setCodexGatewayStatus(status);
      showNotification(
        `已将本地 gateway 写入 ${status.codexConfigPath}`,
        "success",
        2500,
      );
    } catch (error) {
      console.error("写入 Codex Gateway 配置失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`写入 Codex 配置失败：${errorMessage}`, "error");
    }
  };

  const handleToggleCodexGatewayDiskLogging = async (checked: boolean) => {
    try {
      setIsCodexGatewayDiskLoggingPending(true);
      const status = await api.setCodexGatewayDiskLoggingEnabled(checked);
      setCodexGatewayStatus(status);
      showNotification(
        checked
          ? `已开启 Codex Gateway 日志落盘，目录 ${status.logDirectory}`
          : "已关闭 Codex Gateway 日志落盘",
        "success",
        2500,
      );
    } catch (error) {
      console.error("切换 Codex Gateway 日志落盘失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`日志落盘设置失败：${errorMessage}`, "error");
    } finally {
      setIsCodexGatewayDiskLoggingPending(false);
    }
  };

  // 自动从 live 导入一条默认供应商（仅首次初始化时）
  const handleAutoImportDefault = async () => {
    try {
      const result = await api.importCurrentConfigAsDefault();
      if (result.success) {
        await loadProviders();
        showNotification("已从现有配置创建默认供应商", "success", 3000);
        // 更新托盘菜单
        await api.updateTrayMenu();
      }
    } catch (error) {
      console.error("自动导入默认配置失败:", error);
      // 静默处理，不影响用户体验
    }
  };

  // 处理同步完成
  const handleSyncComplete = async (syncedProviders: Provider[]) => {
    try {
      // 获取现有的供应商列表以检查哪些已存在
      const existingProviders = await api.getProviders();

      // 保存每个配置到本地存储
      for (const provider of syncedProviders) {
        try {
          if (existingProviders[provider.id]) {
            // 已存在，执行更新
            await api.updateProvider(provider);
          } else {
            // 不存在，执行添加
            await api.addProvider(provider);
          }
        } catch (error) {
          console.error("保存配置失败:", provider.id, error);
        }
      }

      // 重新加载配置
      await loadProviders();

      // 更新托盘菜单
      await api.updateTrayMenu();

      showNotification("配置同步成功！", "success");
    } catch (error) {
      console.error("同步完成处理失败:", error);
      const errorMessage = extractErrorMessage(error);
      showNotification(`同步失败：${errorMessage}`, "error");
    }
  };

  const claudeProviderCount = Object.values(providers).filter(isClaudeProvider).length;
  const codexProviderCount = Object.values(providers).filter(
    (provider) => getProviderType(provider) === "codex",
  ).length;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* 顶部导航区域 - 固定高度 */}
      <header className="flex-shrink-0 bg-background border-b-2 border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleDarkMode}
              variant="neutral"
              size="icon"
              title={isDarkMode ? "切换到亮色模式" : "切换到暗色模式"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button
              onClick={() => setIsClaudeConfigOpen(true)}
              variant="neutral"
              size="icon"
              title="查看当前 Claude 配置"
            >
              <Eye size={18} />
            </Button>
            <Button
              onClick={() => setShowSyncModal(true)}
              variant="neutral"
              size="icon"
              title="配置云同步"
            >
              <Cloud size={18} />
            </Button>
            <Button
              onClick={() => setIsSettingsOpen(true)}
              variant="neutral"
              size="icon"
              title="设置"
            >
              <Settings size={18} />
            </Button>
            <UpdateBadge onClick={() => setIsSettingsOpen(true)} />
          </div>

          <div className="flex items-center gap-4 isolate">
            <div
              className={`relative z-0 flex min-w-0 cursor-pointer items-center gap-2 rounded-base border-2 px-3 py-2 text-slate-900 shadow-shadow transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                apiGatewayStatus?.enabled
                  ? "gateway-rainbow-border border-sky-500 bg-sky-100 hover:bg-sky-200"
                  : "border-border bg-sky-100 hover:bg-sky-200"
              }`}
              onClick={() => setIsApiGatewayLogOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsApiGatewayLogOpen(true);
                }
              }}
              aria-label="查看 API Gateway 日志"
            >
              <div className="flex shrink-0 items-center gap-2">
                <Waypoints size={15} />
                <span className="text-sm font-medium">API Gateway</span>
              </div>
              <Checkbox
                checked={apiGatewayStatus?.enabled ?? false}
                disabled={isApiGatewayPending || claudeProviderCount === 0}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => handleToggleApiGateway(checked === true)}
                aria-label="启用 API Gateway"
                className="shrink-0 border-gray-600 bg-white"
              />
            </div>
            <div
              className={`relative z-0 flex min-w-0 cursor-pointer items-center gap-2 rounded-base border-2 px-3 py-2 text-slate-900 shadow-shadow transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 ${
                codexGatewayStatus?.enabled
                  ? "gateway-rainbow-border border-emerald-500 bg-emerald-100 hover:bg-emerald-200"
                  : "border-border bg-emerald-100 hover:bg-emerald-200"
              }`}
              onClick={() => setIsCodexGatewayLogOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsCodexGatewayLogOpen(true);
                }
              }}
              aria-label="查看 Codex Gateway 日志"
            >
              <div className="flex shrink-0 items-center gap-2">
                <Bot size={15} />
                <span className="text-sm font-medium">Codex Gateway</span>
              </div>
              <Checkbox
                checked={codexGatewayStatus?.enabled ?? false}
                disabled={isCodexGatewayPending || codexProviderCount === 0}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => handleToggleCodexGateway(checked === true)}
                aria-label="启用 Codex Gateway"
                className="shrink-0 border-gray-600 bg-white"
              />
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2"
            >
              <Plus size={16} />
              添加供应商
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区域 - 独立滚动 */}
      <main className="flex-1 overflow-y-scroll">
        <div className="pt-3 px-6 pb-6">
          <div className="max-w-4xl mx-auto">
            {/* 通知组件 - 相对于视窗定位 */}
            {notification && (
              <div
                className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-base border-2 border-border shadow-shadow transition-all duration-300 ${
                  notification.type === "error"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                } ${isNotificationVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}
              >
                {notification.message}
              </div>
            )}

            <ProviderList
              providers={providers}
              currentClaudeProviderId={currentProviderId}
              currentCodexProviderId={currentCodexProviderId}
              onSwitch={handleSwitchProvider}
              onDelete={handleDeleteProvider}
              onEdit={setEditingProviderId}
              onNotify={showNotification}
            />
          </div>
        </div>
      </main>

      {isAddModalOpen && (
        <AddProviderModal
          onAdd={handleAddProvider}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {editingProviderId && providers[editingProviderId] && (
        <EditProviderModal
          provider={providers[editingProviderId]}
          onSave={handleEditProvider}
          onClose={() => setEditingProviderId(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}

      {isClaudeConfigOpen && (
        <ClaudeConfigModal
          isOpen={isClaudeConfigOpen}
          onClose={() => setIsClaudeConfigOpen(false)}
        />
      )}

      {isApiGatewayLogOpen && (
        <ApiGatewayLogModal
          isOpen={isApiGatewayLogOpen}
          onClose={() => setIsApiGatewayLogOpen(false)}
          title="API Gateway 日志"
          localBaseUrl={apiGatewayStatus?.localBaseUrl}
          details={
            apiGatewayStatus?.targetProviderName
              ? [
                  `目标供应商 ${apiGatewayStatus.targetProviderName}`,
                  apiGatewayStatus.targetBaseUrl
                    ? `上游地址 ${apiGatewayStatus.targetBaseUrl}`
                    : "",
                ].filter(Boolean)
              : []
          }
          logs={apiGatewayLogs}
        />
      )}

      {isCodexGatewayLogOpen && (
        <ApiGatewayLogModal
          isOpen={isCodexGatewayLogOpen}
          onClose={() => setIsCodexGatewayLogOpen(false)}
          title="Codex Gateway 日志"
          localBaseUrl={codexGatewayStatus?.localBaseUrl}
          details={[
            codexGatewayStatus?.targetProviderName
              ? `目标供应商 ${codexGatewayStatus.targetProviderName}`
              : "",
            codexGatewayStatus?.targetModelName
              ? `目标模型 ${codexGatewayStatus.targetModelName}`
              : "",
            codexGatewayStatus?.targetBaseUrl
              ? `上游地址 ${codexGatewayStatus.targetBaseUrl}`
              : "",
            codexGatewayStatus?.logDirectory
              ? `本地日志目录 ${codexGatewayStatus.logDirectory}${codexGatewayStatus.diskLoggingEnabled ? "" : " (已关闭)"}`
              : "",
            codexGatewayStatus
              ? `Codex 配置 ${codexGatewayStatus.codexConfigPath}`
              : "",
            codexGatewayStatus
              ? codexGatewayStatus.installedInCodexConfig
                ? `已安装本地 provider: ${codexGatewayStatus.providerKey}`
                : "尚未写入本地 provider 配置"
              : "",
          ].filter(Boolean)}
          logs={codexGatewayLogs}
          actionLabel="Add Local Gateway"
          onAction={handleInstallCodexGateway}
          actionDisabled={codexProviderCount === 0}
          diskLoggingEnabled={codexGatewayStatus?.diskLoggingEnabled ?? false}
          onDiskLoggingChange={handleToggleCodexGatewayDiskLogging}
          diskLoggingDisabled={isCodexGatewayDiskLoggingPending}
          diskLoggingDescription={
            codexGatewayStatus?.diskLoggingEnabled
              ? `已开启后，新的转发日志会追加写入 ${codexGatewayStatus.logDirectory}`
              : `默认关闭。开启后会将所有转发日志写入 ${codexGatewayStatus?.logDirectory ?? "~/.switchcc/logs"}`
          }
        />
      )}

      {showSyncModal && (
        <ConfigSyncModal
          providers={providers}
          onClose={() => setShowSyncModal(false)}
          onSyncComplete={handleSyncComplete}
        />
      )}
    </div>
  );
}

export default MainWindow;
