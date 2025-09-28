import { useState, useEffect } from 'react';
import { AppMode } from './types';
import MainWindow from './components/MainWindow/MainWindow';
import MenuBarWindow from './components/MenuBar/MenuBarWindow';
import { api } from './lib/tauri-api';

function App() {
  const [appMode, setAppMode] = useState<AppMode>('main');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // 获取当前应用模式
      const mode = await api.getAppMode();
      setAppMode(mode);
      
      // 监听模式切换事件
      await api.onAppModeChanged(({ mode }) => {
        setAppMode(mode);
      });
    } catch (error) {
      console.error('初始化应用失败:', error);
      // 默认使用主界面模式
      setAppMode('main');
    } finally {
      setIsLoading(false);
    }
  };

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
  switch (appMode) {
    case 'menubar':
      return <MenuBarWindow />;
    case 'main':
    default:
      return <MainWindow />;
  }
}

export default App;