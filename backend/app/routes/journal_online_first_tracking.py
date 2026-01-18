"""
期刊网络首发追踪路由
提供网络首发追踪记录的CRUD功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import logging

from ..models import get_db, Journal, JournalOnlineFirstTracking
from ..utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/journals/{journal_id}/online-first-tracking")
def get_online_first_tracking(
    journal_id: int,
    db: Session = Depends(get_db)
):
    """获取期刊的网络首发追踪记录列表"""
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 查询追踪记录，按追踪日期降序排列
        tracking_records = db.query(JournalOnlineFirstTracking).filter(
            JournalOnlineFirstTracking.journal_id == journal_id
        ).order_by(JournalOnlineFirstTracking.tracked_date.desc()).all()

        # 获取今天的日期用于判断
        today = date.today()

        # 格式化返回数据
        result = []
        for record in tracking_records:
            tracked_date = record.tracked_date
            is_today = tracked_date == today

            result.append({
                "id": record.id,
                "journal_id": record.journal_id,
                "tracked_date": tracked_date.isoformat(),
                "tracked_at": record.tracked_at.isoformat() if record.tracked_at else None,
                "notes": record.notes,
                "is_today": is_today,
            })

        return success_response(
            data=result,
            message=f"获取到 {len(result)} 条追踪记录"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取网络首发追踪记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取网络首发追踪记录失败: {str(e)}")


@router.post("/journals/{journal_id}/online-first-tracking/today")
def create_tracking_today(
    journal_id: int,
    notes: Optional[str] = Query(None, description="备注"),
    db: Session = Depends(get_db)
):
    """一键创建今天的追踪记录"""
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        today = date.today()

        # 检查今天是否已有记录
        existing = db.query(JournalOnlineFirstTracking).filter(
            JournalOnlineFirstTracking.journal_id == journal_id,
            JournalOnlineFirstTracking.tracked_date == today
        ).first()

        if existing:
            # 如果今天已有记录，更新备注
            if notes is not None:
                existing.notes = notes
                existing.tracked_at = datetime.utcnow()
                db.commit()
                db.refresh(existing)

                return success_response(
                    data={
                        "id": existing.id,
                        "journal_id": existing.journal_id,
                        "tracked_date": existing.tracked_date.isoformat(),
                        "tracked_at": existing.tracked_at.isoformat(),
                        "notes": existing.notes,
                        "is_today": True,
                    },
                    message="今天已有记录，已更新备注"
                )
            else:
                return success_response(
                    data={
                        "id": existing.id,
                        "journal_id": existing.journal_id,
                        "tracked_date": existing.tracked_date.isoformat(),
                        "tracked_at": existing.tracked_at.isoformat(),
                        "notes": existing.notes,
                        "is_today": True,
                    },
                    message="今天已有追踪记录"
                )

        # 创建新记录
        new_tracking = JournalOnlineFirstTracking(
            journal_id=journal_id,
            tracked_date=today,
            tracked_at=datetime.utcnow(),
            notes=notes
        )

        db.add(new_tracking)
        db.commit()
        db.refresh(new_tracking)

        return success_response(
            data={
                "id": new_tracking.id,
                "journal_id": new_tracking.journal_id,
                "tracked_date": new_tracking.tracked_date.isoformat(),
                "tracked_at": new_tracking.tracked_at.isoformat(),
                "notes": new_tracking.notes,
                "is_today": True,
            },
            message="追踪记录创建成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建网络首发追踪记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建网络首发追踪记录失败: {str(e)}")


@router.post("/journals/{journal_id}/online-first-tracking")
def create_online_first_tracking(
    journal_id: int,
    tracked_date: str = Query(..., description="追踪日期（YYYY-MM-DD）"),
    notes: Optional[str] = Query(None, description="备注"),
    db: Session = Depends(get_db)
):
    """手动添加追踪记录"""
    try:
        # 验证期刊存在
        journal = db.query(Journal).filter(Journal.id == journal_id).first()
        if not journal:
            raise HTTPException(status_code=404, detail="期刊不存在")

        # 解析日期
        try:
            parsed_date = datetime.strptime(tracked_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，请使用YYYY-MM-DD格式")

        # 检查该日期是否已有记录
        existing = db.query(JournalOnlineFirstTracking).filter(
            JournalOnlineFirstTracking.journal_id == journal_id,
            JournalOnlineFirstTracking.tracked_date == parsed_date
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"该日期的追踪记录已存在: {tracked_date}"
            )

        # 创建新记录
        new_tracking = JournalOnlineFirstTracking(
            journal_id=journal_id,
            tracked_date=parsed_date,
            tracked_at=datetime.utcnow(),
            notes=notes
        )

        db.add(new_tracking)
        db.commit()
        db.refresh(new_tracking)

        today = date.today()
        is_today = parsed_date == today

        return success_response(
            data={
                "id": new_tracking.id,
                "journal_id": new_tracking.journal_id,
                "tracked_date": new_tracking.tracked_date.isoformat(),
                "tracked_at": new_tracking.tracked_at.isoformat(),
                "notes": new_tracking.notes,
                "is_today": is_today,
            },
            message="追踪记录创建成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建网络首发追踪记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建网络首发追踪记录失败: {str(e)}")


@router.delete("/journals/{journal_id}/online-first-tracking/{tracking_id}")
def delete_online_first_tracking(
    journal_id: int,
    tracking_id: int,
    db: Session = Depends(get_db)
):
    """删除追踪记录"""
    try:
        # 查找记录
        tracking_record = db.query(JournalOnlineFirstTracking).filter(
            JournalOnlineFirstTracking.id == tracking_id,
            JournalOnlineFirstTracking.journal_id == journal_id
        ).first()

        if not tracking_record:
            raise HTTPException(status_code=404, detail="追踪记录不存在")

        # 删除记录
        db.delete(tracking_record)
        db.commit()

        return success_response(
            message="追踪记录删除成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除网络首发追踪记录失败: {e}")
        raise HTTPException(status_code=500, detail=f"删除网络首发追踪记录失败: {str(e)}")
