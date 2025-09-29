import { useState, useEffect } from "react";
import { AppMode } from "./types";
import MainWindow from "./components/MainWindow/MainWindow";
import MenuBarWindow from "./components/MenuBar/MenuBarWindow";
import { api } from "./lib/tauri-api";

function App() {
  const [appMode, setAppMode] = useState<AppMode>("main");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${info}`,
    ]);
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      addDebugInfo("开始初始化应用...");

      // 获取当前应用模式
      addDebugInfo("正在获取应用模式...");
      const mode = await api.getAppMode();
      addDebugInfo(`获取到应用模式: ${mode}`);
      setAppMode(mode);

      // 暂时跳过事件监听器设置，先让应用能正常启动
      addDebugInfo("跳过事件监听器设置以进行调试");

      addDebugInfo("应用初始化完成");

      // 如果到这里没有抛出异常，说明初始化成功
      setError(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      addDebugInfo(`初始化应用失败: ${errorMessage}`);
      console.error("初始化应用失败:", error);
      console.error("错误详情:", error instanceof Error ? error.stack : error);
      setError(errorMessage);
      // 默认使用主界面模式
      setAppMode("main");
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            初始化失败
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
            {error}
          </p>
          <div className="w-full max-h-40 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
            <h3 className="font-semibold mb-2">调试信息:</h3>
            {debugInfo.map((info, index) => (
              <div
                key={index}
                className="text-gray-700 dark:text-gray-300 mb-1"
              >
                {info}
              </div>
            ))}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">正在启动...</p>
        </div>
      </div>
    );
  }

  // 根据模式渲染不同的界面
  console.log("渲染界面，当前模式:", appMode);
  switch (appMode) {
    case "menubar":
      return <MenuBarWindow />;
    case "main":
    default:
      return <MainWindow />;
  }
}

export default App;
