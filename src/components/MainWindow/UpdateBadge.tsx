import { useState } from 'react';
import { Download } from 'lucide-react';
import { buttonStyles } from '../../lib/styles';

interface UpdateBadgeProps {
  onClick: () => void;
}

export function UpdateBadge({ onClick }: UpdateBadgeProps) {
  const [hasUpdate, setHasUpdate] = useState(false);

  // 这里可以添加检查更新的逻辑
  // 目前只是一个占位组件

  if (!hasUpdate) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`${buttonStyles.icon} relative`}
      title="有新版本可用"
    >
      <Download size={18} />
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
    </button>
  );
}