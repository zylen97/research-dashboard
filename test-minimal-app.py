#!/usr/bin/env python3
"""
极简FastAPI测试应用 - 用于诊断502问题
不依赖任何数据库、配置文件或复杂逻辑
"""

print("=== 开始极简FastAPI测试 ===")

# 1. 测试基础导入
try:
    import sys
    print(f"✅ Python版本: {sys.version}")
except Exception as e:
    print(f"❌ 基础导入失败: {e}")
    exit(1)

# 2. 测试FastAPI导入
try:
    from fastapi import FastAPI
    print("✅ FastAPI导入成功")
except Exception as e:
    print(f"❌ FastAPI导入失败: {e}")
    exit(1)

# 3. 测试Uvicorn导入
try:
    import uvicorn
    print("✅ Uvicorn导入成功")
except Exception as e:
    print(f"❌ Uvicorn导入失败: {e}")
    exit(1)

# 4. 创建最简单的应用
try:
    app = FastAPI(title="极简测试")
    print("✅ FastAPI应用创建成功")
except Exception as e:
    print(f"❌ FastAPI应用创建失败: {e}")
    exit(1)

# 5. 添加最简单的路由
@app.get("/")
def read_root():
    return {"status": "alive", "message": "极简FastAPI正在运行"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

print("✅ 路由添加成功")

# 6. 启动应用
if __name__ == "__main__":
    print("🚀 尝试启动极简FastAPI应用...")
    print("访问 http://localhost:8080 测试")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8080, log_level="debug")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        import traceback
        traceback.print_exc()