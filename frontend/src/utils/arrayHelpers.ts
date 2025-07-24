// 数组安全辅助函数

/**
 * 确保数据是数组，如果不是则返回空数组
 * @param data - 任意数据
 * @param debugContext - 调试上下文，用于日志输出
 * @returns 数组
 */
export const ensureArray = <T>(data: any, debugContext?: string): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (debugContext) {
    console.warn(`[${debugContext}] Data is not an array:`, data);
  }
  
  return [];
};

/**
 * 安全地对数组执行forEach操作
 * @param data - 任意数据
 * @param callback - 回调函数
 * @param debugContext - 调试上下文
 */
export const safeForEach = <T>(
  data: any,
  callback: (item: T, index: number, array: T[]) => void,
  debugContext?: string
): void => {
  const array = ensureArray<T>(data, debugContext);
  array.forEach(callback);
};

/**
 * 安全地对数组执行map操作
 * @param data - 任意数据
 * @param callback - 映射函数
 * @param debugContext - 调试上下文
 * @returns 映射后的数组
 */
export const safeMap = <T, R>(
  data: any,
  callback: (item: T, index: number, array: T[]) => R,
  debugContext?: string
): R[] => {
  const array = ensureArray<T>(data, debugContext);
  return array.map(callback);
};

/**
 * 安全地对数组执行filter操作
 * @param data - 任意数据
 * @param predicate - 过滤函数
 * @param debugContext - 调试上下文
 * @returns 过滤后的数组
 */
export const safeFilter = <T>(
  data: any,
  predicate: (item: T, index: number, array: T[]) => boolean,
  debugContext?: string
): T[] => {
  const array = ensureArray<T>(data, debugContext);
  return array.filter(predicate);
};

/**
 * 安全地获取数组长度
 * @param data - 任意数据
 * @param debugContext - 调试上下文
 * @returns 数组长度，非数组返回0
 */
export const safeLength = (data: any, debugContext?: string): number => {
  const array = ensureArray(data, debugContext);
  return array.length;
};
