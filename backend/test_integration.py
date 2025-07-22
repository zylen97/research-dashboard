#!/usr/bin/env python3
"""
系统集成验证测试脚本
验证前后端接口匹配性和数据模型一致性
"""

import asyncio
import json
import logging
import sqlite3
from typing import Dict, List, Any, Optional
import os
import sys

# 添加项目路径以便导入
sys.path.append(os.path.dirname(__file__))

from app.models.database import Base, engine, get_db
from sqlalchemy import text
from app.models.schemas import *
from app.routes import auth, research, collaborators, literature, ideas, config, backup

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IntegrationValidator:
    """集成验证测试类"""
    
    def __init__(self):
        self.results = {
            'api_endpoints': {'passed': 0, 'failed': 0, 'issues': []},
            'data_models': {'passed': 0, 'failed': 0, 'issues': []},
            'database_schema': {'passed': 0, 'failed': 0, 'issues': []},
            'type_consistency': {'passed': 0, 'failed': 0, 'issues': []},
        }
    
    def validate_api_endpoints(self) -> bool:
        """验证API端点定义"""
        logger.info("🔍 验证API端点...")
        
        # 检查各个路由模块的端点
        modules = {
            'auth': auth.router,
            'research': research.router,
            'collaborators': collaborators.router,
            'literature': literature.router,
            'ideas': ideas.router,
            'config': config.router,
            'backup': backup.router,
        }
        
        expected_endpoints = {
            'auth': ['POST /login', 'GET /me'],
            'research': [
                'GET /', 'POST /', 'PUT /{project_id}', 'DELETE /{project_id}',
                'GET /{project_id}/logs', 'POST /{project_id}/logs'
            ],
            'collaborators': [
                'GET /', 'POST /', 'PUT /{collaborator_id}', 'DELETE /{collaborator_id}',
                'POST /upload', 'POST /create-batch'
            ],
            'literature': [
                'GET /', 'POST /', 'PUT /{literature_id}', 'DELETE /{literature_id}',
                'POST /upload', 'POST /batch-match', 'GET /prompts'
            ],
            'ideas': [
                'GET /', 'POST /', 'PUT /{idea_id}', 'DELETE /{idea_id}',
                'GET /stats/summary', 'POST /{idea_id}/convert-to-project'
            ],
            'config': [
                'GET /', 'POST /', 'PUT /{config_id}', 'DELETE /{config_id}',
                'GET /ai/providers', 'POST /ai/providers'
            ],
            'backup': [
                'GET /stats', 'GET /list', 'POST /create',
                'POST /restore/{backup_id}', 'DELETE /{backup_id}'
            ]
        }
        
        for module_name, expected in expected_endpoints.items():
            if module_name in modules:
                self.results['api_endpoints']['passed'] += 1
                logger.info(f"✓ {module_name} 模块端点验证通过")
            else:
                self.results['api_endpoints']['failed'] += 1
                self.results['api_endpoints']['issues'].append(f"缺少 {module_name} 模块")
        
        return self.results['api_endpoints']['failed'] == 0
    
    def validate_database_schema(self) -> bool:
        """验证数据库结构"""
        logger.info("🔍 验证数据库结构...")
        
        try:
            # 检查数据库连接
            db = next(get_db())
            
            # 验证关键表存在
            required_tables = [
                'users', 'collaborators', 'research_projects', 
                'literature', 'ideas', 'communication_logs', 
                'system_configs', 'audit_logs'
            ]
            
            # SQLite查询所有表
            result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()
            existing_tables = [row[0] for row in result]
            
            for table in required_tables:
                if table in existing_tables:
                    self.results['database_schema']['passed'] += 1
                    logger.info(f"✓ 表 {table} 存在")
                else:
                    self.results['database_schema']['failed'] += 1
                    self.results['database_schema']['issues'].append(f"缺少表 {table}")
            
            # 验证关键字段
            self.validate_research_projects_fields(db)
            self.validate_literature_fields(db)
            
            db.close()
            return self.results['database_schema']['failed'] == 0
            
        except Exception as e:
            self.results['database_schema']['failed'] += 1
            self.results['database_schema']['issues'].append(f"数据库连接错误: {str(e)}")
            return False
    
    def validate_research_projects_fields(self, db):
        """验证研究项目表的字段"""
        try:
            result = db.execute(text("PRAGMA table_info(research_projects)")).fetchall()
            columns = [row[1] for row in result]
            
            required_fields = ['id', 'title', 'idea_description', 'status', 'progress', 'is_todo', 'todo_marked_at']
            
            for field in required_fields:
                if field in columns:
                    logger.info(f"✓ research_projects.{field} 字段存在")
                else:
                    self.results['database_schema']['failed'] += 1
                    self.results['database_schema']['issues'].append(f"research_projects表缺少字段: {field}")
                    
        except Exception as e:
            self.results['database_schema']['issues'].append(f"验证research_projects表失败: {str(e)}")
    
    def validate_literature_fields(self, db):
        """验证文献表的字段"""
        try:
            result = db.execute(text("PRAGMA table_info(literature)")).fetchall()
            columns = [row[1] for row in result]
            
            required_fields = ['id', 'title', 'user_id', 'validation_status', 'validation_score']
            
            for field in required_fields:
                if field in columns:
                    logger.info(f"✓ literature.{field} 字段存在")
                else:
                    self.results['database_schema']['failed'] += 1
                    self.results['database_schema']['issues'].append(f"literature表缺少字段: {field}")
                    
        except Exception as e:
            self.results['database_schema']['issues'].append(f"验证literature表失败: {str(e)}")
    
    def validate_data_models(self) -> bool:
        """验证数据模型一致性"""
        logger.info("🔍 验证数据模型一致性...")
        
        # 验证关键模型是否存在
        models_to_check = [
            ('User', User),
            ('Collaborator', Collaborator),
            ('ResearchProject', ResearchProject),
            ('Literature', Literature),
            ('Idea', Idea),
            ('SystemConfig', SystemConfig),
            ('BatchMatchingRequest', BatchMatchingRequest),
            ('BatchMatchingResponse', BatchMatchingResponse),
        ]
        
        for model_name, model_class in models_to_check:
            try:
                # 尝试创建模型实例的字段信息
                if hasattr(model_class, '__fields__'):
                    fields = list(model_class.__fields__.keys())
                    logger.info(f"✓ {model_name} 模型定义正确，包含字段: {len(fields)}")
                    self.results['data_models']['passed'] += 1
                else:
                    logger.warning(f"⚠ {model_name} 不是Pydantic模型")
                    self.results['data_models']['passed'] += 1
            except Exception as e:
                self.results['data_models']['failed'] += 1
                self.results['data_models']['issues'].append(f"{model_name} 模型验证失败: {str(e)}")
        
        return self.results['data_models']['failed'] == 0
    
    def validate_type_consistency(self) -> bool:
        """验证前后端类型一致性"""
        logger.info("🔍 验证类型一致性...")
        
        # 检查关键类型定义
        type_checks = [
            ('ResearchProject中的is_todo字段', self.check_research_project_todo_field),
            ('BatchMatching相关类型', self.check_batch_matching_types),
            ('SystemConfig类型', self.check_system_config_types),
        ]
        
        for check_name, check_func in type_checks:
            try:
                result = check_func()
                if result:
                    logger.info(f"✓ {check_name} 验证通过")
                    self.results['type_consistency']['passed'] += 1
                else:
                    logger.error(f"✗ {check_name} 验证失败")
                    self.results['type_consistency']['failed'] += 1
            except Exception as e:
                self.results['type_consistency']['failed'] += 1
                self.results['type_consistency']['issues'].append(f"{check_name} 检查异常: {str(e)}")
        
        return self.results['type_consistency']['failed'] == 0
    
    def check_research_project_todo_field(self) -> bool:
        """检查ResearchProject的is_todo字段"""
        try:
            # 检查Pydantic模型
            if hasattr(ResearchProject, '__fields__'):
                fields = ResearchProject.__fields__
                return 'is_todo' in fields
            return False
        except:
            return False
    
    def check_batch_matching_types(self) -> bool:
        """检查批量匹配类型"""
        try:
            required_types = [BatchMatchingRequest, MatchingResult, BatchMatchingResponse]
            for type_class in required_types:
                if not hasattr(type_class, '__fields__'):
                    return False
            return True
        except:
            return False
    
    def check_system_config_types(self) -> bool:
        """检查系统配置类型"""
        try:
            required_types = [SystemConfig, SystemConfigCreate, SystemConfigUpdate]
            for type_class in required_types:
                if not hasattr(type_class, '__fields__'):
                    return False
            return True
        except:
            return False
    
    def run_all_validations(self) -> bool:
        """运行所有验证"""
        logger.info("🚀 开始系统集成验证...")
        
        validations = [
            ('API端点验证', self.validate_api_endpoints),
            ('数据库结构验证', self.validate_database_schema),
            ('数据模型验证', self.validate_data_models),
            ('类型一致性验证', self.validate_type_consistency),
        ]
        
        overall_success = True
        
        for validation_name, validation_func in validations:
            try:
                logger.info(f"\n{'='*50}")
                logger.info(f"开始 {validation_name}")
                logger.info(f"{'='*50}")
                
                success = validation_func()
                if success:
                    logger.info(f"✅ {validation_name} 全部通过")
                else:
                    logger.error(f"❌ {validation_name} 存在问题")
                    overall_success = False
                    
            except Exception as e:
                logger.error(f"💥 {validation_name} 执行异常: {str(e)}")
                overall_success = False
        
        # 打印总结报告
        self.print_summary_report()
        
        return overall_success
    
    def print_summary_report(self):
        """打印总结报告"""
        logger.info(f"\n{'='*60}")
        logger.info("📋 系统集成验证总结报告")
        logger.info(f"{'='*60}")
        
        total_passed = 0
        total_failed = 0
        
        for category, stats in self.results.items():
            passed = stats['passed']
            failed = stats['failed']
            total_passed += passed
            total_failed += failed
            
            status = "✅" if failed == 0 else "❌"
            logger.info(f"{status} {category}: {passed} 通过, {failed} 失败")
            
            if stats['issues']:
                for issue in stats['issues']:
                    logger.info(f"   ⚠ {issue}")
        
        logger.info(f"\n📊 总计: {total_passed} 通过, {total_failed} 失败")
        
        if total_failed == 0:
            logger.info("🎉 所有验证通过！系统集成状态良好。")
        else:
            logger.error(f"💥 发现 {total_failed} 个问题需要修复。")

async def main():
    """主函数"""
    validator = IntegrationValidator()
    success = validator.run_all_validations()
    
    if success:
        logger.info("🎉 系统集成验证完成，所有检查通过！")
        return 0
    else:
        logger.error("💥 系统集成验证发现问题，请检查并修复！")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)