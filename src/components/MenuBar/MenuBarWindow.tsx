import { useState, useEffect, useRef } from "react";
import { Provider } from "../../types";
import { Settings, Monitor, Check, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Badge } from "../ui/badge";
import { api } from "../../lib/tauri-api";

function MenuBarWindow() {
  const [providers, setProviders] = useState<Record<string, Provider>>({});
  const [currentProviderId, setCurrentProviderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const providerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    loadProviders();
    setupEventListeners();
  }, []);

  // 键盘导航
  useEffect(() => {
    const providersList = Object.values(providers);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (providersList.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < providersList.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedProvider = providersList[selectedIndex];
        if (selectedProvider && selectedProvider.id !== currentProviderId) {
          handleSwitchProvider(selectedProvider.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [providers, selectedIndex, currentProviderId]);

  // 滚动到选中的项目
  useEffect(() => {
    if (providerRefs.current[selectedIndex]) {
      providerRefs.current[selectedIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  const loadProviders = async () => {
    try {
      setIsLoading(true);
      const loadedProviders = await api.getProviders();
      const currentId = await api.getCurrentProvider();
      setProviders(loadedProviders);
      setCurrentProviderId(currentId);
    } catch (error) {
      console.error("加载供应商列表失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupEventListeners = async () => {
    try {
      // 监听供应商切换事件
      await api.onProviderSwitched(async () => {
        await loadProviders();
      });
    } catch (error) {
      console.error("设置事件监听器失败:", error);
    }
  };

  const handleSwitchProvider = async (providerId: string) => {
    try {
      const success = await api.switchProvider(providerId);
      if (success) {
        setCurrentProviderId(providerId);
        // 供应商切换成功后会自动触发 provider-switched 事件
        // 该事件会更新托盘菜单和触发重新加载
        // MenuBar模式下可以自动隐藏窗口
        setTimeout(() => {
          api.hideMenuBar();
        }, 500);
      }
    } catch (error) {
      console.error("切换供应商失败:", error);
    }
  };

  const switchToMainWindow = async () => {
    try {
      await api.setAppMode("main");
    } catch (error) {
      console.error("切换到主界面失败:", error);
    }
  };

  const openSettings = async () => {
    try {
      // 在MenuBar模式下，设置需要切换到主界面
      await api.setAppMode("main");
      // 这里可以发送事件通知主界面打开设置
    } catch (error) {
      console.error("打开设置失败:", error);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-80 shadow-shadow">
        <CardContent className="p-4 text-center">
          <div className="w-6 h-6 border-2 border-main border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-foreground opacity-70">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  const providersList = Object.values(providers);
  const currentProvider = providers[currentProviderId];

  return (
    <Card className="w-80 shadow-shadow overflow-hidden">
      {/* 头部 */}
      <CardHeader className="px-4 py-3 bg-secondary-background border-b-2 border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-main rounded-full"></div>
            <h3 className="font-heading text-foreground">供应商切换</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={openSettings}
              variant="neutral"
              size="icon"
              className="h-7 w-7"
              title="设置"
            >
              <Settings size={14} />
            </Button>
            <Button
              onClick={switchToMainWindow}
              variant="neutral"
              size="icon"
              className="h-7 w-7"
              title="打开主界面"
            >
              <Monitor size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* 当前供应商显示 */}
      {currentProvider && (
        <div className="px-4 py-3 bg-main/20 border-b-2 border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-heading text-foreground">
              当前: {currentProvider.name}
            </span>
          </div>
          {currentProvider.websiteUrl && (
            <Button
              onClick={() => api.openExternal(currentProvider.websiteUrl!)}
              variant="ghost"
              className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800 mt-1"
            >
              访问官网 →
            </Button>
          )}
        </div>
      )}

      {/* 供应商列表 */}
      <CardContent className="p-0 max-h-96 overflow-y-auto">
        {providersList.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-foreground opacity-40 mb-2">
              <Settings size={32} className="mx-auto" />
            </div>
            <p className="text-sm text-foreground opacity-70 mb-4">
              还没有配置供应商
            </p>
            <Button onClick={switchToMainWindow} size="sm">
              去添加供应商
            </Button>
          </div>
        ) : (
          <div className="py-2">
            {providersList.map((provider, index) => (
              <Button
                key={provider.id}
                ref={(el) => {
                  providerRefs.current[index] = el;
                }}
                onClick={() => handleSwitchProvider(provider.id)}
                variant="ghost"
                className={`w-full px-4 py-3 h-auto justify-start hover:bg-secondary-background hover:shadow-shadow hover:border-border rounded-none border-2 border-transparent group transition-all duration-200 ${
                  provider.id === currentProviderId
                    ? "bg-main/20 border-main"
                    : index === selectedIndex
                      ? "bg-blue-100 dark:bg-blue-900/30 border-blue-500"
                      : ""
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {provider.id === currentProviderId ? (
                      <Check size={16} className="text-main flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <p
                        className={`text-sm font-heading truncate ${
                          provider.id === currentProviderId
                            ? "text-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {provider.name}
                      </p>
                    </div>
                  </div>
                  {provider.id !== currentProviderId && (
                    <ChevronRight
                      size={16}
                      className="text-foreground opacity-40 group-hover:opacity-70 flex-shrink-0"
                    />
                  )}
                </div>
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      {/* 底部操作 */}
      <div className="px-4 py-3 bg-secondary-background border-t-2 border-border">
        <div className="flex items-center justify-between text-xs text-foreground opacity-70">
          <Badge variant="neutral" className="text-xs">
            {providersList.length} 个供应商
          </Badge>
          <Button
            onClick={switchToMainWindow}
            variant="ghost"
            className="p-0 h-auto text-xs hover:text-main transition-colors"
          >
            管理供应商 →
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default MenuBarWindow;
