import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Waypoints } from "lucide-react";
import { ApiGatewayLogEntry } from "../../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";

interface ApiGatewayLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  localBaseUrl?: string;
  details?: string[];
  logs: ApiGatewayLogEntry[];
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}

function ApiGatewayLogModal({
  isOpen,
  onClose,
  title = "API Gateway 日志",
  localBaseUrl,
  details = [],
  logs,
  actionLabel,
  onAction,
  actionDisabled = false,
}: ApiGatewayLogModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) {
      return logs;
    }

    return logs.filter((entry) => {
      const haystack = `${entry.timestamp} ${entry.level} ${entry.message}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, searchTerm]);

  useEffect(() => {
    if (!isOpen || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [isOpen, filteredLogs]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Waypoints size={18} />
              <DialogTitle>{title}</DialogTitle>
            </div>
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                disabled={actionDisabled}
                className="rounded-base border-2 border-border bg-secondary-background px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLabel}
              </button>
            )}
          </div>
          <div className="space-y-1 text-sm text-foreground opacity-70">
            <div>{localBaseUrl ? `本地地址 ${localBaseUrl}` : "实时日志流"}</div>
            {details.map((detail) => (
              <div key={detail}>{detail}</div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground opacity-50"
              />
              <Input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="搜索日志内容、级别或时间"
                className="pl-9"
              />
            </div>
            <Badge variant="neutral">{filteredLogs.length} / {logs.length}</Badge>
          </div>

          <div
            ref={scrollRef}
            className="h-[420px] overflow-y-auto rounded-base border-2 border-border bg-secondary-background p-3"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-foreground opacity-60">
                没有匹配的日志
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs leading-5 text-foreground">
                {filteredLogs.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${index}-${entry.message}`}
                    className="rounded-base border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="flex items-center gap-2 opacity-70">
                      <span>{entry.timestamp}</span>
                      <Badge
                        variant={entry.level === "error" ? "destructive" : "neutral"}
                      >
                        {entry.level.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-all">
                      {entry.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ApiGatewayLogModal;