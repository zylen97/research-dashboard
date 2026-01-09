"""
期刊期卷号浏览记录管理路由
提供期卷号浏览记录的CRUD功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime
import logging

from ..models import get_db, Journal
from ..models.database import Base
from ..utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter()

# 定义JournalIssue模型（内联定义，避免循环导入）
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text

class JournalIssue(Base):
    """期刊期卷号浏览记录模型"""
    __tablename__ = "journal_issues"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey('journals.id', ondelete='CASCADE'), nullable=False)
    volume = Column(String(50), nullable=False, comment="卷号")
    issue = Column(String(50), nullable=False, comment="期号")
    year = Column(Integer, nullable=False, comment="年份")
    marked_date = Column(Date, nullable=False, comment="标记日期")
    notes = Column(Text, nullable=True, comment="备注")
    created_at = Column(Date, nullable=False, comment="创建日期")
    updated_at = Column(Date, nullable=False, comment="更新日期")


@router.get("/journals/{journal_id}/issues")
def get_journal_issues(
    journal_id: int,
    year: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取期刊的期卷号记录列表"""
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 构建查询
        query = db.query(JournalIssue).filter(JournalIssue.journal_id == journal_id)

        # 年份筛选
        if year:
            query = query.filter(JournalIssue.year == year)

        # 按年份降序、期号降序排序
        query = query.order_by(JournalIssue.year.desc(), JournalIssue.issue.desc())

        issues = query.all()

        # 格式化返回数据
        result = []
        for issue in issues:
            result.append({
                "id": issue.id,
                "journal_id": issue.journal_id,
                "volume": issue.volume,
                "issue": issue.issue,
                "year": issue.year,
                "marked_date": issue.marked_date.isoformat() if issue.marked_date else None,
                "notes": issue.notes,
                "created_at": issue.created_at.isoformat() if issue.created_at else None,
                "updated_at": issue.updated_at.isoformat() if issue.updated_at else None,
            })

        return success_response(
            data=result,
            message=f"获取到 {len(result)} 条期卷号记录"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取期卷号记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取期卷号记录失败: {str(e)}")


@router.post("/journals/{journal_id}/issues")
def create_journal_issue(
    journal_id: int,
    volume: str = Query(..., description="卷号"),
    issue: str = Query(..., description="期号"),
    year: int = Query(..., description="年份"),
    notes: Optional[str] = Query(None, description="备注"),
    db: Session = Depends(get_db)
):
    """创建期卷号记录"""
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 检查是否已存在相同的期卷号记录
        existing = db.query(JournalIssue).filter(
            JournalIssue.journal_id == journal_id,
            JournalIssue.volume == volume,
            JournalIssue.issue == issue
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"该期卷号记录已存在: Vol.{volume} No.{issue}"
            )

        # 创建新记录
        today = datetime.now().date()
        new_issue = JournalIssue(
            journal_id=journal_id,
            volume=volume,
            issue=issue,
            year=year,
            marked_date=today,
            notes=notes,
            created_at=today,
            updated_at=today
        )

        db.add(new_issue)
        db.commit()
        db.refresh(new_issue)

        return success_response(
            data={
                "id": new_issue.id,
                "journal_id": new_issue.journal_id,
                "volume": new_issue.volume,
                "issue": new_issue.issue,
                "year": new_issue.year,
                "marked_date": new_issue.marked_date.isoformat(),
                "notes": new_issue.notes,
            },
            message="期卷号记录创建成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建期卷号记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建期卷号记录失败: {str(e)}")


@router.put("/journals/{journal_id}/issues/{issue_id}")
def update_journal_issue(
    journal_id: int,
    issue_id: int,
    volume: Optional[str] = Query(None, description="卷号"),
    issue: Optional[str] = Query(None, description="期号"),
    year: Optional[int] = Query(None, description="年份"),
    notes: Optional[str] = Query(None, description="备注"),
    db: Session = Depends(get_db)
):
    """更新期卷号记录"""
    try:
        # 查找记录
        issue_record = db.query(JournalIssue).filter(
            JournalIssue.id == issue_id,
            JournalIssue.journal_id == journal_id
        ).first()

        if not issue_record:
            raise HTTPException(status_code=404, detail="期卷号记录不存在")

        # 更新字段
        if volume is not None:
            issue_record.volume = volume
        if issue is not None:
            issue_record.issue = issue
        if year is not None:
            issue_record.year = year
        if notes is not None:
            issue_record.notes = notes

        issue_record.updated_at = datetime.now().date()

        db.commit()
        db.refresh(issue_record)

        return success_response(
            data={
                "id": issue_record.id,
                "volume": issue_record.volume,
                "issue": issue_record.issue,
                "year": issue_record.year,
                "marked_date": issue_record.marked_date.isoformat(),
                "notes": issue_record.notes,
            },
            message="期卷号记录更新成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新期卷号记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新期卷号记录失败: {str(e)}")


@router.delete("/journals/{journal_id}/issues/{issue_id}")
def delete_journal_issue(
    journal_id: int,
    issue_id: int,
    db: Session = Depends(get_db)
):
    """删除期卷号记录"""
    try:
        # 查找记录
        issue_record = db.query(JournalIssue).filter(
            JournalIssue.id == issue_id,
            JournalIssue.journal_id == journal_id
        ).first()

        if not issue_record:
            raise HTTPException(status_code=404, detail="期卷号记录不存在")

        # 删除记录
        db.delete(issue_record)
        db.commit()

        return success_response(
            message="期卷号记录删除成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除期卷号记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除期卷号记录失败: {str(e)}")
