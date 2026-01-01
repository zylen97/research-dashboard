"""
字符串处理工具函数
提供文本格式化、清理等通用功能
"""


def to_title_case(text: str) -> str:
    """
    将文本转换为标题格式（Title Case）
    每个单词首字母大写，其余小写
    保留特定连接词小写（a, an, the, of, in, on, at等）

    Examples:
        "NATURE" -> "Nature"
        "JOURNAL OF MEDICINE" -> "Journal of Medicine"
        "IEEE TRANSACTIONS ON SOFTWARE" -> "IEEE Transactions on Software"
        "科学通报" -> "科学通报"  # 中文保持不变

    Args:
        text: 输入文本

    Returns:
        格式化后的文本
    """
    if not text:
        return text

    # 检查是否包含中文字符
    if any('\u4e00' <= char <= '\u9fff' for char in text):
        return text  # 中文期刊名保持原样

    # 小写连接词列表（首尾除外）
    minor_words = {
        'a', 'an', 'the', 'and', 'or', 'but',
        'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from'
    }

    words = text.lower().split()
    if not words:
        return text

    result = []
    for i, word in enumerate(words):
        # 首词、尾词或非连接词需要首字母大写
        if i == 0 or i == len(words) - 1 or word not in minor_words:
            result.append(word.capitalize())
        else:
            result.append(word)

    return ' '.join(result)
