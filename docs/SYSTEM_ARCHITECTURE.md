# 研究看板环境配置系统架构详解

## 一、系统整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     开发者电脑                             │
│  ┌─────────────────┐        ┌─────────────────────┐     │
│  │   前端 (React)   │  ←───→ │   后端 (FastAPI)    │     │
│  │   localhost:3000 │        │   localhost:8080    │     │
│  │                  │        │                     │     │
│  │ .env.development │        │ .env.development    │     │
│  └─────────────────┘        └─────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                              ⬇️
                         git push
                              ⬇️
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions                        │
│              自动触发部署流程 (deploy.yml)                 │
└─────────────────────────────────────────────────────────┘
                              ⬇️
                           SSH
                              ⬇️
┌─────────────────────────────────────────────────────────┐
│                    VPS 服务器                            │
│  ┌─────────────────┐        ┌─────────────────────┐     │
│  │   前端 (Nginx)   │  ←───→ │  后端 (Systemd)     │     │
│  │   端口:80/443    │        │   端口:3001         │     │
│  │                  │        │                     │     │
│  │ .env.production  │        │ .env.production     │     │
│  └─────────────────┘        └─────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## 二、环境变量工作原理

### 2.1 前端环境变量流程

```javascript
// 步骤1: 开发者在 .env.development 中定义
REACT_APP_API_URL=http://localhost:8080

// 步骤2: React 构建时读取
// webpack 在构建时会将 process.env.REACT_APP_API_URL 
// 替换为实际的字符串值

// 步骤3: 代码中使用
const response = await fetch(`${process.env.REACT_APP_API_URL}/api/data`);
// 构建后变成：
const response = await fetch(`http://localhost:8080/api/data`);
```

### 2.2 后端环境变量流程

```python
# 步骤1: Python 启动时加载 .env 文件
from dotenv import load_dotenv
load_dotenv('.env.development')  # 或 .env.production

# 步骤2: 通过 os.getenv 读取
import os
api_key = os.getenv('SECRET_KEY')

# 步骤3: 我们的配置系统
from app.core.config import settings
api_key = settings.SECRET_KEY  # 更安全、类型提示
```

## 三、配置系统核心组件

### 3.1 前端配置管理器工作原理

```typescript
// frontend/src/config/env.ts

// 1️⃣ 定义配置接口（类型安全）
export interface EnvironmentConfig {
  apiUrl: string;
  environment: 'development' | 'production' | 'test';
  debug: boolean;
  // ...
}

// 2️⃣ 读取环境变量并提供默认值
const getEnvConfig = (): EnvironmentConfig => {
  return {
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8080',
    environment: process.env.REACT_APP_ENVIRONMENT || 'development',
    debug: process.env.REACT_APP_DEBUG === 'true',
    // ...
  };
};

// 3️⃣ 导出单例配置对象
export const config = getEnvConfig();

// 4️⃣ 提供工具函数
export const logger = {
  debug: (...args) => {
    // 只在调试模式下输出
    if (config.debug) console.log('[DEBUG]', ...args);
  }
};
```

### 3.2 后端配置管理器工作原理

```python
# backend/app/core/config.py

# 1️⃣ 根据环境加载对应配置文件
env = os.getenv("ENVIRONMENT", "development")
env_file = f".env.{env}"
load_dotenv(env_file)

# 2️⃣ 配置类（集中管理所有配置）
class Settings:
    # 环境配置
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION: bool = ENVIRONMENT == "production"
    
    # 数据库配置（环境隔离）
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./research_dashboard.db"
    )
    
    # 3️⃣ 初始化时创建必要目录
    def __init__(self):
        self.DATA_DIR.mkdir(exist_ok=True)
        self.LOGS_DIR.mkdir(exist_ok=True)
        
        # 4️⃣ 生产环境安全检查
        if self.IS_PRODUCTION and self.SECRET_KEY == "default-key":
            raise ValueError("生产环境必须设置 SECRET_KEY!")

