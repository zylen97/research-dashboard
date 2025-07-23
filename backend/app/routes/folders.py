#!/usr/bin/env python3
"""
文献文件夹管理路由
支持层级文件夹结构和文献组织
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
import logging

from app.models.database import get_db, User, LiteratureFolder, Literature
from app.models.schemas import (
    LiteratureFolderCreate, LiteratureFolderUpdate, LiteratureFolder as LiteratureFolderSchema,
    FolderTreeNode, Literature as LiteratureSchema
)
from app.utils.auth import get_current_user
from app.utils.response import success_response

router = APIRouter(prefix="/api/folders", tags=["文献文件夹"])
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[LiteratureFolderSchema])
async def get_folders(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取当前用户的所有文件夹"""
    try:
        folders = db.query(LiteratureFolder).filter(
            LiteratureFolder.user_id == current_user.id
        ).order_by(
            LiteratureFolder.sort_order,
            LiteratureFolder.created_at
        ).all()
        
        logger.info(f"用户 {current_user.username} 获取到 {len(folders)} 个文件夹")
        return folders
    except Exception as e:
        logger.error(f"获取文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件夹失败: {str(e)}")

@router.get("/tree", response_model=List[FolderTreeNode])
async def get_folder_tree(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取文件夹的树形结构"""
    try:
        # 获取所有文件夹
        folders = db.query(LiteratureFolder).filter(
            LiteratureFolder.user_id == current_user.id
        ).order_by(
            LiteratureFolder.sort_order,
            LiteratureFolder.created_at
        ).all()
        
        # 扁平化文件夹结构：直接将所有文件夹作为根级别显示
        tree = []
        
        for folder in folders:
            # 计算该文件夹中的文献数量
            literature_count = db.query(Literature).filter(
                and_(
                    Literature.folder_id == folder.id,
                    Literature.user_id == current_user.id
                )
            ).count()
            
            # 创建扁平化的文件夹节点
            tree_node = FolderTreeNode(
                id=folder.id,
                name=folder.name,
                description=folder.description,
                parent_id=None,  # 扁平化：所有文件夹都显示为根级别
                is_root=folder.is_root,
                sort_order=folder.sort_order,
                literature_count=literature_count,
                children=[],  # 扁平化：没有子文件夹
                created_at=folder.created_at,
                updated_at=folder.updated_at
            )
            tree.append(tree_node)
        
        # 按sort_order和创建时间排序
        tree.sort(key=lambda x: (x.sort_order, x.created_at))
        logger.info(f"用户 {current_user.username} 获取扁平化文件夹树成功，文件夹数: {len(tree)}")
        return tree
    except Exception as e:
        logger.error(f"获取文件夹树失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件夹树失败: {str(e)}")

@router.get("/{folder_id}", response_model=LiteratureFolderSchema)
async def get_folder(
    folder_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取单个文件夹详情"""
    try:
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        logger.info(f"用户 {current_user.username} 获取文件夹 {folder.name} 详情")
        return folder
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文件夹详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件夹详情失败: {str(e)}")

@router.post("/", response_model=LiteratureFolderSchema)
async def create_folder(
    folder_data: LiteratureFolderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建新文件夹（扁平化结构：所有新文件夹都是根级别）"""
    try:
        # 扁平化结构：忽略前端传入的parent_id，强制创建根级别文件夹
        logger.info(f"用户 {current_user.username} 请求创建文件夹: {folder_data.name}")
        
        # 检查当前用户是否已有同名根文件夹
        existing_folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.name == folder_data.name,
                LiteratureFolder.parent_id.is_(None),  # 只检查根级别文件夹
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if existing_folder:
            raise HTTPException(status_code=400, detail="已存在同名文件夹")
        
        # 创建扁平化的根级别文件夹
        folder = LiteratureFolder(
            name=folder_data.name,
            description=folder_data.description,
            parent_id=None,  # 强制设为None（根级别）
            user_id=current_user.id,
            group_name=current_user.username,  # 用户隔离标识
            is_root=False,  # 用户创建的文件夹不是系统根文件夹
            sort_order=folder_data.sort_order or 0
        )
        
        db.add(folder)
        db.commit()
        db.refresh(folder)
        
        logger.info(f"用户 {current_user.username} 创建根级别文件夹 {folder.name} 成功 (ID: {folder.id})")
        return folder
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建文件夹失败: {str(e)}")

@router.put("/{folder_id}", response_model=LiteratureFolderSchema)
async def update_folder(
    folder_id: int,
    folder_data: LiteratureFolderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新文件夹（扁平化结构：禁止修改根文件夹）"""
    try:
        # 查找文件夹
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        # 禁止修改系统根文件夹
        if folder.is_root:
            raise HTTPException(status_code=403, detail="系统根文件夹不能修改")
        
        # 扁平化结构：忽略parent_id更新，保持所有文件夹为根级别
        logger.info(f"用户 {current_user.username} 更新文件夹 {folder.name}")
        
        # 检查重名（扁平化结构：只需检查根级别重名）
        if folder_data.name and folder_data.name != folder.name:
            existing_folder = db.query(LiteratureFolder).filter(
                and_(
                    LiteratureFolder.name == folder_data.name,
                    LiteratureFolder.parent_id.is_(None),  # 只检查根级别
                    LiteratureFolder.user_id == current_user.id,
                    LiteratureFolder.id != folder_id
                )
            ).first()
            
            if existing_folder:
                raise HTTPException(status_code=400, detail="已存在同名文件夹")
        
        # 更新字段（扁平化结构：不允许修改parent_id）
        if folder_data.name is not None:
            folder.name = folder_data.name
        if folder_data.description is not None:
            folder.description = folder_data.description
        # 扁平化结构：不更新parent_id，保持为None
        if folder_data.sort_order is not None:
            folder.sort_order = folder_data.sort_order
        
        db.commit()
        db.refresh(folder)
        
        logger.info(f"用户 {current_user.username} 更新文件夹 {folder.name} 成功")
        return folder
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新文件夹失败: {str(e)}")

@router.delete("/{folder_id}")
async def delete_folder(
    folder_id: int,
    request: Request,
    move_to_parent: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除文件夹"""
    try:
        # 查找文件夹
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        # 不允许删除根文件夹
        if folder.is_root:
            raise HTTPException(status_code=400, detail="不能删除根文件夹")
        
        # 处理子文件夹
        child_folders = db.query(LiteratureFolder).filter(
            LiteratureFolder.parent_id == folder.id
        ).all()
        
        if move_to_parent:
            # 将子文件夹移动到父文件夹
            for child in child_folders:
                child.parent_id = folder.parent_id
                child.is_root = folder.parent_id is None
        else:
            # 递归删除子文件夹
            for child in child_folders:
                await delete_folder(child.id, move_to_parent, request, db, current_user)
        
        # 处理文件夹中的文献
        literature_in_folder = db.query(Literature).filter(
            Literature.folder_id == folder.id
        ).all()
        
        if move_to_parent:
            # 将文献移动到父文件夹（如果有的话）
            for literature in literature_in_folder:
                literature.folder_id = folder.parent_id
        else:
            # 将文献的folder_id设为None
            for literature in literature_in_folder:
                literature.folder_id = None
        
        # 删除文件夹
        db.delete(folder)
        db.commit()
        
        logger.info(f"用户 {current_user.username} 删除文件夹 {folder.name} 成功")
        return success_response(message=f"文件夹 '{folder.name}' 删除成功")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"删除文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除文件夹失败: {str(e)}")

@router.put("/{folder_id}/move", response_model=LiteratureFolderSchema)
async def move_folder(
    folder_id: int,
    move_data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """移动文件夹到新的父文件夹"""
    try:
        new_parent_id = move_data.get('parent_id')
        
        # 查找要移动的文件夹
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        # 验证新的父文件夹
        if new_parent_id:
            parent_folder = db.query(LiteratureFolder).filter(
                and_(
                    LiteratureFolder.id == new_parent_id,
                    LiteratureFolder.user_id == current_user.id
                )
            ).first()
            if not parent_folder:
                raise HTTPException(status_code=404, detail="目标父文件夹不存在")
            
            # 检查不能移动到自己的子文件夹中
            def is_descendant(parent_id, target_id):
                if parent_id == target_id:
                    return True
                children = db.query(LiteratureFolder).filter(
                    LiteratureFolder.parent_id == target_id
                ).all()
                for child in children:
                    if is_descendant(parent_id, child.id):
                        return True
                return False
            
            if is_descendant(folder.id, new_parent_id):
                raise HTTPException(status_code=400, detail="不能将文件夹移动到自己的子文件夹中")
        
        # 检查目标位置是否有同名文件夹
        existing_folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.name == folder.name,
                LiteratureFolder.parent_id == new_parent_id,
                LiteratureFolder.user_id == current_user.id,
                LiteratureFolder.id != folder_id
            )
        ).first()
        
        if existing_folder:
            raise HTTPException(status_code=400, detail="目标位置已存在同名文件夹")
        
        # 移动文件夹
        folder.parent_id = new_parent_id
        folder.is_root = new_parent_id is None
        
        db.commit()
        db.refresh(folder)
        
        logger.info(f"用户 {current_user.username} 移动文件夹 {folder.name} 成功")
        return folder
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"移动文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"移动文件夹失败: {str(e)}")

@router.get("/{folder_id}/literature", response_model=List[LiteratureSchema])
async def get_folder_literature(
    folder_id: int,
    request: Request,
    include_subfolders: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取文件夹中的文献"""
    try:
        # 验证文件夹存在且属于当前用户
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        if include_subfolders:
            # 获取所有子文件夹ID
            def get_all_subfolder_ids(parent_id):
                folder_ids = [parent_id]
                child_folders = db.query(LiteratureFolder).filter(
                    LiteratureFolder.parent_id == parent_id
                ).all()
                for child in child_folders:
                    folder_ids.extend(get_all_subfolder_ids(child.id))
                return folder_ids
            
            folder_ids = get_all_subfolder_ids(folder_id)
            
            # 获取所有相关文献
            literature = db.query(Literature).filter(
                and_(
                    Literature.folder_id.in_(folder_ids),
                    Literature.user_id == current_user.id
                )
            ).order_by(desc(Literature.created_at)).all()
        else:
            # 只获取当前文件夹中的文献
            literature = db.query(Literature).filter(
                and_(
                    Literature.folder_id == folder_id,
                    Literature.user_id == current_user.id
                )
            ).order_by(desc(Literature.created_at)).all()
        
        logger.info(f"用户 {current_user.username} 获取文件夹 {folder.name} 中的 {len(literature)} 篇文献")
        return literature
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取文件夹文献失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文件夹文献失败: {str(e)}")

@router.post("/{folder_id}/literature/{literature_id}")
async def move_literature_to_folder(
    folder_id: int,
    literature_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """将文献移动到指定文件夹"""
    try:
        # 验证文件夹
        folder = db.query(LiteratureFolder).filter(
            and_(
                LiteratureFolder.id == folder_id,
                LiteratureFolder.user_id == current_user.id
            )
        ).first()
        
        if not folder:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        # 验证文献
        literature = db.query(Literature).filter(
            and_(
                Literature.id == literature_id,
                Literature.user_id == current_user.id
            )
        ).first()
        
        if not literature:
            raise HTTPException(status_code=404, detail="文献不存在")
        
        # 移动文献
        literature.folder_id = folder_id
        db.commit()
        
        logger.info(f"用户 {current_user.username} 将文献 {literature.title} 移动到文件夹 {folder.name}")
        return success_response(message="文献移动成功")
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"移动文献到文件夹失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"移动文献到文件夹失败: {str(e)}")