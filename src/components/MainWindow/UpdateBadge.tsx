import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface UpdateBadgeProps {
  onClick: () => void;
}

export function UpdateBadge({ onClick }: UpdateBadgeProps) {
  const [hasUpdate] = useState(false);

  // 这里可以添加检查更新的逻辑
  // 目前只是一个占位组件

  if (!hasUpdate) {
    return null;
  }

  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="icon"
      className="relative"
      title="有新版本可用"
    >
      <Download size={18} />
      <Badge 
        variant="destructive" 
        className="absolute -top-1 -right-1 w-3 h-3 p-0 rounded-full"
      />
    </Button>
  );
}