# 5️⃣ 创建全局实例
settings = Settings()
```

## 四、开发环境启动流程详解

当你运行 `./start-dev.sh` 时：

```bash
# 1. 环境检查
check_environment() {
    # 检查 Node.js 和 Python 是否安装
    command -v node  # 前端需要
    command -v python3  # 后端需要
}

# 2. 设置环境配置
setup_env() {
    # 前端：复制开发配置
    cp frontend/.env.development frontend/.env.local
    
    # 后端：复制开发配置
    cp backend/.env.development backend/.env
}

# 3. 安装依赖
install_dependencies() {
    # 前端依赖
    cd frontend && npm install
    
    # 后端虚拟环境
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
}

# 4. 启动服务
start_services() {
    # 后端启动（环境变量设置）
    export ENVIRONMENT=development
    python main.py &
    
    # 前端启动（自动读取 .env.development）
    npm start &
}
```

## 五、生产环境部署流程详解

### 5.1 构建流程

```bash
# 运行 ./build.sh 时

# 1. 设置生产环境配置
rm -f .env.production.local  # 清除本地覆盖

# 2. React 构建
npm run build
# - 读取 .env.production
# - 将所有 process.env.REACT_APP_* 替换为实际值
# - 压缩代码
# - 生成静态文件

# 3. 打包
tar -czf build.tar.gz build/
```

### 5.2 VPS 部署流程

```bash
# vps-update.sh 执行时

# 1. 拉取代码
git pull

# 2. 部署前端
tar -xzf frontend/build.tar.gz
cp -r build/* /var/www/html/  # Nginx 静态文件目录

# 3. 配置后端环境
cp backend/.env.production backend/.env
export ENVIRONMENT=production

# 4. 重启服务
systemctl restart research-backend
```

## 六、数据隔离策略

### 6.1 数据库隔离

```
开发环境：
backend/data/research_dashboard_dev.db

生产环境：
backend/data/research_dashboard_prod.db
```

### 6.2 日志隔离

```
开发环境：
- 日志级别：DEBUG
- 输出到：./logs/app_dev.log

生产环境：
- 日志级别：INFO
- 输出到：./logs/app_prod.log
```

## 七、安全机制

### 7.1 密钥管理

```python
# 开发环境（.env.development）
SECRET_KEY=dev-secret-key-for-local-testing  # 可以公开

# 生产环境（.env.production）
SECRET_KEY=your-production-secret-key-must-change-this  # 必须修改！
```

### 7.2 CORS 配置

```python
# 开发环境允许本地访问
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 生产环境只允许特定 IP
CORS_ORIGINS=http://45.149.156.216:3001
```

## 八、实际使用场景

### 场景1：添加新的 API 端点

```typescript
// 前端代码无需修改
const data = await fetch(`${config.apiUrl}/api/new-endpoint`);
// 开发时 → http://localhost:8080/api/new-endpoint
// 生产时 → http://45.149.156.216:3001/api/new-endpoint
```

### 场景2：调试生产环境问题

```typescript
// 使用环境感知的日志
logger.debug('用户数据:', userData);  // 只在开发环境显示
logger.error('API 错误:', error);     // 所有环境都显示
```

### 场景3：切换数据库

只需修改环境配置文件：
```env
# 从 SQLite 切换到 PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

## 九、优势总结

1. **一次编写，多处运行**：代码不含环境特定值
2. **配置集中管理**：所有配置在一个地方
3. **类型安全**：TypeScript 和 Python 类型提示
4. **安全隔离**：敏感信息不进入代码库
5. **快速切换**：一个命令切换环境
6. **自动化部署**：推送即部署

## 十、调试技巧

### 查看当前环境配置

```javascript
// 前端控制台
console.log(config);

// 后端日志
print(f"当前环境: {settings.ENVIRONMENT}")
print(f"数据库: {settings.DATABASE_URL}")
```

### 环境变量未生效？

1. 检查命名（前端必须 REACT_APP_ 开头）
2. 重启服务（环境变量在启动时加载）
3. 检查文件路径（.env 文件位置）
4. 查看构建输出（是否正确替换）