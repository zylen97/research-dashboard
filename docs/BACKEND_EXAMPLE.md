# 后端开发示例：添加删除功能

## 1. 添加删除接口

```python
# backend/app/routes/research.py

@router.delete("/research/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db)
):
    # 1. 从数据库查找项目
    project = db.query(ResearchProject).filter(
        ResearchProject.id == project_id
    ).first()
    
    # 2. 如果找不到，返回错误
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 3. 从数据库删除
    db.delete(project)
    db.commit()
    
    # 4. 返回成功消息
    return {"message": "删除成功"}
```

## 2. 前端调用删除接口

```javascript
// frontend/src/pages/ProjectList.tsx

const deleteProject = async (projectId) => {
  // 1. 确认删除
  if (!confirm('确定要删除这个项目吗？')) {
    return;
  }
  
  // 2. 调用后端接口
  const response = await fetch(
    `http://localhost:8080/api/research/${projectId}`,
    { method: 'DELETE' }
  );
  
  // 3. 检查结果
  if (response.ok) {
    alert('删除成功！');
    // 4. 重新加载列表
    loadProjects();
  }
};
```

## 3. 数据库变化

删除前：
```
┌────┬──────────────┬────────┐
│ id │ title        │ status │
├────┼──────────────┼────────┤
│ 1  │ AI研究       │ active │
│ 2  │ 数据分析项目  │ done   │
└────┴──────────────┴────────┘
```

删除后（假设删除id=2）：
```
┌────┬──────────────┬────────┐
│ id │ title        │ status │
├────┼──────────────┼────────┤
│ 1  │ AI研究       │ active │
└────┴──────────────┴────────┘
```