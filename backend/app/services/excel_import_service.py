"""
论文Excel导入服务
用于从知网导出的Excel文件导入论文数据
"""
import pandas as pd
import io
import uuid
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime

from ..models import Paper, Journal
from ..models.schemas import PaperCreate


class ExcelImportService:
    """论文Excel导入服务"""

    # Excel列名映射（支持中英文）
    COLUMN_MAPPING = {
        'title': ['标题', '题名', 'title', 'Title', '论文标题'],
        'authors': ['作者', 'author', 'Author', 'Authors', '作者列表'],
        'abstract': ['摘要', 'abstract', 'Abstract', '摘要内容'],
        'keywords': ['关键词', 'keyword', 'Keyword', 'Keywords', '关键字'],
        'year': ['年份', 'year', 'Year', '发表年份', '发表时间'],
        'journal_name': ['期刊', '来源', 'journal', 'Journal', '期刊名称', '来源期刊'],
        'volume': ['卷', 'volume', 'Volume'],
        'issue': ['期', 'issue', 'Issue'],
        'pages': ['页码', 'pages', 'Page', '页'],
        'doi': ['DOI', 'doi'],
        # 翻译字段 (v3.5)
        'link': ['文献预览', 'Link', 'link', '链接', 'URL'],
        'title_translation': ['标题翻译', 'Title Translation', 'Title Translation'],
        'abstract_translation': ['摘要翻译', 'Abstract Translation', 'Abstract Translation'],
        'abstract_summary': ['摘要总结', 'Abstract Summary', '摘要总结'],
    }

    @classmethod
    def normalize_columns(cls, df: pd.DataFrame) -> Dict[str, str]:
        """
        将Excel列名映射到标准字段名

        Args:
            df: pandas DataFrame

        Returns:
            映射字典 {标准字段名: Excel实际列名}
        """
        mapped_columns = {}

        for standard_col, possible_names in cls.COLUMN_MAPPING.items():
            for col_name in df.columns:
                if col_name in possible_names:
                    mapped_columns[standard_col] = col_name
                    break

        return mapped_columns

    @classmethod
    def map_journal_name_to_id(cls, journal_name: str, db: Session) -> Optional[int]:
        """
        根据期刊名称查找期刊ID

        Args:
            journal_name: 期刊名称
            db: 数据库会话

        Returns:
            期刊ID，如果不存在返回None
        """
        if not journal_name or pd.isna(journal_name):
            return None

        journal = db.query(Journal).filter(Journal.name == str(journal_name).strip()).first()
        return journal.id if journal else None

    @classmethod
    def clean_value(cls, value, max_length: Optional[int] = None) -> Optional[str]:
        """
        清理单元格值

        Args:
            value: 原始值
            max_length: 最大长度限制

        Returns:
            清理后的字符串或None
        """
        if pd.isna(value) or value is None:
            return None

        # 如果是浮点数且为整数（如 41.0），转换为整数再转字符串
        if isinstance(value, float) and value.is_integer():
            value = int(value)

        result = str(value).strip()

        if not result:
            return None

        if max_length:
            result = result[:max_length]

        return result

    @classmethod
    def import_papers_from_excel(
        cls,
        file_content: bytes,
        db: Session,
        user_id: int = 1
    ) -> Tuple[int, List[str], str]:
        """
        从Excel文件导入论文

        Args:
            file_content: Excel文件内容（字节）
            db: 数据库会话
            user_id: 用户ID

        Returns:
            (导入数量, 错误列表, 批次ID)
        """
        batch_id = str(uuid.uuid4())
        imported_count = 0
        errors = []

        try:
            # 读取Excel
            df = pd.read_excel(io.BytesIO(file_content))

            if df.empty:
                return 0, ["Excel文件为空"], batch_id

            # 映射列名
            mapped_columns = cls.normalize_columns(df)

            # 检查必填字段
            if 'title' not in mapped_columns:
                return 0, ["缺少必填字段：标题(Title)"], batch_id

            # 遍历每一行
            for index, row in df.iterrows():
                try:
                    # 提取数据
                    title = cls.clean_value(row[mapped_columns['title']], 500)
                    if not title:
                        errors.append(f"行 {index + 1}: 标题为空，跳过")
                        continue

                    # 可选字段
                    authors = None
                    if 'authors' in mapped_columns:
                        authors = cls.clean_value(row[mapped_columns['authors']])

                    abstract = None
                    if 'abstract' in mapped_columns:
                        abstract = cls.clean_value(row[mapped_columns['abstract']])

                    keywords = None
                    if 'keywords' in mapped_columns:
                        keywords = cls.clean_value(row[mapped_columns['keywords']])

                    year = None
                    if 'year' in mapped_columns:
                        year_val = row[mapped_columns['year']]
                        if pd.notna(year_val):
                            try:
                                year = int(year_val)
                            except (ValueError, TypeError):
                                pass

                    volume = None
                    if 'volume' in mapped_columns:
                        volume = cls.clean_value(row[mapped_columns['volume']], 50)

                    issue = None
                    if 'issue' in mapped_columns:
                        issue = cls.clean_value(row[mapped_columns['issue']], 50)

                    pages = None
                    if 'pages' in mapped_columns:
                        pages = cls.clean_value(row[mapped_columns['pages']], 50)

                    doi = None
                    if 'doi' in mapped_columns:
                        doi = cls.clean_value(row[mapped_columns['doi']], 200)

                    # 翻译字段 (v3.5)
                    link = None
                    if 'link' in mapped_columns:
                        link = cls.clean_value(row[mapped_columns['link']], 1000)

                    title_translation = None
                    if 'title_translation' in mapped_columns:
                        title_translation = cls.clean_value(row[mapped_columns['title_translation']])

                    abstract_translation = None
                    if 'abstract_translation' in mapped_columns:
                        abstract_translation = cls.clean_value(row[mapped_columns['abstract_translation']])

                    abstract_summary = None
                    if 'abstract_summary' in mapped_columns:
                        abstract_summary = cls.clean_value(row[mapped_columns['abstract_summary']])

                    # 关联期刊（如果不存在则自动创建）
                    journal_id = None
                    if 'journal_name' in mapped_columns:
                        journal_name = cls.clean_value(row[mapped_columns['journal_name']])
                        if journal_name:
                            # 尝试查找期刊
                            journal_id = cls.map_journal_name_to_id(journal_name, db)
                            # 如果不存在，自动创建
                            if journal_id is None:
                                new_journal = Journal(name=journal_name)
                                db.add(new_journal)
                                db.flush()  # 获取新创建的期刊ID
                                journal_id = new_journal.id

                    # 创建论文记录
                    paper = Paper(
                        title=title,
                        authors=authors,
                        abstract=abstract,
                        keywords=keywords,
                        year=year,
                        volume=volume,
                        issue=issue,
                        pages=pages,
                        doi=doi,
                        link=link,
                        title_translation=title_translation,
                        abstract_translation=abstract_translation,
                        abstract_summary=abstract_summary,
                        journal_id=journal_id,
                        source='cnki',
                        import_batch_id=batch_id,
                        status='pending',
                        created_by=user_id
                    )

                    db.add(paper)
                    imported_count += 1

                except Exception as e:
                    errors.append(f"行 {index + 1}: {str(e)}")

            # 提交事务
            db.commit()

            return imported_count, errors, batch_id

        except Exception as e:
            db.rollback()
            return 0, [f"导入失败: {str(e)}"], batch_id
