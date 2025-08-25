"""
Excel转CSV工具
用于将现有的Excel文件转换为CSV格式进行查看
"""
import pandas as pd
import os

def convert_excel_to_csv(excel_path: str, output_dir: str = None):
    """
    将Excel文件转换为CSV
    
    Args:
        excel_path: Excel文件路径
        output_dir: 输出目录，如果为None则使用Excel文件所在目录
    """
    if not os.path.exists(excel_path):
        print(f"文件不存在: {excel_path}")
        return
    
    if output_dir is None:
        output_dir = os.path.dirname(excel_path)
    
    try:
        # 读取Excel文件
        print(f"正在读取文件: {excel_path}")
        
        # 检查是否有多个sheet
        excel_file = pd.ExcelFile(excel_path)
        sheet_names = excel_file.sheet_names
        
        print(f"发现 {len(sheet_names)} 个工作表: {sheet_names}")
        
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
            print(f"已转换: {csv_path}")
            
            # 显示前几行和列信息
            print(f"\n工作表 '{sheet_name}' 信息:")
            print(f"行数: {len(df)}")
            print(f"列数: {len(df.columns)}")
            print(f"列名: {list(df.columns)}")
            print("前3行数据:")
            print(df.head(3).to_string(index=False))
            print("-" * 50)
        
        print(f"\n转换完成！CSV文件保存在: {output_dir}")
        
    except Exception as e:
        print(f"转换失败: {str(e)}")

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
            print(f"\n{'='*60}")
            print(f"转换文件: {filename}")
            print(f"{'='*60}")
            convert_excel_to_csv(excel_path)
        else:
            print(f"文件不存在: {excel_path}")

if __name__ == "__main__":
    main()