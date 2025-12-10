import { Provider } from "../../types";
import {
  Trash2,
  Edit,
  Play,
  ExternalLink,
  Search,
  Terminal,
} from "lucide-react";
import { formatTimestamp } from "../../utils/errorUtils";
import { Button } from "../ui/button";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { useState, useMemo, useRef, useEffect } from "react";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";

interface ProviderListProps {
  providers: Record<string, Provider>;
  currentProviderId: string;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onNotify: (message: string, type: "success" | "error") => void;
}

function ProviderList({
  providers,
  currentProviderId,
  onSwitch,
  onDelete,
  onEdit,
  onNotify,
}: ProviderListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const providerList = Object.values(providers);

  // 启动 Claude Code
  const handleLaunch = async (providerId: string) => {
    try {
      await window.api.launchClaudeWithProvider(providerId);
      onNotify("Claude Code 已启动", "success");
    } catch (error) {
      onNotify(`启动失败: ${error}`, "error");
    }
  };

  // 过滤供应商列表
  const filteredProviders = useMemo(() => {
    if (!searchTerm.trim()) {
      return providerList;
    }

    const term = searchTerm.toLowerCase();
    return providerList.filter((provider) =>
      provider.name.toLowerCase().includes(term),
    );
  }, [providerList, searchTerm]);

  // 重置选中索引当过滤结果改变时
  useEffect(() => {
    if (filteredProviders.length > 0) {
      setSelectedIndex(0);
    }
  }, [filteredProviders.length]);

  // 使用键盘导航 hook
  useKeyboardNavigation({
    items: filteredProviders,
    selectedIndex,
    setSelectedIndex,
    onSelect: (provider) => onSwitch(provider.id),
    currentItemId: currentProviderId,
    getItemId: (provider) => provider.id,
    searchInputRef,
    enableSlashKey: true,
  });

  if (providerList.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-foreground opacity-40 mb-4">
          <Play size={48} className="mx-auto" />
        </div>
        <h3 className="text-lg font-heading text-foreground mb-2">
          还没有供应商配置
        </h3>
        <p className="text-foreground opacity-70">
          点击上方"添加供应商"按钮开始配置您的第一个 Claude 供应商
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索栏 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground opacity-50"
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="搜索供应商..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="neutral">
          {filteredProviders.length} / {providerList.length}
        </Badge>
      </div>

      {/* 列表区域 */}
      {filteredProviders.length === 0 && searchTerm.trim() ? (
        <div className="text-center py-12">
          <div className="text-foreground opacity-40 mb-4">
            <Search size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-heading text-foreground mb-2">
            没有找到匹配的供应商
          </h3>
          <p className="text-foreground opacity-70">
            尝试修改搜索关键词或清空搜索框查看所有供应商
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredProviders.map((provider, index) => (
            <Card
              key={provider.id}
              className={`p-0 transition-all duration-200 cursor-pointer hover:shadow-[6px_6px_0px_0px] hover:shadow-border hover:-translate-x-1 hover:-translate-y-1 ${
                provider.id === currentProviderId
                  ? "ring-4 ring-main"
                  : index === selectedIndex
                    ? "ring-2 ring-blue-500"
                    : "hover:ring-2 hover:ring-border"
              }`}
            >
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="truncate text-lg">
                        {provider.name}
                      </CardTitle>
                      {provider.id === currentProviderId && (
                        <Badge variant="default">当前使用</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      {provider.websiteUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.api?.openExternal(provider.websiteUrl!);
                          }}
                          className="p-0 h-auto text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink size={14} />
                          访问官网
                        </Button>
                      )}

                      {provider.createdAt && (
                        <span className="text-foreground opacity-70">
                          创建于 {formatTimestamp(provider.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {provider.id !== currentProviderId && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwitch(provider.id);
                        }}
                        size="sm"
                      >
                        切换
                      </Button>
                    )}

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunch(provider.id);
                      }}
                      variant="neutral"
                      size="icon"
                      title="启动 Claude Code"
                    >
                      <Terminal size={16} />
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(provider.id);
                      }}
                      variant="neutral"
                      size="icon"
                      title="编辑"
                    >
                      <Edit size={16} />
                    </Button>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(provider.id);
                      }}
                      variant="destructive"
                      size="icon"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProviderList;
