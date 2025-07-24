"""
带字段别名的Pydantic模型示例
解决前后端字段命名不一致的问题
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class CollaboratorBaseWithAlias(BaseModel):
    """合作者基础模型 - 支持camelCase别名"""
    
    name: str = Field(..., description="姓名")
    gender: Optional[str] = Field(None, description="性别")
    student_id: Optional[str] = Field(None, alias="studentId", description="学号")
    grade: Optional[str] = Field(None, description="年级")
    major: Optional[str] = Field(None, description="专业")
    class_name: Optional[str] = Field(None, alias="className", description="班级")
    phone: Optional[str] = Field(None, description="电话")
    email: Optional[str] = Field(None, description="邮箱")
    qq: Optional[str] = Field(None, description="QQ")
    wechat: Optional[str] = Field(None, description="微信")
    skills: Optional[str] = Field(None, description="技能特长")
    research_interests: Optional[str] = Field(None, alias="researchInterests", description="研究兴趣")
    future_plan: Optional[str] = Field(None, alias="futurePlan", description="未来规划")
    is_senior: bool = Field(True, alias="isSenior", description="是否高年级")
    contact_info: Optional[str] = Field(None, alias="contactInfo", description="联系方式")
    
    class Config:
        # 允许通过字段名或别名填充
        allow_population_by_field_name = True
        # 导出时使用别名
        by_alias = True
        # JSON Schema也使用别名
        schema_extra = {
            "example": {
                "name": "张三",
                "gender": "男",
                "studentId": "2021001",
                "grade": "大三",
                "major": "计算机科学",
                "className": "计科2101",
                "isSenior": True,
                "futurePlan": "读研深造"
            }
        }


class ResearchProjectWithAlias(BaseModel):
    """研究项目模型 - 支持camelCase别名"""
    
    id: Optional[int] = Field(None, description="项目ID")
    idea_title: str = Field(..., alias="ideaTitle", description="想法标题")
    idea_description: str = Field(..., alias="ideaDescription", description="想法描述")
    idea_reason: Optional[str] = Field(None, alias="ideaReason", description="想法原因")
    expected_completion: Optional[str] = Field(None, alias="expectedCompletion", description="预期完成时间")
    todo_next: Optional[str] = Field(None, alias="todoNext", description="下一步计划")
    key_problems: Optional[str] = Field(None, alias="keyProblems", description="关键问题")
    progress_description: Optional[str] = Field(None, alias="progressDescription", description="进度描述")
    progress: float = Field(0.0, ge=0, le=100, description="进度百分比")
    status: str = Field("active", description="项目状态")
    priority: int = Field(1, ge=1, le=5, description="优先级")
    is_todo: bool = Field(False, alias="isTodo", description="是否为待办事项")
    created_at: Optional[datetime] = Field(None, alias="createdAt", description="创建时间")
    updated_at: Optional[datetime] = Field(None, alias="updatedAt", description="更新时间")
    
    # 关联
    collaborators: List["CollaboratorBaseWithAlias"] = Field(default_factory=list, description="合作者列表")
    
    class Config:
        allow_population_by_field_name = True
        by_alias = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class CommunicationLogWithAlias(BaseModel):
    """沟通记录模型 - 支持camelCase别名"""
    
    id: Optional[int] = Field(None, description="记录ID")
    project_id: int = Field(..., alias="projectId", description="项目ID")
    communication_date: datetime = Field(..., alias="communicationDate", description="沟通日期")
    participants: str = Field(..., description="参与人员")
    content: str = Field(..., description="沟通内容")
    next_steps: Optional[str] = Field(None, alias="nextSteps", description="下一步计划")
    action_items: Optional[str] = Field(None, alias="actionItems", description="行动项")
    
    class Config:
        allow_population_by_field_name = True
        by_alias = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# 统一的响应模型
class UnifiedApiResponse(BaseModel):
    """统一API响应格式"""
    
    success: bool = Field(..., description="请求是否成功")
    message: Optional[str] = Field(None, description="响应消息")
    data: Optional[any] = Field(None, description="响应数据")
    errors: Optional[List[str]] = Field(None, description="错误信息列表")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="响应时间戳")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        schema_extra = {
            "example": {
                "success": True,
                "message": "获取数据成功",
                "data": {"id": 1, "name": "示例"},
                "errors": None,
                "timestamp": "2025-07-24T10:30:00"
            }
        }


# 分页响应模型
class PaginatedResponse(BaseModel):
    """分页响应格式"""
    
    items: List[any] = Field(..., description="数据项列表")
    total: int = Field(..., description="总数")
    page: int = Field(1, ge=1, description="当前页")
    page_size: int = Field(10, ge=1, alias="pageSize", description="每页大小")
    total_pages: int = Field(..., alias="totalPages", description="总页数")
    
    class Config:
        allow_population_by_field_name = True
        by_alias = True


# 创建请求模型示例
class CollaboratorCreateRequest(BaseModel):
    """创建合作者请求 - 自动处理camelCase输入"""
    
    name: str = Field(..., min_length=1, max_length=100)
    gender: Optional[str] = Field(None, max_length=10)
    student_id: Optional[str] = Field(None, alias="studentId", max_length=50)
    grade: Optional[str] = Field(None, max_length=20)
    major: Optional[str] = Field(None, max_length=100)
    class_name: Optional[str] = Field(None, alias="className", max_length=50)
    is_senior: bool = Field(True, alias="isSenior")
    future_plan: Optional[str] = Field(None, alias="futurePlan")
    contact_info: Optional[str] = Field(None, alias="contactInfo")
    
    class Config:
        # 允许通过camelCase字段名填充
        allow_population_by_field_name = True
        # 内部使用snake_case
        by_alias = False
    
    def to_db_model(self):
        """转换为数据库模型所需的字典（snake_case）"""
        return self.dict(by_alias=False, exclude_unset=True)