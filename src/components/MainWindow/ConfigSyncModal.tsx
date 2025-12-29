import { useState } from "react";
import {
  Cloud,
  Upload,
  Download,
  RefreshCw,
  Loader2,
  LogIn,
} from "lucide-react";
import { Provider } from "../../types";
import { configSyncAPI } from "../../lib/config-sync-api";
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

interface ConfigSyncModalProps {
  providers: Record<string, Provider>;
  onClose: () => void;
  onSyncComplete: (providers: Provider[]) => void;
}

type SyncStatus =
  | "idle"
  | "connecting"
  | "uploading"
  | "downloading"
  | "syncing"
  | "success"
  | "error"
  | "logging_in";

// Constants
const AUTO_CLOSE_DELAY = 1500; // milliseconds

function ConfigSyncModal({
  providers,
  onClose,
  onSyncComplete,
}: ConfigSyncModalProps) {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [remoteConfigCount, setRemoteConfigCount] = useState<number>(0);

  const localConfigCount = Object.keys(providers).length;

  const showMessage = (msg: string, statusType: SyncStatus = "idle") => {
    setMessage(msg);
    setStatus(statusType);
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showMessage("请输入用户名和密码", "error");
      return;
    }

    setStatus("logging_in");
    setMessage("正在登录...");

    try {
      const result = await configSyncAPI.login(username.trim(), password);

      if (result.success && result.userId) {
        setIsLoggedIn(true);
        setUserId(result.userId);
        showMessage(`登录成功！用户ID: ${result.userId}`, "success");

        // Auto test connection after login
        setTimeout(async () => {
          try {
            const testResult = await configSyncAPI.testConnection(
              result.userId!,
            );
            if (testResult.success) {
              setIsConnected(true);
              setRemoteConfigCount(testResult.configCount || 0);
              showMessage(
                `已连接云端，共有 ${testResult.configCount} 个配置`,
                "success",
              );
            }
          } catch (error) {
            // Silently fail connection test
          }
        }, 500);
      } else {
        setIsLoggedIn(false);
        showMessage(`登录失败：${result.error}`, "error");
      }
    } catch (error) {
      setIsLoggedIn(false);
      showMessage(
        `登录失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };

  const handleTestConnection = async () => {
    if (!isLoggedIn || !userId.trim()) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("connecting");
    setMessage("正在测试连接...");

    try {
      const result = await configSyncAPI.testConnection(userId.trim());

      if (result.success) {
        setIsConnected(true);
        setRemoteConfigCount(result.configCount || 0);
        showMessage(`连接成功！云端有 ${result.configCount} 个配置`, "success");
      } else {
        setIsConnected(false);
        showMessage(`连接失败：${result.error}`, "error");
      }
    } catch (error) {
      setIsConnected(false);
      showMessage(
        `连接失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };

  const handleUpload = async () => {
    if (!isLoggedIn || !userId.trim()) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("uploading");
    setMessage("正在上传配置到云端...");

    try {
      const providerList = Object.values(providers);
      await configSyncAPI.syncConfigs(userId.trim(), providerList);

      showMessage(`成功上传 ${providerList.length} 个配置`, "success");
      setRemoteConfigCount(providerList.length);

      // Auto-close after delay
      setTimeout(() => {
        onClose();
      }, AUTO_CLOSE_DELAY);
    } catch (error) {
      showMessage(
        `上传失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };

  const handleDownload = async () => {
    if (!isLoggedIn || !userId.trim()) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("downloading");
    setMessage("正在从云端下载配置...");

    try {
      const remoteProviders = await configSyncAPI.getAllConfigs(userId.trim());

      if (remoteProviders.length === 0) {
        showMessage("云端没有配置，无需下载", "error");
        return;
      }

      // Merge local and remote configs, remote takes priority
      const localProviders = Object.values(providers);
      const merged = [...remoteProviders];

      // Add local-only configs using Set for O(n) lookup
      const remoteIds = new Set(remoteProviders.map((p) => p.id));
      for (const localProvider of localProviders) {
        if (!remoteIds.has(localProvider.id)) {
          merged.push(localProvider);
        }
      }

      showMessage(`成功下载 ${remoteProviders.length} 个配置`, "success");
      onSyncComplete(merged);

      // Auto-close after delay
      setTimeout(() => {
        onClose();
      }, AUTO_CLOSE_DELAY);
    } catch (error) {
      showMessage(
        `下载失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };

  const handleSmartSync = async () => {
    if (!isLoggedIn || !userId.trim()) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("syncing");
    setMessage("正在智能同步配置...");

    try {
      // 1. 获取远程配置
      const remoteProviders = await configSyncAPI.getAllConfigs(userId.trim());
      const remoteMap = new Map<string, Provider>(
        remoteProviders.map((p) => [p.id, p]),
      );

      // 2. 合并本地和远程配置
      const localProviders = Object.values(providers);
      const merged: Provider[] = [];

      // 遍历本地配置
      for (const localProvider of localProviders) {
        const remoteProvider = remoteMap.get(localProvider.id);

        if (remoteProvider) {
          // 两边都有，比较 createdAt，保留更新的
          const localTime = localProvider.createdAt || 0;
          const remoteTime = remoteProvider.createdAt || 0;

          if (localTime >= remoteTime) {
            merged.push(localProvider);
          } else {
            merged.push(remoteProvider);
          }

          // 从远程 map 中移除已处理的
          remoteMap.delete(localProvider.id);
        } else {
          // 本地独有
          merged.push(localProvider);
        }
      }

      // 添加远程独有的配置
      for (const remoteProvider of remoteMap.values()) {
        merged.push(remoteProvider);
      }

      // 3. 上传合并后的配置到云端
      setMessage("正在上传合并后的配置...");
      await configSyncAPI.syncConfigs(userId.trim(), merged);

      // 4. 更新本地配置
      showMessage(`智能同步完成！共 ${merged.length} 个配置`, "success");
      onSyncComplete(merged);

      // Auto-close after delay
      setTimeout(() => {
        onClose();
      }, AUTO_CLOSE_DELAY);
    } catch (error) {
      showMessage(
        `同步失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };

  const isLoading = [
    "connecting",
    "uploading",
    "downloading",
    "syncing",
    "logging_in",
  ].includes(status);
  const isDisabled = !isLoggedIn || isLoading;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud size={24} />
            配置云同步
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isLoggedIn ? (
            <>
              {/* 登录表单 */}
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) {
                      handleLogin();
                    }
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* 登录状态显示 */}
              <div className="p-3 rounded-base border-2 border-border bg-secondary-background">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-foreground opacity-70 mb-1">
                      已登录
                    </div>
                    <div className="text-sm font-base">{username}</div>
                  </div>
                  <div className="text-xs text-foreground opacity-70">
                    ID: {userId}
                  </div>
                </div>
              </div>

              {/* 连接状态 */}
              <div className="flex items-center justify-between p-3 rounded-base border-2 border-border bg-secondary-background">
                <span className="text-sm font-base">连接状态</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <span className="text-sm">
                    {isConnected ? "已连接" : "未连接"}
                  </span>
                </div>
              </div>

              {/* 配置信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-base border-2 border-border bg-secondary-background">
                  <div className="text-xs text-foreground opacity-70 mb-1">
                    本地配置
                  </div>
                  <div className="text-2xl font-heading">
                    {localConfigCount}
                  </div>
                </div>
                <div className="p-3 rounded-base border-2 border-border bg-secondary-background">
                  <div className="text-xs text-foreground opacity-70 mb-1">
                    远程配置
                  </div>
                  <div className="text-2xl font-heading">
                    {isConnected ? remoteConfigCount : "-"}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 状态消息 */}
          {message && (
            <div
              className={`p-3 rounded-base border-2 border-border ${
                status === "error"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                  : status === "success"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
              }`}
            >
              <div className="flex items-center gap-2">
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                <span className="text-sm">{message}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!isLoggedIn ? (
            <div className="flex flex-col w-full gap-3">
              {/* 登录按钮 */}
              <Button
                onClick={handleLogin}
                disabled={!username.trim() || !password.trim() || isLoading}
                variant="default"
                className="w-full"
              >
                {status === "logging_in" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    登录中...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    登录
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col w-full gap-3">
              {/* 第一行：测试连接 */}
              <Button
                onClick={handleTestConnection}
                disabled={isDisabled}
                variant="neutral"
                className="w-full"
              >
                {status === "connecting" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    连接中...
                  </>
                ) : (
                  <>
                    <Cloud size={16} />
                    测试连接
                  </>
                )}
              </Button>

              {/* 第二行：上传、下载、同步 */}
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={isDisabled}
                  variant="neutral"
                >
                  {status === "uploading" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  上传
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={isDisabled}
                  variant="neutral"
                >
                  {status === "downloading" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  下载
                </Button>
                <Button
                  onClick={handleSmartSync}
                  disabled={isDisabled}
                  variant="default"
                >
                  {status === "syncing" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  同步
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigSyncModal;
