import { useEffect, RefObject } from "react";

interface UseKeyboardNavigationProps<T> {
  items: T[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect?: (item: T) => void;
  currentItemId?: string;
  getItemId?: (item: T) => string;
  searchInputRef?: RefObject<HTMLInputElement>;
  enableSlashKey?: boolean;
}

/**
 * 自定义 Hook: 处理列表的键盘导航
 * @param items - 列表项数组
 * @param selectedIndex - 当前选中的索引
 * @param setSelectedIndex - 设置选中索引的函数
 * @param onSelect - 选中项时的回调函数（按 Enter 时触发）
 * @param currentItemId - 当前激活项的 ID（用于防止重复选择）
 * @param getItemId - 获取项 ID 的函数
 * @param searchInputRef - 搜索框的 ref（用于 "/" 键聚焦）
 * @param enableSlashKey - 是否启用 "/" 键聚焦搜索框（默认 false）
 */
export function useKeyboardNavigation<T>({
  items,
  selectedIndex,
  setSelectedIndex,
  onSelect,
  currentItemId,
  getItemId,
  searchInputRef,
  enableSlashKey = false,
}: UseKeyboardNavigationProps<T>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // "/" 键聚焦搜索框（仅在启用时且搜索框未聚焦时）
      if (
        enableSlashKey &&
        e.key === "/" &&
        searchInputRef?.current &&
        document.activeElement !== searchInputRef.current
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 当搜索框存在且有焦点时，不处理方向键
      if (
        searchInputRef?.current &&
        document.activeElement === searchInputRef.current
      ) {
        return;
      }

      // 方向键导航
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(
          selectedIndex < items.length - 1 ? selectedIndex + 1 : selectedIndex,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(selectedIndex > 0 ? selectedIndex - 1 : selectedIndex);
      } else if (e.key === "Enter" && items.length > 0) {
        e.preventDefault();
        const selectedItem = items[selectedIndex];
        if (selectedItem) {
          // 如果提供了 currentItemId 和 getItemId，则检查是否是当前项
          if (currentItemId && getItemId) {
            const itemId = getItemId(selectedItem);
            if (itemId !== currentItemId) {
              onSelect?.(selectedItem);
            }
          } else {
            onSelect?.(selectedItem);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    items,
    selectedIndex,
    setSelectedIndex,
    onSelect,
    currentItemId,
    getItemId,
    searchInputRef,
    enableSlashKey,
  ]);
}
