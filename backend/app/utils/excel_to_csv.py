"""
Excel转CSV工具
用于将现有的Excel文件转换为CSV格式进行查看
"""
import pandas as pd
import os
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def convert_excel_to_csv(excel_path: str, output_dir: str = None):
    """
    将Excel文件转换为CSV
    
    Args:
        excel_path: Excel文件路径
        output_dir: 输出目录，如果为None则使用Excel文件所在目录
    """
    if not os.path.exists(excel_path):
        logger.error(f"文件不存在: {excel_path}")
        return
    
    if output_dir is None:
        output_dir = os.path.dirname(excel_path)
    
    try:
        # 读取Excel文件
        logger.info(f"正在读取文件: {excel_path}")
        
        # 检查是否有多个sheet
        excel_file = pd.ExcelFile(excel_path)
        sheet_names = excel_file.sheet_names
        
        logger.info(f"发现 {len(sheet_names)} 个工作表: {sheet_names}")
        
        for sheet_name in sheet_names:
            # 读取每个sheet
            df = pd.read_excel(excel_path, sheet_name=sheet_name)
            
            # 生成CSV文件名
            base_name = os.path.splitext(os.path.basename(excel_path))[0]
            if len(sheet_names) > 1:
                csv_filename = f"{base_name}_{sheet_name}.csv"
            else:
                csv_filename = f"{base_name}.csv"
            
            csv_path = os.path.join(output_dir, csv_filename)
            
            # 保存为CSV
            df.to_csv(csv_path, index=False, encoding='utf-8-sig')
            logger.info(f"已转换: {csv_path}")
            
            # 显示前几行和列信息
            logger.info(f"工作表 '{sheet_name}' 信息:")
            logger.info(f"行数: {len(df)}")
            logger.info(f"列数: {len(df.columns)}")
            logger.debug(f"列名: {list(df.columns)}")
            logger.debug("前3行数据:")
            logger.debug(df.head(3).to_string(index=False))
            logger.info("-" * 50)
        
        logger.info(f"转换完成！CSV文件保存在: {output_dir}")
        
    except Exception as e:
        logger.error(f"转换失败: {str(e)}")

def main():
    """主函数"""
    # 项目根目录
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    
    # 要转换的文件
    files_to_convert = [
        "苏科大学生情况.xlsx",
        "literature_example.xlsx"
    ]
    
    for filename in files_to_convert:
        excel_path = os.path.join(project_root, filename)
        if os.path.exists(excel_path):
            logger.info(f"{'='*60}")
            logger.info(f"转换文件: {filename}")
            logger.info(f"{'='*60}")
            convert_excel_to_csv(excel_path)
        else:
            logger.error(f"文件不存在: {excel_path}")

if __name__ == "__main__":
    main()