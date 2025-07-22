# USTS Research Dashboard - API Documentation

本文档详细说明USTS科研管理系统的所有API接口，包括认证、项目管理、文献管理等功能模块。

## 📋 目录

- [基础信息](#基础信息)
- [认证系统](#认证系统)  
- [项目管理](#项目管理)
- [合作者管理](#合作者管理)
- [文献管理](#文献管理)
- [AI批量匹配](#ai批量匹配)
- [Idea管理](#idea管理)
- [系统配置](#系统配置)
- [数据备份](#数据备份)
- [错误处理](#错误处理)

## 🌐 基础信息

### 服务器地址
- **开发环境**: `http://localhost:8080`
- **生产环境**: `http://45.149.156.216:8080`

### API基础路径
- **基础路径**: `/api`
- **API文档**: `/docs` (Swagger UI)
- **OpenAPI Schema**: `/openapi.json`

### 通用请求头
```http
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### 统一响应格式
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功",
  "timestamp": "2025-07-22T10:00:00Z"
}
```

## 🔐 认证系统

### POST /api/auth/login
用户登录获取JWT令牌

#### 请求参数
```json
{
  "username": "string",
  "password": "string"
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 604800,
    "user": {
      "id": 1,
      "username": "zl",
      "full_name": "张三",
      "is_active": true
    }
  },
  "message": "登录成功"
}
```

### GET /api/auth/me
获取当前用户信息

#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "zl",
    "full_name": "张三",
    "is_active": true
  }
}
```

## 📊 项目管理

### GET /api/research/
获取项目列表

#### 查询参数
- `skip` (int): 分页偏移量，默认0
- `limit` (int): 分页大小，默认100
- `status` (str): 项目状态筛选 (active/completed/paused)
- `is_todo` (bool): 待办事项筛选

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "AI文本分析研究",
      "idea_description": "利用深度学习进行文本情感分析",
      "status": "active",
      "progress": 65.5,
      "is_todo": true,
      "todo_marked_at": "2025-07-20T10:00:00Z",
      "start_date": "2025-07-01",
      "expected_end_date": "2025-12-31",
      "collaborators": [
        {
          "id": 1,
          "name": "李四",
          "role": "主要研究者"
        }
      ],
      "created_at": "2025-07-01T09:00:00Z",
      "updated_at": "2025-07-22T08:30:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/research/
创建新项目

#### 请求参数
```json
{
  "title": "string",
  "idea_description": "string",
  "status": "active",
  "progress": 0.0,
  "start_date": "2025-07-22",
  "expected_end_date": "2025-12-31",
  "collaborator_ids": [1, 2]
}
```

### PUT /api/research/{project_id}
更新项目信息

#### 路径参数
- `project_id` (int): 项目ID

#### 请求参数
```json
{
  "title": "string",
  "idea_description": "string", 
  "status": "completed",
  "progress": 100.0,
  "is_todo": false
}
```

### DELETE /api/research/{project_id}
删除项目

### GET /api/research/{project_id}/logs
获取项目交流日志

### POST /api/research/{project_id}/logs
添加项目交流日志

#### 请求参数
```json
{
  "communication_type": "meeting",
  "content": "讨论项目进展和下一步计划",
  "outcomes": "确定了技术路线",
  "action_items": "完成数据收集工作",
  "participants": ["张三", "李四"]
}
```

## 👥 合作者管理

### GET /api/collaborators/
获取合作者列表

#### 查询参数
- `skip` (int): 分页偏移量
- `limit` (int): 分页大小
- `search` (str): 搜索关键词
- `is_senior` (bool): 是否高级合作者

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "李四",
      "gender": "男",
      "class_info": "计算机科学22级",
      "contact": "li.si@example.com",
      "phone": "13812345678",
      "is_senior": true,
      "future_plans": "继续深造，攻读博士学位",
      "background": "本科期间专注于机器学习研究",
      "is_deleted": false,
      "created_at": "2025-06-01T10:00:00Z",
      "projects_count": 3
    }
  ],
  "total": 1
}
```

### POST /api/collaborators/
创建合作者

#### 请求参数
```json
{
  "name": "string",
  "gender": "男",
  "class_info": "string",
  "contact": "email@example.com",
  "phone": "13800000000",
  "is_senior": false,
  "future_plans": "string",
  "background": "string"
}
```

### POST /api/collaborators/upload
批量上传合作者（Excel文件）

#### 请求格式
- Content-Type: `multipart/form-data`
- 文件字段名: `file`
- 支持格式: `.xlsx`, `.xls`

#### 支持的Excel列名
- 姓名 / name
- 性别 / gender  
- 班级 / class_info
- 联系方式 / contact
- 电话 / phone
- 未来规划 / future_plans
- 背景 / background

### POST /api/collaborators/create-batch
批量创建合作者

#### 请求参数
```json
{
  "collaborators": [
    {
      "name": "张三",
      "gender": "男",
      "class_info": "软件工程21级"
    }
  ]
}
```

## 📚 文献管理

### GET /api/literature/
获取文献列表

#### 查询参数
- `skip` (int): 分页偏移量
- `limit` (int): 分页大小  
- `status_filter` (str): 状态筛选
- `validation_status` (str): 验证状态筛选

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Deep Learning for Natural Language Processing",
      "authors": "Zhang et al.",
      "journal": "Nature Machine Intelligence",
      "year": 2024,
      "doi": "10.1038/s42256-024-00001-1",
      "abstract": "本文介绍了深度学习在自然语言处理中的应用...",
      "keywords": "深度学习, NLP, 机器学习",
      "citation_count": 156,
      "validation_status": "validated",
      "validation_score": 0.85,
      "validation_reason": "高度相关的研究内容",
      "status": "active",
      "user_id": 1,
      "created_at": "2025-07-20T14:30:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/literature/
创建文献记录

#### 请求参数
```json
{
  "title": "string",
  "authors": "string",
  "journal": "string", 
  "year": 2024,
  "doi": "string",
  "abstract": "string",
  "keywords": "string",
  "citation_count": 0
}
```

### POST /api/literature/upload
批量上传文献（Excel文件）

#### 支持的Excel列名
- 标题 / title / Title
- 作者 / authors / Authors
- 期刊 / journal / Journal  
- 年份 / year / Year
- DOI / doi
- 摘要 / abstract / Abstract
- 关键词 / keywords / Keywords
- 引用数 / citation_count / citations

### PUT /api/literature/{literature_id}/convert-to-idea
将文献转换为Idea

#### 请求参数
```json
{
  "title": "基于该文献的新研究想法",
  "description": "详细描述研究思路",
  "difficulty_level": "medium",
  "estimated_duration": "6个月",
  "required_skills": "Python, 机器学习",
  "potential_impact": "高影响力研究",
  "priority": "high",
  "tags": "AI, 深度学习"
}
```

## 🤖 AI批量匹配

### POST /api/literature/batch-match
批量AI匹配文献

#### 请求参数
```json
{
  "literature_ids": [1, 2, 3],
  "prompt_template": "请评估以下文献是否与我的研究兴趣相关：\n\n{literature_info}\n\n请给出评估结果和理由。",
  "ai_provider": "openai"
}
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "literature_id": 1,
        "status": "matched",
        "score": 0.85,
        "reason": "该文献与您的研究方向高度相关...",
        "ai_response": "详细的AI分析结果..."
      }
    ],
    "total_processed": 3,
    "successful_count": 2,
    "error_count": 1
  },
  "message": "Processed 3 items in 4.25s (avg: 1.42s/item, 5 concurrent)"
}
```

### GET /api/literature/prompts
获取预定义提示模板

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": "research_relevance", 
      "name": "研究相关性评估",
      "template": "请评估以下文献是否与我的研究兴趣相关：\n\n{literature_info}..."
    },
    {
      "id": "idea_potential",
      "name": "创意潜力评估", 
      "template": "请评估以下文献是否能够启发新的研究创意：\n\n{literature_info}..."
    }
  ]
}
```

### GET /api/literature/batch-match/stats
获取批量匹配性能统计

#### 响应示例
```json
{
  "success": true,
  "data": {
    "performance_stats": {
      "total_requests": 156,
      "successful_requests": 142,
      "failed_requests": 14,
      "average_processing_time": 1.85,
      "retry_count": 8
    },
    "success_rate": 0.91,
    "configuration": {
      "batch_size_limit": 50,
      "max_concurrent": 5,
      "max_retries": 2
    },
    "optimization_features": [
      "并发处理（最大5个并发）",
      "HTTP连接池复用",
      "批量数据库操作",
      "智能重试机制（最大2次）",
      "性能监控和统计"
    ]
  }
}
```

## 💡 Idea管理

### GET /api/ideas/
获取Idea列表

#### 查询参数
- `skip` (int): 分页偏移量
- `limit` (int): 分页大小
- `status` (str): 状态筛选 (pending/in_progress/adopted/rejected)
- `priority` (str): 优先级筛选 (low/medium/high)

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "基于BERT的情感分析优化",
      "description": "改进BERT模型在中文情感分析任务上的性能",
      "status": "in_progress",
      "priority": "high",
      "difficulty_level": "medium",
      "estimated_duration": "3个月",
      "required_skills": "Python, PyTorch, NLP",
      "potential_impact": "可显著提升中文情感分析准确率",
      "source": "literature",
      "source_literature_id": 1,
      "tags": "NLP, 深度学习",
      "user_id": 1,
      "created_at": "2025-07-21T16:00:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/ideas/
创建Idea

#### 请求参数
```json
{
  "title": "string",
  "description": "string", 
  "priority": "medium",
  "difficulty_level": "medium",
  "estimated_duration": "string",
  "required_skills": "string", 
  "potential_impact": "string",
  "tags": "string"
}
```

### POST /api/ideas/{idea_id}/convert-to-project
将Idea转换为项目

#### 请求参数
```json
{
  "title": "项目标题",
  "start_date": "2025-07-22",
  "expected_end_date": "2025-10-22",
  "collaborator_ids": [1, 2]
}
```

### GET /api/ideas/stats/summary
获取Idea统计汇总

#### 响应示例
```json
{
  "success": true,
  "data": {
    "total_ideas": 25,
    "by_status": {
      "pending": 8,
      "in_progress": 10, 
      "adopted": 5,
      "rejected": 2
    },
    "by_priority": {
      "high": 12,
      "medium": 8,
      "low": 5
    },
    "recent_ideas": 3,
    "conversion_rate": 0.20
  }
}
```

## ⚙️ 系统配置

### GET /api/config/
获取系统配置列表

#### 查询参数
- `category` (str): 配置分类筛选 (ai_api/system)
- `is_active` (bool): 是否激活

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "key": "ai_provider_openai",
      "category": "ai_api",
      "description": "OpenAI API配置",
      "is_active": true,
      "is_encrypted": true,
      "created_at": "2025-07-20T12:00:00Z",
      "updated_at": "2025-07-22T09:15:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/config/
创建系统配置

#### 请求参数
```json
{
  "key": "ai_provider_custom",
  "value": {
    "api_key": "your-api-key",
    "api_url": "https://api.example.com/v1/chat/completions",
    "model": "custom-model",
    "max_tokens": 1000
  },
  "category": "ai_api",
  "description": "自定义AI提供商配置"
}
```

### GET /api/config/ai/providers
获取AI提供商配置

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "provider": "openai",
      "name": "OpenAI",
      "is_configured": true,
      "is_active": true
    },
    {
      "provider": "anthropic", 
      "name": "Anthropic Claude",
      "is_configured": false,
      "is_active": false
    }
  ]
}
```

### POST /api/config/ai/providers
测试AI提供商配置

#### 请求参数
```json
{
  "provider": "openai",
  "config": {
    "api_key": "test-key",
    "model": "gpt-3.5-turbo"
  }
}
```

## 💾 数据备份

### GET /api/backup/stats
获取备份统计信息

#### 响应示例
```json
{
  "success": true,
  "data": {
    "total_backups": 5,
    "latest_backup": "2025-07-22T08:00:00Z",
    "total_size": "15.2 MB",
    "data_summary": {
      "collaborators": 28,
      "projects": 15,
      "literature": 45,
      "ideas": 32,
      "communication_logs": 78
    }
  }
}
```

### GET /api/backup/list
获取备份文件列表

#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "backup_20250722_080000.db.gz",
      "size": "3.2 MB",
      "type": "auto",
      "description": "自动备份",
      "created_at": "2025-07-22T08:00:00Z"
    }
  ],
  "total": 1
}
```

### POST /api/backup/create
创建备份

#### 请求参数
```json
{
  "description": "手动备份 - 重要更新前",
  "type": "manual"
}
```

### POST /api/backup/restore/{backup_id}
恢复备份

### DELETE /api/backup/{backup_id}
删除备份

## ❌ 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": {
      "field": "email",
      "message": "邮箱格式不正确"
    }
  },
  "timestamp": "2025-07-22T10:00:00Z"
}
```

### 常见错误代码

| 状态码 | 错误代码 | 说明 |
|--------|----------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 401 | UNAUTHORIZED | 未认证或令牌无效 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 资源冲突（如重复创建） |
| 422 | UNPROCESSABLE_ENTITY | 请求格式正确但语义错误 |
| 429 | RATE_LIMIT_EXCEEDED | 请求频率超限 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |
| 503 | SERVICE_UNAVAILABLE | 服务暂时不可用 |

### AI API特定错误

| 错误代码 | 说明 | 解决方案 |
|----------|------|----------|
| AI_CONFIG_NOT_FOUND | AI提供商配置不存在 | 在系统配置中添加AI提供商配置 |
| AI_API_KEY_INVALID | API密钥无效 | 检查并更新API密钥 |
| AI_API_TIMEOUT | API调用超时 | 检查网络连接，稍后重试 |
| AI_API_RATE_LIMIT | API调用频率超限 | 等待一段时间后重试 |
| AI_BATCH_SIZE_EXCEEDED | 批处理大小超限 | 减少批处理数量（最大50项） |

## 🔧 开发说明

### 认证机制
- 使用JWT Bearer Token认证
- Token有效期：7天
- 需要在请求头中包含：`Authorization: Bearer <token>`

### 分页
- 使用`skip`和`limit`参数进行分页
- 默认每页100条记录
- 响应中包含`total`字段表示总记录数

### 数据验证
- 所有请求参数都会进行严格的数据验证
- 使用Pydantic模型确保类型安全
- 验证失败时返回详细的错误信息

### 性能优化
- 数据库查询使用索引优化
- API响应时间 < 2秒
- 支持并发处理（最大5个并发请求）
- HTTP连接池复用

### 安全措施
- 敏感配置信息使用AES加密存储
- 用户数据完全隔离
- SQL注入防护
- XSS攻击防护

---

📝 **API文档版本**: v1.0  
🕒 **最后更新**: 2025-07-22  
🔗 **在线API文档**: [Swagger UI](http://45.149.156.216:8080/docs)