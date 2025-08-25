# 小白也能懂的环境配置教程

## 1. 最简单的例子

### 🏠 日常生活类比

想象你是一个学生：
- **在家**：可以穿睡衣，大声说话，随便吃零食
- **在学校**：要穿校服，小声说话，按时吃饭

你还是同一个人，但在不同**环境**下，行为不同。

### 💻 程序也一样

你的程序：
- **在你电脑上（开发环境）**：连接本地数据库，显示详细错误，方便调试
- **在服务器上（生产环境）**：连接线上数据库，隐藏错误细节，保证安全

## 2. 环境变量 = 告诉程序在哪里

### 📝 创建配置文件

就像写便签纸一样简单：

**文件：.env.development（开发环境的便签）**
```
服务器地址=http://localhost:8080
显示错误=是
数据库名字=测试数据库
```

**文件：.env.production（生产环境的便签）**
```
服务器地址=http://45.149.156.216:3001
显示错误=否
数据库名字=正式数据库
```

### 🔧 实际的写法

**frontend/.env.development**
```bash
REACT_APP_API_URL=http://localhost:8080
REACT_APP_DEBUG=true
```

**frontend/.env.production**
```bash
REACT_APP_API_URL=http://45.149.156.216:3001
REACT_APP_DEBUG=false
```

## 3. 在代码中使用

### ❌ 错误方式（写死）
```javascript
// 每次部署都要改，很麻烦
const 服务器地址 = "http://localhost:8080";
```

### ✅ 正确方式（读配置）
```javascript
// 自动根据环境变化
const 服务器地址 = process.env.REACT_APP_API_URL;
```

## 4. 一键启动的魔法

我给你创建的 `start-dev.sh` 就像一个**智能管家**：

```bash
./start-dev.sh
```

它会自动：
1. 📋 复制开发环境的配置
2. 📦 安装需要的软件包
3. 🚀 启动前端和后端
4. 📝 告诉你访问地址

## 5. 实际操作步骤

### 第一步：看看配置文件

```bash
# 看前端配置
cat frontend/.env.development

# 看后端配置  
cat backend/.env.development
```

### 第二步：启动项目

```bash
# 一键启动所有服务
./start-dev.sh
```

### 第三步：访问网站

打开浏览器：
- 前端：http://localhost:3000
- 后端文档：http://localhost:8080/docs

### 第四步：停止服务

```bash
# 一键停止
./stop-dev.sh
```

## 6. 常见场景

### 场景1：修改API地址

1. 打开 `frontend/.env.development`
2. 修改 `REACT_APP_API_URL=新地址`
3. 重启服务 `./stop-dev.sh && ./start-dev.sh`

### 场景2：添加新配置

比如添加上传文件大小限制：

1. 在 `frontend/.env.development` 添加：
   ```
   REACT_APP_MAX_FILE_SIZE=10485760
   ```

2. 在代码中使用：
   ```javascript
   const 最大文件大小 = process.env.REACT_APP_MAX_FILE_SIZE;
   ```

### 场景3：部署到服务器

```bash
# 1. 构建生产版本
./build.sh

# 2. 提交代码
git add -A
git commit -m "更新功能"
git push

# 3. 自动部署（GitHub Actions会处理）
```

## 7. 记住这些规则

### 前端规则
- ✅ 变量必须以 `REACT_APP_` 开头
- ✅ 修改后要重启
- ✅ 不要把密码写在前端

### 后端规则
- ✅ 可以用任意变量名
- ✅ 敏感信息（密码）只放后端
- ✅ 不同环境用不同数据库

## 8. 调试技巧

### 看不到效果？

1. **检查变量名**
   ```javascript
   console.log(process.env.REACT_APP_API_URL);  // 应该输出地址
   ```

2. **确认文件位置**
   - 前端配置在 `frontend/` 文件夹
   - 后端配置在 `backend/` 文件夹

3. **重启服务**
   - 改了配置一定要重启！

## 9. 类比总结

| 日常生活 | 程序开发 |
|---------|---------|
| 在家/在学校 | 开发环境/生产环境 |
| 换衣服 | 切换配置 |
| 家规/校规 | .env.development/.env.production |
| 守规矩 | 读取环境变量 |

## 10. 你现在会了什么？

- ✅ 知道环境变量是什么（不同场合的规则）
- ✅ 会启动项目（./start-dev.sh）
- ✅ 会修改配置（编辑.env文件）
- ✅ 会使用配置（process.env.变量名）
- ✅ 会部署项目（./build.sh + git push）

## 下一步

1. 试试 `./start-dev.sh` 启动项目
2. 打开 `http://localhost:3000` 看看
3. 修改一个配置试试
4. 有问题随时问我！

记住：**环境配置 = 告诉程序现在在哪里，该怎么做**