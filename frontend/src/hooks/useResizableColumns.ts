import { useState, useCallback } from 'react';
import { ResizeCallbackData } from 'react-resizable';
import type { ColumnsType } from 'antd/es/table';

interface UseResizableColumnsOptions {
  /** 默认列宽配置，key为列的key或dataIndex */
  defaultColumnWidths: Record<string, number>;
  /** localStorage键名，用于持久化列宽设置 */
  storageKey: string;
}

/**
 * 为Table列添加可调整宽度功能的Hook
 *
 * @example
 * ```tsx
 * const { enhanceColumns, ResizableTitleComponent } = useResizableColumns({
 *   defaultColumnWidths: { title: 200, status: 100 },
 *   storageKey: 'ideas-table-columns',
 * });
 *
 * <Table
 *   columns={enhanceColumns(baseColumns)}
 *   components={{ header: { cell: ResizableTitleComponent } }}
 * />
 * ```
 */
export function useResizableColumns({
  defaultColumnWidths,
  storageKey,
}: UseResizableColumnsOptions) {
  // 从localStorage读取保存的列宽，并与默认值合并
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return defaultColumnWidths;

    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
    } catch (error) {
      console.error(`[useResizableColumns] Failed to read localStorage (${storageKey}):`, error);
      return defaultColumnWidths;
    }
  });

  // 处理列宽调整
  const handleResize = useCallback((key: string) =>
    (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
      setColumnWidths((prev) => {
        const newWidths = { ...prev, [key]: size.width };

        // 保存到localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(newWidths));
        } catch (error) {
          console.error(`[useResizableColumns] Failed to save to localStorage (${storageKey}):`, error);
        }

        return newWidths;
      });
    }, [storageKey]
  );

  /**
   * 增强列定义：为每列添加可调整宽度的功能
   * @param columns 原始列定义
   * @returns 增强后的列定义（带有width和onHeaderCell）
   */
  const enhanceColumns = useCallback((columns: ColumnsType<any>): ColumnsType<any> => {
    return columns.map((col: any) => {
      const key = col.key || col.dataIndex;

      // 如果该列没有配置默认宽度，直接返回原列
      if (!key || !defaultColumnWidths[key]) {
        return col;
      }

      return {
        ...col,
        width: columnWidths[key],
        onHeaderCell: () => ({
          width: columnWidths[key],
          onResize: handleResize(key),
        }),
      };
    });
  }, [columnWidths, defaultColumnWidths, handleResize]);

  return {
    /** 当前列宽状态 */
    columnWidths,
    /** 增强列定义的函数 */
    enhanceColumns,
  };
}
