"""
数据库备份管理API路由
"""
from fastapi import APIRouter, HTTPException, Depends, Response
from typing import List, Dict, Any
from datetime import datetime
import tempfile
import gzip
from pathlib import Path
from sqlalchemy.orm import Session

from ..utils.backup_manager import BackupManager
from ..models.database import get_db

router = APIRouter()

@router.get("/stats")
async def get_backup_stats() -> Dict[str, Any]:
    """获取备份统计信息"""
    try:
        manager = BackupManager()
        stats = manager.get_backup_stats()
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取备份统计失败: {str(e)}")

@router.get("/list")
async def list_backups() -> Dict[str, Any]:
    """列出所有备份"""
    try:
        manager = BackupManager()
        backups = manager.list_backups()
        
        # 格式化备份信息
        formatted_backups = []
        for backup in backups:
            formatted_backups.append({
                "id": backup["name"],
                "name": backup["name"],
                "size": backup["size"],
                "sizeFormatted": _format_size(backup["size"]),
                "created": backup["created"].isoformat(),
                "createdFormatted": backup["created"].strftime("%Y-%m-%d %H:%M:%S"),
                "details": backup.get("details", ""),
                "collaborators_count": backup.get("collaborators_count", 0),
                "projects_count": backup.get("projects_count", 0),
                "logs_count": backup.get("logs_count", 0),
                "ideas_count": backup.get("ideas_count", 0),
                "journals_count": backup.get("journals_count", 0)
            })
        
        return {
            "success": True,
            "data": formatted_backups,
            "total": len(formatted_backups)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取备份列表失败: {str(e)}")

@router.post("/create")
async def create_backup(
    reason: str = "手动备份"
) -> Dict[str, Any]:
    """创建新备份"""
    try:
        manager = BackupManager()
        backup_path = manager.create_backup(reason)
        
        if backup_path:
            # 获取新备份信息
            backups = manager.list_backups()
            new_backup = next((b for b in backups if b["name"] == backup_path.name), None)
            
            if new_backup:
                return {
                    "success": True,
                    "message": "备份创建成功",
                    "data": {
                        "id": new_backup["name"],
                        "name": new_backup["name"],
                        "size": new_backup["size"],
                        "sizeFormatted": _format_size(new_backup["size"]),
                        "created": new_backup["created"].isoformat(),
                        "createdFormatted": new_backup["created"].strftime("%Y-%m-%d %H:%M:%S")
                    }
                }
        
        raise HTTPException(status_code=500, detail="备份创建失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建备份失败: {str(e)}")

@router.post("/restore/{backup_id}")
async def restore_backup(
    backup_id: str
) -> Dict[str, Any]:
    """恢复指定备份"""
    try:
        manager = BackupManager()
        
        # 验证备份是否存在
        backups = manager.list_backups()
        backup_exists = any(b["name"] == backup_id for b in backups)
        
        if not backup_exists:
            raise HTTPException(status_code=404, detail="备份不存在")
        
        # 执行恢复
        success = manager.restore_backup(backup_id)
        
        if success:
            return {
                "success": True,
                "message": f"数据库已成功恢复到备份: {backup_id}"
            }
        else:
            raise HTTPException(status_code=500, detail="恢复失败")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"恢复备份失败: {str(e)}")

@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: str
) -> Dict[str, Any]:
    """删除指定备份"""
    try:
        manager = BackupManager()
        backup_path = manager.backup_dir / backup_id
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="备份不存在")
        
        # 删除备份文件夹
        import shutil
        shutil.rmtree(backup_path)
        
        return {
            "success": True,
            "message": f"备份 {backup_id} 已删除"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除备份失败: {str(e)}")

@router.get("/download/{backup_id}")
async def download_backup(
    backup_id: str
) -> Response:
    """下载备份文件"""
    try:
        manager = BackupManager()
        backup_path = manager.backup_dir / backup_id / manager.db_path.name
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="备份不存在")
        
        # 创建临时gzip文件
        with tempfile.NamedTemporaryFile(suffix='.gz', delete=False) as tmp_file:
            with open(backup_path, 'rb') as f_in:
                with gzip.open(tmp_file.name, 'wb') as f_out:
                    f_out.writelines(f_in)
            
            # 读取压缩文件内容
            with open(tmp_file.name, 'rb') as f:
                content = f.read()
            
            # 删除临时文件
            Path(tmp_file.name).unlink()
        
        # 返回文件响应
        return Response(
            content=content,
            media_type="application/gzip",
            headers={
                "Content-Disposition": f"attachment; filename=backup_{backup_id}.db.gz"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载备份失败: {str(e)}")

def _format_size(size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} TB"