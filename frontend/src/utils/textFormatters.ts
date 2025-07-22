import React from 'react';

// 格式化文本，在数字后添加换行
export const formatTextWithLineBreaks = (text: string | undefined): React.ReactNode => {
  if (!text) return text;
  
  // 先清理掉所有现有的换行符和多余空格
  const cleaned = text.replace(/\s+/g, ' ').trim();
  
  // 找到所有数字+点的匹配位置
  const matches = Array.from(cleaned.matchAll(/(\d+\.)/g));
  
  if (matches.length === 0) return cleaned;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  matches.forEach((match, index) => {
    const matchStart = match.index!;
    const matchText = match[0];
    
    // 添加匹配前的文本
    const beforeText = cleaned.slice(lastIndex, matchStart);
    if (beforeText) {
      parts.push(beforeText);
    }
    
    // 如果不是第一个匹配，添加换行
    if (index > 0) {
      parts.push(<br key={`br-${index}`} />);
    }
    
    parts.push(matchText);
    lastIndex = matchStart + matchText.length;
  });
  
  // 添加最后剩余的文本
  const remainingText = cleaned.slice(lastIndex);
  if (remainingText) {
    parts.push(remainingText);
  }
  
  return <>{parts}</>;
};