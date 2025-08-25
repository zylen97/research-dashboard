# 实战示例：环境配置系统工作流程

让我们通过一个实际例子来理解整个系统是如何工作的。

## 场景：添加一个新功能 - 文件上传

假设我们要添加文件上传功能，需要在不同环境使用不同的配置。

### 步骤 1：添加环境配置

#### 前端配置

```bash
# frontend/.env.development
REACT_APP_MAX_FILE_SIZE=10485760  # 10MB
REACT_APP_UPLOAD_URL=http://localhost:8080/api/upload

# frontend/.env.production  
REACT_APP_MAX_FILE_SIZE=5242880   # 5MB (生产环境限制更严格)
REACT_APP_UPLOAD_URL=http://45.149.156.216:3001/api/upload
```

#### 后端配置

```bash
# backend/.env.development
UPLOAD_DIR=./uploads/dev
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_EXTENSIONS=jpg,png,pdf,docx

# backend/.env.production
UPLOAD_DIR=./uploads/prod  
MAX_UPLOAD_SIZE=5242880   # 5MB
ALLOWED_EXTENSIONS=jpg,png,pdf  # 生产环境不允许 docx
```

### 步骤 2：前端代码实现

```typescript
// frontend/src/components/FileUpload.tsx
import { config } from '../config/env';

export const FileUpload = () => {
  const handleUpload = async (file: File) => {
    // 1. 检查文件大小（使用环境配置）
    const maxSize = parseInt(process.env.REACT_APP_MAX_FILE_SIZE || '5242880');
    
    if (file.size > maxSize) {
      alert(`文件太大！最大允许 ${maxSize / 1024 / 1024}MB`);
      return;
    }
    
    // 2. 上传文件（使用环境配置的 URL）
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(process.env.REACT_APP_UPLOAD_URL!, {
      method: 'POST',
      body: formData
    });
    
    // 3. 环境感知的日志
    logger.debug('上传响应:', response);
    
    if (isDevelopment()) {
      console.log('开发环境：文件保存到 ./uploads/dev');
    }
  };
  
  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files![0])} />
      {config.debug && <p>调试模式：最大文件 {config.maxFileSize}字节</p>}
    </div>
  );
};
```

### 步骤 3：后端代码实现

```python
# backend/app/routes/upload.py
from fastapi import UploadFile, HTTPException
from app.core.config import settings
import os

@router.post("/upload")
async def upload_file(file: UploadFile):
    # 1. 检查文件大小（使用环境配置）
    if len(await file.read()) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            400, 
            f"文件太大！最大 {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
        )
    
    # 2. 检查文件类型（使用环境配置）
    ext = file.filename.split('.')[-1].lower()
    allowed = settings.ALLOWED_EXTENSIONS.split(',')
    
    if ext not in allowed:
        raise HTTPException(400, f"不允许的文件类型。允许: {allowed}")
    
    # 3. 保存文件（使用环境配置的路径）
    save_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    
    # 4. 环境感知的日志
    if settings.IS_DEVELOPMENT:
        logger.debug(f"保存文件到: {save_path}")
    else:
        logger.info(f"文件上传: {file.filename}")
    
    with open(save_path, "wb") as f:
        f.write(await file.read())
    
    return {"message": "上传成功", "path": save_path}
```

### 步骤 4：本地开发测试

```bash
# 启动开发环境
./start-dev.sh

# 系统自动：
# 1. 加载 .env.development 配置
# 2. 前端允许 10MB 文件
# 3. 后端保存到 ./uploads/dev/
# 4. 显示详细调试日志
```

测试时你会看到：
- 可以上传最大 10MB 的文件
- 支持 jpg, png, pdf, docx
- 文件保存在 `backend/uploads/dev/`
- 控制台显示详细日志

### 步骤 5：构建生产版本

```bash
# 构建生产版本
./build.sh

# 系统自动：
# 1. 使用 .env.production 配置
# 2. 将环境变量编译进代码
# 3. 移除调试代码
# 4. 压缩打包
```

### 步骤 6：部署到 VPS

```bash
git add -A
git commit -m "feat: Add file upload with env-specific limits"
git push

# GitHub Actions 自动：
# 1. 触发部署流程
# 2. SSH 到 VPS
# 3. 运行 vps-update.sh
```

### 步骤 7：生产环境行为

在 VPS 上：
- 只能上传最大 5MB 的文件
- 只支持 jpg, png, pdf（不支持 docx）
- 文件保存在 `backend/uploads/prod/`
- 只记录必要日志

## 🔍 调试过程

### 如果上传失败了怎么办？

#### 1. 检查前端配置
```javascript
// 浏览器控制台
console.log(process.env.REACT_APP_UPLOAD_URL);
console.log(process.env.REACT_APP_MAX_FILE_SIZE);
```

#### 2. 检查后端配置
```python
# 添加临时调试代码
print(f"Upload dir: {settings.UPLOAD_DIR}")
print(f"Max size: {settings.MAX_UPLOAD_SIZE}")
print(f"Allowed: {settings.ALLOWED_EXTENSIONS}")
```

#### 3. 检查网络请求
```javascript
// 浏览器开发者工具 → Network
// 查看请求 URL 是否正确
// 查看响应状态码和错误信息
```

## 🎯 关键理解点

1. **编译时替换**
   ```javascript
   // 源代码
   const url = process.env.REACT_APP_UPLOAD_URL;
   
   // 开发构建后
   const url = "http://localhost:8080/api/upload";
   
   // 生产构建后
   const url = "http://45.149.156.216:3001/api/upload";
   ```

2. **运行时读取**
   ```python
   # Python 在运行时读取环境变量
   settings.UPLOAD_DIR  # 每次运行可能不同
   ```

3. **环境隔离**
   - 开发数据不会影响生产
   - 生产配置不会泄露到开发
   - 每个环境独立运行

## 📋 检查清单

开发新功能时：
- [ ] 在 `.env.development` 添加开发配置
- [ ] 在 `.env.production` 添加生产配置
- [ ] 在配置管理器中添加类型定义
- [ ] 使用配置而不是硬编码值
- [ ] 添加环境感知的日志
- [ ] 测试两种环境的行为
- [ ] 更新文档

## 💡 最佳实践

1. **永远不要硬编码**
   ```javascript
   // ❌ 错误
   fetch('http://localhost:8080/api/data');
   
   // ✅ 正确
   fetch(`${config.apiUrl}/api/data`);
   ```

2. **提供合理默认值**
   ```typescript
   const timeout = process.env.REACT_APP_TIMEOUT || '30000';
   ```

3. **类型安全**
   ```typescript
   // 使用 TypeScript 接口
   interface Config {
     apiUrl: string;
     timeout: number;
   }
   ```

4. **文档化配置**
   ```bash
   # .env.example
   # API 超时时间（毫秒）
   # 默认: 30000 (30秒)
   REACT_APP_TIMEOUT=30000
   ```