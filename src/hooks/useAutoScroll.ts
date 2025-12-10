import { useEffect, RefObject } from "react";

interface UseAutoScrollProps {
  selectedIndex: number;
  itemRefs: RefObject<(HTMLElement | null)[]>;
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
}

/**
 * 自定义 Hook: 自动滚动到选中的项目
 * @param selectedIndex - 当前选中的索引
 * @param itemRefs - 项目元素的 ref 数组
 * @param behavior - 滚动行为（默认 "smooth"）
 * @param block - 滚动位置（默认 "nearest"）
 */
export function useAutoScroll({
  selectedIndex,
  itemRefs,
  behavior = "smooth",
  block = "nearest",
}: UseAutoScrollProps) {
  useEffect(() => {
    if (itemRefs.current?.[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior,
        block,
      });
    }
  }, [selectedIndex, itemRefs, behavior, block]);
}
