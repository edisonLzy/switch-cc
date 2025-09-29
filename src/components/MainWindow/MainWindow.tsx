import { useState, useEffect, useRef } from "react";
import { Provider } from "../../types";
import ProviderList from "./ProviderList";
import AddProviderModal from "./AddProviderModal";
import EditProviderModal from "./EditProviderModal";
import { ConfirmDialog } from "./ConfirmDialog";
import SettingsModal from "./SettingsModal";
import ClaudeConfigModal from "./ClaudeConfigModal";
import { UpdateBadge } from "./UpdateBadge";
import { Plus, Settings, Moon, Sun, Eye } from "lucide-react";
import { Button } from "../ui/button";
import { useDarkMode } from "../../hooks/useDarkMode";
import { extractErrorMessage } from "../../utils/errorUtils";
import { api } from "../../lib/tauri-api";

function MainWindow() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [currentProviderId, setCurrentProviderId] = useState<string>("");
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
      const loadedProviders = await api.getProviders();
      const currentId = await api.getCurrentProvider();
      setProviders(loadedProviders);
      setCurrentProviderId(currentId);

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
      const newProvider: Provider = {
        ...provider,
        id: generateId(),
        createdAt: Date.now(),
      };
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
          // 更新托盘菜单
          await api.updateTrayMenu();
        } catch (error) {
          console.error("删除供应商失败:", error);
          const errorMessage = extractErrorMessage(error);
          showNotification(`删除失败：${errorMessage}`, "error");
        }
      },
    });
  };

  const handleSwitchProvider = async (id: string) => {
    try {
      const success = await api.switchProvider(id);
      if (success) {
        setCurrentProviderId(id);
        showNotification(
          "切换成功！请重启 Claude Code 终端以生效",
          "success",
          2000,
        );
        // 更新托盘菜单
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
              onClick={() => setIsSettingsOpen(true)}
              variant="neutral"
              size="icon"
              title="设置"
            >
              <Settings size={18} />
            </Button>
            <UpdateBadge onClick={() => setIsSettingsOpen(true)} />
          </div>

          <div className="flex items-center gap-4">
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
              currentProviderId={currentProviderId}
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
    </div>
  );
}

export default MainWindow;
