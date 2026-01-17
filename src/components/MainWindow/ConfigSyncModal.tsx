import { useState, useEffect } from "react";
import {
  Cloud,
  Upload,
  RefreshCw,
  Loader2,
  LogIn,
  LogOut,
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


function ConfigSyncModal({
  providers,
  onClose,
  onSyncComplete,
}: ConfigSyncModalProps) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string>("");

  const [remoteConfigCount, setRemoteConfigCount] = useState<number>(0);

  const localConfigCount = Object.keys(providers).length;

  const showMessage = (msg: string, statusType: SyncStatus = "idle") => {
    setMessage(msg);
    setStatus(statusType);
  };

  // Login persistence
  useEffect(() => {
    const token = configSyncAPI.getAuthToken();
    if (token) {
      const userData = configSyncAPI.getUserData();
      setIsLoggedIn(true);
      setEmail(userData.email || "");
      setUsername(userData.username || "");
      
      // Attempt to refresh remote count
      configSyncAPI.testConnection().then(result => {
        if (result.success) {
          setRemoteConfigCount(result.configCount || 0);
        }
      }).catch(() => {});
    }
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showMessage("请输入邮箱和密码", "error");
      return;
    }

    setStatus("logging_in");
    setMessage("正在登录...");

    try {
      const result = await configSyncAPI.login(email.trim(), password);

      if (result.success && result.token) {
        setIsLoggedIn(true);
        setUsername(result.username || "");
        
        // Save user data for persistence
        configSyncAPI.setUserData(email.trim(), result.username || email.trim());

        showMessage(
          `登录成功！欢迎 ${result.username || email}`,
          "success",
        );

        // Fetch remote config count after login
        setTimeout(async () => {
          try {
            const testResult = await configSyncAPI.testConnection();
            if (testResult.success) {
              setRemoteConfigCount(testResult.configCount || 0);
            }
          } catch (error) {
            // Silently fail
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


  const handleLogout = async () => {
    try {
      await configSyncAPI.logout();
    } catch (error) {
      console.error("Logout failed", error);
    }
    // Always clear local state
    configSyncAPI.clearAuthToken();
    setIsLoggedIn(false);
    setEmail("");
    setPassword("");
    setUsername("");
    setRemoteConfigCount(0);
    showMessage("已登出", "success");
  };



  const handleUpload = async () => {
    if (!isLoggedIn) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("uploading");
    setMessage("正在上传配置到云端...");

    try {
      const providerList = Object.values(providers);
      await configSyncAPI.syncConfigs(providerList);

      showMessage(`成功上传 ${providerList.length} 个配置`, "success");
      setRemoteConfigCount(providerList.length);
    } catch (error) {
      showMessage(
        `上传失败：${error instanceof Error ? error.message : "未知错误"}`,
        "error",
      );
    }
  };



  const handleSmartSync = async () => {
    if (!isLoggedIn) {
      showMessage("请先登录", "error");
      return;
    }

    setStatus("syncing");
    setMessage("正在智能同步配置...");

    try {
      // 1. 获取远程配置
      const remoteProviders = await configSyncAPI.getAllConfigs();
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
      await configSyncAPI.syncConfigs(merged);

      // 4. 更新本地配置
      showMessage(`智能同步完成！共 ${merged.length} 个配置`, "success");
      onSyncComplete(merged);
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
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                    {email}
                  </div>
                </div>
              </div>

              {/* 配置信息 */}
              <div className="grid grid-cols-2 gap-3">
                {/* 本地配置卡片 */}
                <div className="p-3 rounded-base border-2 border-border bg-secondary-background relative">
                  <div className="text-xs text-foreground opacity-70 mb-1">
                    本地配置
                  </div>
                  <div className="text-2xl font-heading mb-1">
                    {localConfigCount}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Button
                      onClick={handleUpload}
                      disabled={isDisabled}
                      variant="neutral"
                      size="icon"
                      className="h-8 w-8"
                      title="上传"
                    >
                      {status === "uploading" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                    </Button>
                  </div>
                </div>

                {/* 远程配置卡片 */}
                <div className="p-3 rounded-base border-2 border-border bg-secondary-background relative">
                  <div className="text-xs text-foreground opacity-70 mb-1">
                    远程配置
                  </div>
                  <div className="text-2xl font-heading mb-1">
                    {remoteConfigCount}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Button
                      onClick={handleSmartSync}
                      disabled={isDisabled}
                      variant="default"
                      size="icon"
                      className="h-8 w-8"
                      title="同步"
                    >
                      {status === "syncing" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                    </Button>
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
                disabled={!email.trim() || !password.trim() || isLoading}
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
              <Button
                onClick={handleLogout}
                disabled={isLoading}
                variant="neutral"
                className="w-full"
              >
                <LogOut size={16} />
                登出
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfigSyncModal;
