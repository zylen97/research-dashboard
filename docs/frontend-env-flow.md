# 前端环境配置工作流程

## 1. 环境变量加载顺序

React 在构建时会按以下顺序加载环境变量：

```
1. .env                    # 所有环境的默认值
2. .env.local              # 本地覆盖（不提交到git）
3. .env.development        # 开发环境（npm start）
4. .env.production         # 生产环境（npm run build）
5. .env.development.local  # 开发环境本地覆盖
6. .env.production.local   # 生产环境本地覆盖
```

优先级：后加载的会覆盖先加载的

## 2. 环境变量命名规则

```javascript
// ✅ 正确：必须以 REACT_APP_ 开头
REACT_APP_API_URL=http://localhost:8080

// ❌ 错误：React不会识别
API_URL=http://localhost:8080
```

## 3. 构建时替换原理

构建前的代码：
```javascript
const apiUrl = process.env.REACT_APP_API_URL;
```

构建后的代码（开发环境）：
```javascript
const apiUrl = "http://localhost:8080";
```

构建后的代码（生产环境）：
```javascript
const apiUrl = "http://45.149.156.216:3001/api";
```

## 4. 我们的配置管理器

`frontend/src/config/env.ts` 的作用：

```typescript
// 原始方式（分散在各个文件）
const url = process.env.REACT_APP_API_URL || 'default';
const debug = process.env.REACT_APP_DEBUG === 'true';

// 使用配置管理器（集中管理）
import { config } from './config/env';
const url = config.apiUrl;
const debug = config.debug;
```

优势：
- 类型安全
- 默认值处理
- 集中管理
- 便于维护